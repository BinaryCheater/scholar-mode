import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  api,
  errorText,
  type AppConfig,
  type GraphManifestCandidate,
  type SessionMessage,
  type SessionSummary,
  type SidecarSession,
  type WorkspaceInfo
} from "./api";
import { ToolRunMessage, messageLabel, skillRoutingMessage } from "./chat/ToolMessages";
import { groupToolMessages } from "./toolMessages";
import { MarkdownContent } from "./MarkdownContent";
import { GraphSidebarHeader } from "./graph/GraphSidebarHeader";
import { ResearchGraphView } from "./ResearchGraphView";
import { SidebarResizeHandle, SidebarSectionResizeHandle, SIDEBAR_SPLIT_KEY, SIDEBAR_WIDTH_KEY, readStoredSidebarSplit, readStoredSidebarWidth } from "./shell/SidebarResizeHandles";
import { StandaloneFileViewer } from "./viewer/StandaloneFileViewer";
import type { ResearchGraph } from "../lib/researchGraph";
import "./styles.css";

function App() {
  const [activeView, setActiveView] = useState<"chat" | "graph">("graph");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceInfo>({ instructionFiles: [], skills: [] });
  const [graphCandidates, setGraphCandidates] = useState<GraphManifestCandidate[]>([]);
  const [selectedGraphPath, setSelectedGraphPath] = useState("");
  const [researchGraph, setResearchGraph] = useState<ResearchGraph | null>(null);
  const [graphError, setGraphError] = useState("");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [active, setActive] = useState<SidecarSession | null>(null);
  const [message, setMessage] = useState("");
  const [streams, setStreams] = useState<Record<string, { text: string; busy: boolean }>>({});
  const [enableTools, setEnableTools] = useState(true);
  const [includeInstructionFiles, setIncludeInstructionFiles] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => readStoredSidebarWidth());
  const [sidebarSplit, setSidebarSplit] = useState(() => readStoredSidebarSplit());
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [graphSaving, setGraphSaving] = useState(false);
  const [skillsInstalling, setSkillsInstalling] = useState(false);
  const abortControllers = useRef<Record<string, AbortController>>({});
  const sidebarBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void boot();
  }, []);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_SPLIT_KEY, String(sidebarSplit));
  }, [sidebarSplit]);

  async function boot() {
    const cfg = await api<AppConfig>("/api/config");
    setConfig(cfg);
    setSelectedGraphPath(cfg.graphManifestPath);
    await loadGraphCandidates();
    setWorkspace(await api<WorkspaceInfo>("/api/workspace"));
    await loadResearchGraph();
    const list = await api<SessionSummary[]>("/api/sessions");
    setSessions(list);
    if (list[0]) {
      await loadSession(list[0].id);
    } else {
      await createSession();
    }
  }

  async function loadResearchGraph() {
    try {
      setGraphError("");
      setResearchGraph(await api<ResearchGraph>("/api/research-graph"));
    } catch (err) {
      setGraphError(`Graph manifest: ${errorText(err)}`);
    }
  }

  async function loadGraphCandidates() {
    const result = await api<{ current: string; candidates: GraphManifestCandidate[] }>("/api/graphs");
    setGraphCandidates(result.candidates);
    setSelectedGraphPath((current) => current || result.current);
  }

  async function saveGraphSelection() {
    if (!selectedGraphPath.trim() || graphSaving) return;
    setGraphSaving(true);
    setNotice("");
    try {
      const next = await api<AppConfig>("/api/config", {
        method: "PATCH",
        body: JSON.stringify({ graphManifestPath: selectedGraphPath })
      });
      setConfig(next);
      setSelectedGraphPath(next.graphManifestPath);
      await loadGraphCandidates();
      await loadResearchGraph();
      setNotice(`Graph saved: ${next.graphManifestPath}`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setGraphSaving(false);
    }
  }

  async function installWorkspaceSkills() {
    if (skillsInstalling) return;
    setSkillsInstalling(true);
    setNotice("");
    try {
      const result = await api<{ installed: string[]; skipped: string[]; sourceRoot: string | null }>("/api/workspace/skills/install", {
        method: "POST",
        body: JSON.stringify({})
      });
      setWorkspace(await api<WorkspaceInfo>("/api/workspace"));
      const installed = result.installed.length ? `${result.installed.length} installed` : "no new skills";
      const skipped = result.skipped.length ? `, ${result.skipped.length} already present` : "";
      setNotice(`Workspace skills: ${installed}${skipped}`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSkillsInstalling(false);
    }
  }

  async function refreshSessions() {
    setSessions(await api<SessionSummary[]>("/api/sessions"));
  }

  async function createSession() {
    setError("");
    const session = await api<SidecarSession>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ title: "New review", model: config?.defaultModel || "gpt-5.5" })
    });
    setActive(session);
    await refreshSessions();
  }

  async function loadSession(id: string) {
    setError("");
    setActive(await api<SidecarSession>(`/api/sessions/${id}`));
  }

  async function saveSessionPatch(patch: Partial<SidecarSession>) {
    if (!active) return;
    const next = await api<SidecarSession>(`/api/sessions/${active.id}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    setActive(next);
    await refreshSessions();
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    if (!active) return;
    await startStream(active, message.trim(), { appendUser: true });
  }

  async function startStream(session: SidecarSession, pending: string, options: { appendUser: boolean; existingMessageId?: string }) {
    if (!pending || streams[session.id]?.busy) return;
    setError("");

    const sessionId = session.id;
    setMessage("");
    setStreams((current) => ({ ...current, [sessionId]: { text: "", busy: true } }));
    if (options.appendUser) {
      setActive({
        ...session,
        messages: [
          ...session.messages,
          {
            id: `local-${Date.now()}`,
            role: "user",
            content: pending,
            createdAt: new Date().toISOString(),
            source: "manual"
          }
        ]
      });
    } else {
      setActive(session);
    }

    const controller = new AbortController();
    abortControllers.current[sessionId] = controller;
    let aborted = false;

    try {
      const response = await fetch(`/api/sessions/${sessionId}/stream`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: pending,
          model: session.model,
          manualContext: session.manualContext,
          reviewPrompt: session.reviewPrompt,
          enableTools,
          includeInstructionFiles,
          existingMessageId: options.existingMessageId
        })
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Request failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assembled = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";
        for (const chunk of chunks) {
          if (!chunk.startsWith("data: ")) continue;
          const payload = JSON.parse(chunk.slice(6));
          if (payload.type === "delta") {
            assembled += payload.delta;
            setStreams((current) => ({ ...current, [sessionId]: { text: assembled, busy: true } }));
          }
          if (payload.type === "tool_call") {
            appendLocalMessage(sessionId, {
              role: "tool",
              content: `Calling \`${payload.name}\` with:\n\n\`\`\`json\n${payload.args}\n\`\`\``,
              toolName: payload.name
            });
          }
          if (payload.type === "skills") {
            appendLocalMessage(sessionId, {
              role: "system",
              content: skillRoutingMessage(payload)
            });
          }
          if (payload.type === "tool_result") {
            appendLocalMessage(sessionId, {
              role: "tool",
              content: `Result from \`${payload.name}\`:\n\n\`\`\`\n${String(payload.result).slice(0, 4000)}\n\`\`\``,
              toolName: payload.name
            });
          }
          if (payload.type === "error") {
            throw new Error(payload.error);
          }
        }
      }

      setStreams((current) => ({ ...current, [sessionId]: { text: "", busy: false } }));
      const next = await api<SidecarSession>(`/api/sessions/${sessionId}`);
      setActive((current) => (current?.id === sessionId ? next : current));
      await refreshSessions();
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(errorText(err));
      } else {
        aborted = true;
        setStreams((current) => ({ ...current, [sessionId]: { text: "", busy: false } }));
      }
    } finally {
      delete abortControllers.current[sessionId];
      if (!aborted) {
        setStreams((current) => ({ ...current, [sessionId]: { text: current[sessionId]?.text || "", busy: false } }));
      }
    }
  }

  async function stopStreaming() {
    if (!active) return;
    abortControllers.current[active.id]?.abort();
    setStreams((current) => ({ ...current, [active.id]: { text: "", busy: false } }));
    const next = await api<SidecarSession>(`/api/sessions/${active.id}`).catch(() => null);
    if (next) {
      setActive(next);
      await refreshSessions();
    }
  }

  async function rerunLastUserMessage() {
    if (!active || streams[active.id]?.busy) return;
    const lastUser = [...active.messages].reverse().find((item) => item.role === "user");
    if (lastUser) {
      await editUserMessage(lastUser.id, lastUser.content);
    }
  }

  async function editUserMessage(messageId: string, content: string) {
    if (!active || streams[active.id]?.busy || !content.trim()) return;
    const next = await api<SidecarSession>(`/api/sessions/${active.id}/messages/${messageId}/edit`, {
      method: "POST",
      body: JSON.stringify({ content: content.trim() })
    });
    setActive(next);
    setEditing(null);
    await refreshSessions();
    await startStream(next, content.trim(), { appendUser: false, existingMessageId: messageId });
  }

  function appendLocalMessage(sessionId: string, input: Pick<SessionMessage, "role" | "content"> & Partial<SessionMessage>) {
    setActive((current) => {
      if (current?.id !== sessionId) return current;
      return {
        ...current,
        messages: [
          ...current.messages,
          {
            id: `local-tool-${Date.now()}-${Math.random()}`,
            createdAt: new Date().toISOString(),
            source: "model",
            ...input
          }
        ]
      };
    });
  }

  const displayItems = useMemo(() => {
    if (!active) return [];
    const base = active.messages;
    const activeStream = streams[active.id];
    if (activeStream?.text) {
      return groupToolMessages([
        ...base,
        {
          id: "streaming",
          role: "assistant" as const,
          content: activeStream.text,
          createdAt: new Date().toISOString(),
          source: "model" as const,
          model: active.model,
          apiMode: active.apiMode
        }
      ]);
    }
    return groupToolMessages(base);
  }, [active, streams]);

  const activeBusy = Boolean(active && streams[active.id]?.busy);
  const appClassName = sidebarCollapsed ? "app-shell sidebar-collapsed" : "app-shell";
  const shellStyle = { "--workspace-sidebar-width": `${sidebarWidth}px` } as CSSProperties;
  const sidebarBodyStyle = { "--session-list-percent": `${sidebarSplit}%` } as CSSProperties;
  const topbarTitle = activeView === "graph" ? "Research Graph" : active?.title || "No session";
  const topbarSubtitle =
    activeView === "graph"
      ? `${config?.workspaceRoot || "Workspace"} · ${config?.graphManifestPath || "graph"}`
      : `${active?.model || config?.defaultModel} · ${config?.apiMode || "auto"} · ${enableTools && config?.apiMode === "chat" ? "tools on" : "tools off"}`;
  const viewTabs = (
    <div className="view-tabs sidebar-view-tabs" aria-label="Workspace view">
      <button className={activeView === "chat" ? "active" : ""} onClick={() => setActiveView("chat")}>
        Chat
      </button>
      <button className={activeView === "graph" ? "active" : ""} onClick={() => setActiveView("graph")}>
        Graph
      </button>
    </div>
  );
  const topbar = (
    <header className="topbar">
      <div>
        <strong>{topbarTitle}</strong>
        <span>{topbarSubtitle}</span>
      </div>
      <div className="topbar-actions">
        <div className={config?.hasOpenAIKey ? "status ok" : "status error"}>{config?.hasOpenAIKey ? "API OK" : "API ERROR"}</div>
      </div>
    </header>
  );
  const sidebarResizeHandle = (
    <SidebarResizeHandle
      collapsed={sidebarCollapsed}
      onResize={setSidebarWidth}
      value={sidebarWidth}
    />
  );
  const selectedGraphCandidate = graphCandidates.find((candidate) => candidate.path === selectedGraphPath);
  const graphSidebarHeader = (
    <GraphSidebarHeader
      candidates={graphCandidates}
      config={config}
      graphSaving={graphSaving}
      installWorkspaceSkills={() => void installWorkspaceSkills()}
      loadGraphCandidates={() => void loadGraphCandidates()}
      notice={notice}
      saveGraphSelection={() => void saveGraphSelection()}
      selectedCandidate={selectedGraphCandidate}
      selectedGraphPath={selectedGraphPath}
      setSelectedGraphPath={setSelectedGraphPath}
      setSidebarCollapsed={setSidebarCollapsed}
      sidebarCollapsed={sidebarCollapsed}
      skillsInstalling={skillsInstalling}
      viewTabs={viewTabs}
    />
  );

  if (activeView === "graph") {
    return (
      <ResearchGraphView
        error={error || graphError}
        graph={researchGraph || undefined}
        header={topbar}
        sidebarCollapsed={sidebarCollapsed}
        sidebarHeader={graphSidebarHeader}
        sidebarResizeHandle={sidebarResizeHandle}
        sidebarWidth={sidebarWidth}
      />
    );
  }

  return (
    <main className={appClassName} style={shellStyle}>
      <aside className="sidebar">
        <div className="workspace-sidebar-header">
          {viewTabs}
          <div className="brand-row">
            <div className="workspace-sidebar-title">
              <h1>Research Sidecar</h1>
              {!sidebarCollapsed && (
                <>
                  <p>{config?.workspaceRoot || "Loading workspace..."}</p>
                  {config?.openaiBaseURL && <p>{config.openaiBaseURL}</p>}
                </>
              )}
            </div>
            <div className="brand-actions">
              <button className="icon-button" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title="Toggle sidebar">
                {sidebarCollapsed ? "›" : "‹"}
              </button>
              <button className="icon-button primary" onClick={createSession} title="New session">
                +
              </button>
            </div>
          </div>
        </div>
          {sidebarResizeHandle}

          {!sidebarCollapsed && (
            <div className="sidebar-body" ref={sidebarBodyRef} style={sidebarBodyStyle}>
              <div className="session-list">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    className={session.id === active?.id ? "session active" : "session"}
                    onClick={() => loadSession(session.id)}
                  >
                    <span>{session.title}</span>
                    <small>
                      {session.messageCount} messages · {streams[session.id]?.busy ? "thinking" : "idle"}
                    </small>
                  </button>
                ))}
              </div>
              <SidebarSectionResizeHandle containerRef={sidebarBodyRef} onResize={setSidebarSplit} value={sidebarSplit} />

              {active && (
                <section className="context-panel">
                  <label>
                    Session title
                    <input value={active.title} onChange={(event) => setActive({ ...active, title: event.target.value })} onBlur={() => saveSessionPatch({ title: active.title })} />
                  </label>

                  <div className="model-row">
                    <label>
                      Model
                      <input value={active.model} onChange={(event) => setActive({ ...active, model: event.target.value })} onBlur={() => saveSessionPatch({ model: active.model })} />
                    </label>
                    <div className="mode-pill">auto · {config?.apiMode || active.apiMode}</div>
                  </div>

                  <label className="checkbox-label">
                    <input type="checkbox" checked={enableTools} onChange={(event) => setEnableTools(event.target.checked)} disabled={config?.apiMode !== "chat"} />
                    Enable workspace tools
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={includeInstructionFiles} onChange={(event) => setIncludeInstructionFiles(event.target.checked)} />
                    Include CLAUDE.md / AGENTS.md
                  </label>

                  <label>
                    Codex/context packet notes
                    <textarea
                      value={active.manualContext}
                      onChange={(event) => setActive({ ...active, manualContext: event.target.value })}
                      onBlur={() => saveSessionPatch({ manualContext: active.manualContext })}
                      placeholder="Paste Codex's summary, current plan, diffs, or experiment notes here."
                    />
                  </label>

                  <details>
                    <summary>Review prompt</summary>
                    <textarea
                      className="prompt-box"
                      value={active.reviewPrompt}
                      onChange={(event) => setActive({ ...active, reviewPrompt: event.target.value })}
                      onBlur={() => saveSessionPatch({ reviewPrompt: active.reviewPrompt })}
                    />
                  </details>
                  <details className="workspace-skills" open>
                    <summary>Workspace skills ({workspace.skills.length})</summary>
                    {workspace.instructionFiles.length > 0 && (
                      <div className="meta-list">
                        {workspace.instructionFiles.map((file) => (
                          <span key={file.path}>{file.path}</span>
                        ))}
                      </div>
                    )}
                    <div className="skill-list">
                      {workspace.skills.map((skill) => (
                        <div key={`${skill.path}-${skill.name}`} className="skill-row">
                          <strong>{skill.name}</strong>
                          <span>{skill.description || skill.path}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </section>
              )}
            </div>
          )}
      </aside>

      <section className="chat-pane">
        {topbar}

        {error && <div className="error-banner">{error}</div>}

        <>
            <div className="messages">
              {displayItems.length === 0 && (
                <div className="empty-state">
                  <h2>Start with a claim, plan, or uncertainty.</h2>
                  <p>Add explicit context on the left, then ask the sidecar to challenge the reasoning.</p>
                </div>
              )}
              {displayItems.map((displayItem) =>
                displayItem.kind === "tool-run" ? (
                  <ToolRunMessage key={displayItem.run.id} run={displayItem.run} />
                ) : (
                  <article key={displayItem.message.id} className={`message ${displayItem.message.role}`}>
                    <>
                      <div className="message-meta">
                        <span>{messageLabel(displayItem.message)}</span>
                        {displayItem.message.model && <small>{displayItem.message.model}</small>}
                        {displayItem.message.role === "user" && !activeBusy && (
                          <button className="text-button" onClick={() => setEditing({ id: displayItem.message.id, content: displayItem.message.content })}>
                            Edit
                          </button>
                        )}
                      </div>
                      {editing?.id === displayItem.message.id ? (
                        <form
                          className="edit-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void editUserMessage(displayItem.message.id, editing.content);
                          }}
                        >
                          <textarea value={editing.content} onChange={(event) => setEditing({ id: editing.id, content: event.target.value })} />
                          <div className="composer-actions">
                            <button type="button" className="secondary-button" onClick={() => setEditing(null)}>
                              Cancel
                            </button>
                            <button>Save & rerun</button>
                          </div>
                        </form>
                      ) : (
                        <MarkdownContent className="message-body" content={displayItem.message.content} />
                      )}
                    </>
                  </article>
                )
              )}
            </div>

            <form className="composer" onSubmit={sendMessage}>
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask for an independent review, rival hypotheses, weak links, or the next evidence to gather." />
              <div className="composer-actions">
                <button type="button" className="secondary-button" disabled={!active?.messages.some((item) => item.role === "user") || activeBusy} onClick={rerunLastUserMessage}>
                  Rerun
                </button>
                {activeBusy ? (
                  <button type="button" className="stop-button" onClick={stopStreaming}>
                    Stop
                  </button>
                ) : (
                  <button disabled={!message.trim()}>Send</button>
                )}
              </div>
            </form>
          </>
      </section>
    </main>
  );
}

function Root() {
  if (window.location.pathname === "/viewer") {
    return <StandaloneFileViewer />;
  }
  return <App />;
}

createRoot(document.getElementById("root")!).render(<Root />);

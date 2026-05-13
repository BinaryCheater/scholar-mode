import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { groupToolMessages, type ToolExchange, type ToolRun } from "./toolMessages";
import "./styles.css";

type ApiMode = "responses" | "chat";

interface FileSnapshot {
  id: string;
  path: string;
  content: string;
  bytes: number;
  addedAt: string;
}

interface SessionMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt: string;
  source: "manual" | "model" | "system";
  model?: string;
  apiMode?: ApiMode;
  toolName?: string;
}

interface SidecarSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  manualContext: string;
  reviewPrompt: string;
  model: string;
  apiMode: ApiMode;
  files: FileSnapshot[];
  messages: SessionMessage[];
}

interface SessionSummary {
  id: string;
  title: string;
  updatedAt: string;
  model: string;
  apiMode: ApiMode;
  messageCount: number;
  fileCount: number;
}

interface AppConfig {
  workspaceRoot: string;
  defaultModel: string;
  openaiBaseURL: string | null;
  apiMode: ApiMode;
  hasOpenAIKey: boolean;
}

interface WorkspaceSkill {
  name: string;
  description: string;
  path: string;
}

interface WorkspaceSkillTrigger {
  skill: WorkspaceSkill;
  score: number;
  confidence: "high" | "medium";
  reason: string;
  disclosure: "loaded" | "candidate";
}

interface WorkspaceInfo {
  instructionFiles: Array<{ path: string; bytes: number }>;
  skills: WorkspaceSkill[];
}

function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceInfo>({ instructionFiles: [], skills: [] });
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [active, setActive] = useState<SidecarSession | null>(null);
  const [message, setMessage] = useState("");
  const [streams, setStreams] = useState<Record<string, { text: string; busy: boolean }>>({});
  const [enableTools, setEnableTools] = useState(true);
  const [includeInstructionFiles, setIncludeInstructionFiles] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const [error, setError] = useState("");
  const abortControllers = useRef<Record<string, AbortController>>({});

  useEffect(() => {
    void boot();
  }, []);

  async function boot() {
    const cfg = await api<AppConfig>("/api/config");
    setConfig(cfg);
    setWorkspace(await api<WorkspaceInfo>("/api/workspace"));
    const list = await api<SessionSummary[]>("/api/sessions");
    setSessions(list);
    if (list[0]) {
      await loadSession(list[0].id);
    } else {
      await createSession();
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

  return (
    <main className={sidebarCollapsed ? "app-shell sidebar-collapsed" : "app-shell"}>
      <aside className="sidebar">
        <div className="brand-row">
          <div>
            <h1>Thinking Sidecar</h1>
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

        {!sidebarCollapsed && (
          <>
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
          </>
        )}
      </aside>

      <section className="chat-pane">
        <header className="topbar">
          <div>
            <strong>{active?.title || "No session"}</strong>
            <span>
              {active?.model || config?.defaultModel} · {config?.apiMode || "auto"} · {enableTools && config?.apiMode === "chat" ? "tools on" : "tools off"}
            </span>
          </div>
          <div className={config?.hasOpenAIKey ? "status ok" : "status warn"}>{config?.hasOpenAIKey ? "OPENAI_API_KEY set" : "OPENAI_API_KEY missing"}</div>
        </header>

        {error && <div className="error-banner">{error}</div>}

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
                      <textarea value={editing.content} onChange={(event) => setEditing({ id: displayItem.message.id, content: event.target.value })} />
                      <div className="composer-actions">
                        <button type="button" className="secondary-button" onClick={() => setEditing(null)}>
                          Cancel
                        </button>
                        <button>Save & rerun</button>
                      </div>
                    </form>
                  ) : (
                    <div className="message-body markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayItem.message.content}</ReactMarkdown>
                    </div>
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
      </section>
    </main>
  );
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || response.statusText);
  }
  return response.json() as Promise<T>;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error.";
}

function messageLabel(item: SessionMessage) {
  if (item.role === "assistant") return "Sidecar";
  if (item.role === "tool") return item.toolName ? `Tool · ${item.toolName}` : "Tool";
  if (item.role === "system") return "System";
  return "You";
}

function ToolRunMessage({ run }: { run: ToolRun<SessionMessage> }) {
  const completed = run.exchanges.filter((exchange) => exchange.result).length;
  return (
    <article className="message tool">
      <details className="tool-run-card">
        <summary>
          <span className="tool-summary-main">
            <span className="tool-chip result">Tools</span>
            <strong>Workspace tools</strong>
            <small>
              {run.exchanges.length} call{run.exchanges.length === 1 ? "" : "s"}
              {completed > 0 ? ` · ${completed} result${completed === 1 ? "" : "s"}` : ""}
            </small>
          </span>
          <span className="tool-summary-action">Details</span>
        </summary>
        <div className="tool-run-details">
          {run.exchanges.map((exchange) => (
            <ToolExchangeMessage key={exchange.id} exchange={exchange} />
          ))}
        </div>
      </details>
    </article>
  );
}

function ToolExchangeMessage({ exchange }: { exchange: ToolExchange<SessionMessage> }) {
  return (
    <details className="tool-card">
      <summary>
        <span className="tool-summary-main">
          <span className={exchange.result ? "tool-chip result" : "tool-chip"}>{exchange.result ? "Done" : "Call"}</span>
          <strong>{exchange.name}</strong>
        </span>
        <span className="tool-summary-action">Details</span>
      </summary>
      <div className="message-body markdown-body tool-details">
        {exchange.call && (
          <section className="tool-detail-section">
            <h3>Call</h3>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{exchange.call.content}</ReactMarkdown>
          </section>
        )}
        {exchange.result && (
          <section className="tool-detail-section">
            <h3>Result</h3>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{exchange.result.content}</ReactMarkdown>
          </section>
        )}
      </div>
    </details>
  );
}

function skillRoutingMessage(payload: { triggers?: WorkspaceSkillTrigger[]; skills?: WorkspaceSkill[]; loadedSkills?: Array<{ path: string; bytes: number }> }) {
  if (payload.triggers?.length) {
    const loaded = new Set((payload.loadedSkills || []).map((skill) => skill.path));
    return `Workspace skill routing:\n\n${payload.triggers
      .map((trigger) => {
        const state = loaded.has(trigger.skill.path) ? "loaded" : trigger.disclosure;
        return `- \`${trigger.skill.name}\` — ${trigger.confidence}; ${state}; ${trigger.reason}`;
      })
      .join("\n")}`;
  }
  return `Triggered workspace skills:\n\n${(payload.skills || []).map((skill) => `- \`${skill.name}\` — ${skill.description || skill.path}`).join("\n")}`;
}

createRoot(document.getElementById("root")!).render(<App />);

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
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
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  source: "manual" | "model" | "system";
  model?: string;
  apiMode?: ApiMode;
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
  hasOpenAIKey: boolean;
}

function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [active, setActive] = useState<SidecarSession | null>(null);
  const [message, setMessage] = useState("");
  const [filePath, setFilePath] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void boot();
  }, []);

  async function boot() {
    const cfg = await api<AppConfig>("/api/config");
    setConfig(cfg);
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
    setStreamingText("");
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

  async function addFile(event: FormEvent) {
    event.preventDefault();
    if (!active || !filePath.trim()) return;
    setError("");
    try {
      const next = await api<SidecarSession>(`/api/sessions/${active.id}/files`, {
        method: "POST",
        body: JSON.stringify({ path: filePath.trim() })
      });
      setFilePath("");
      setActive(next);
      await refreshSessions();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function removeFile(fileId: string) {
    if (!active) return;
    const next = await api<SidecarSession>(`/api/sessions/${active.id}/files/${fileId}`, {
      method: "DELETE"
    });
    setActive(next);
    await refreshSessions();
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!active || !message.trim() || busy) return;
    setBusy(true);
    setError("");
    setStreamingText("");

    const pending = message.trim();
    setMessage("");
    setActive({
      ...active,
      messages: [
        ...active.messages,
        {
          id: `local-${Date.now()}`,
          role: "user",
          content: pending,
          createdAt: new Date().toISOString(),
          source: "manual"
        }
      ]
    });

    try {
      const response = await fetch(`/api/sessions/${active.id}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: pending,
          model: active.model,
          apiMode: active.apiMode,
          manualContext: active.manualContext,
          reviewPrompt: active.reviewPrompt
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
            setStreamingText(assembled);
          }
          if (payload.type === "error") {
            throw new Error(payload.error);
          }
        }
      }

      setStreamingText("");
      await loadSession(active.id);
      await refreshSessions();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const visibleMessages = useMemo(() => {
    if (!active) return [];
    const base = active.messages;
    if (streamingText) {
      return [
        ...base,
        {
          id: "streaming",
          role: "assistant" as const,
          content: streamingText,
          createdAt: new Date().toISOString(),
          source: "model" as const,
          model: active.model,
          apiMode: active.apiMode
        }
      ];
    }
    return base;
  }, [active, streamingText]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div>
            <h1>Thinking Sidecar</h1>
            <p>{config?.workspaceRoot || "Loading workspace..."}</p>
            {config?.openaiBaseURL && <p>{config.openaiBaseURL}</p>}
          </div>
          <button className="icon-button" onClick={createSession} title="New session">
            +
          </button>
        </div>

        <div className="session-list">
          {sessions.map((session) => (
            <button
              key={session.id}
              className={session.id === active?.id ? "session active" : "session"}
              onClick={() => loadSession(session.id)}
            >
              <span>{session.title}</span>
              <small>
                {session.messageCount} messages · {session.fileCount} files
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

            <div className="grid-two">
              <label>
                Model
                <input value={active.model} onChange={(event) => setActive({ ...active, model: event.target.value })} onBlur={() => saveSessionPatch({ model: active.model })} />
              </label>
              <label>
                API
                <select value={active.apiMode} onChange={(event) => saveSessionPatch({ apiMode: event.target.value as ApiMode })}>
                  <option value="responses">Responses</option>
                  <option value="chat">Chat</option>
                </select>
              </label>
            </div>

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

            <form onSubmit={addFile} className="file-form">
              <label>
                Add workspace file
                <div className="path-row">
                  <input value={filePath} onChange={(event) => setFilePath(event.target.value)} placeholder="SKILL.md" />
                  <button>Add</button>
                </div>
              </label>
            </form>

            <div className="file-list">
              {active.files.map((file) => (
                <div key={file.id} className="file-chip">
                  <span title={file.path}>{file.path}</span>
                  <button onClick={() => removeFile(file.id)} title="Remove file">
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>

      <section className="chat-pane">
        <header className="topbar">
          <div>
            <strong>{active?.title || "No session"}</strong>
            <span>
              {active?.model || config?.defaultModel} · {active?.apiMode || "responses"}
            </span>
          </div>
          <div className={config?.hasOpenAIKey ? "status ok" : "status warn"}>{config?.hasOpenAIKey ? "OPENAI_API_KEY set" : "OPENAI_API_KEY missing"}</div>
        </header>

        {error && <div className="error-banner">{error}</div>}

        <div className="messages">
          {visibleMessages.length === 0 && (
            <div className="empty-state">
              <h2>Start with a claim, plan, or uncertainty.</h2>
              <p>Add explicit context on the left, then ask the sidecar to challenge the reasoning.</p>
            </div>
          )}
          {visibleMessages.map((item) => (
            <article key={item.id} className={`message ${item.role}`}>
              <div className="message-meta">
                <span>{item.role === "assistant" ? "Sidecar" : "You"}</span>
                {item.model && <small>{item.model}</small>}
              </div>
              <div className="message-body">{item.content}</div>
            </article>
          ))}
        </div>

        <form className="composer" onSubmit={sendMessage}>
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask for an independent review, rival hypotheses, weak links, or the next evidence to gather." />
          <button disabled={!message.trim() || busy}>{busy ? "Thinking..." : "Send"}</button>
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

createRoot(document.getElementById("root")!).render(<App />);

import { MarkdownContent } from "../MarkdownContent";
import type { SessionMessage, WorkspaceSkill, WorkspaceSkillTrigger } from "../api";
import type { ToolExchange, ToolRun } from "../toolMessages";

export function messageLabel(item: SessionMessage) {
  if (item.role === "assistant") return "Sidecar";
  if (item.role === "tool") return item.toolName ? `Tool · ${item.toolName}` : "Tool";
  if (item.role === "system") return "System";
  return "You";
}

export function ToolRunMessage({ run }: { run: ToolRun<SessionMessage> }) {
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

export function skillRoutingMessage(payload: { triggers?: WorkspaceSkillTrigger[]; skills?: WorkspaceSkill[]; loadedSkills?: Array<{ path: string; bytes: number }> }) {
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
      <div className="message-body tool-details">
        {exchange.call && (
          <section className="tool-detail-section">
            <h3>Call</h3>
            <MarkdownContent content={exchange.call.content} />
          </section>
        )}
        {exchange.result && (
          <section className="tool-detail-section">
            <h3>Result</h3>
            <MarkdownContent content={exchange.result.content} />
          </section>
        )}
      </div>
    </details>
  );
}

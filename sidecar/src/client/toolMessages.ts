export interface ToolMessageLike {
  id: string;
  role: string;
  content: string;
  toolName?: string;
}

export type DisplayMessage<T extends ToolMessageLike> = { kind: "message"; message: T } | { kind: "tool-run"; run: ToolRun<T> };

export interface ToolRun<T extends ToolMessageLike> {
  id: string;
  exchanges: ToolExchange<T>[];
}

export interface ToolExchange<T extends ToolMessageLike> {
  id: string;
  name: string;
  call?: T;
  result?: T;
}

export function groupToolMessages<T extends ToolMessageLike>(messages: T[]): DisplayMessage<T>[] {
  const output: DisplayMessage<T>[] = [];
  let pendingTools: T[] = [];

  for (const message of messages) {
    if (message.role === "tool") {
      pendingTools.push(message);
      continue;
    }
    flushToolRun(output, pendingTools);
    pendingTools = [];
    output.push({ kind: "message", message });
  }

  flushToolRun(output, pendingTools);
  return output;
}

function flushToolRun<T extends ToolMessageLike>(output: DisplayMessage<T>[], messages: T[]) {
  if (!messages.length) return;
  const first = messages[0];
  const last = messages[messages.length - 1];
  output.push({
    kind: "tool-run",
    run: {
      id: `tool-run-${first.id}-${last.id}`,
      exchanges: pairToolMessages(messages)
    }
  });
}

function pairToolMessages<T extends ToolMessageLike>(messages: T[]) {
  const exchanges: ToolExchange<T>[] = [];

  for (const message of messages) {
    const phase = toolPhase(message);
    const name = message.toolName || message.content.match(/`([^`]+)`/)?.[1] || "workspace tool";
    const last = exchanges[exchanges.length - 1];

    if (phase === "result" && last && last.name === name && !last.result) {
      last.result = message;
      continue;
    }

    exchanges.push({
      id: message.id,
      name,
      ...(phase === "result" ? { result: message } : { call: message })
    });
  }

  return exchanges;
}

function toolPhase(message: ToolMessageLike) {
  return message.content.startsWith("Result from") ? "result" : "call";
}

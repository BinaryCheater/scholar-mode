import type { FileSnapshot, SessionMessage } from "./types.js";

interface ContextPacketInput {
  reviewPrompt: string;
  manualContext: string;
  files: FileSnapshot[];
  history: SessionMessage[];
  userMessage: string;
}

export function buildContextPacket(input: ContextPacketInput) {
  const files = input.files.length
    ? input.files
        .map(
          (file) => `### File: ${file.path}
Bytes: ${file.bytes}
Added: ${file.addedAt}

${file.content}`
        )
        .join("\n\n---\n\n")
    : "No file snapshots were attached.";

  const history = input.history.length
    ? input.history
        .map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`)
        .join("\n\n")
    : "No prior messages in this session.";

  return `${input.reviewPrompt}

## Explicit Context Packet

### Manual Context
${input.manualContext.trim() || "No manual context was supplied."}

### File Snapshots
${files}

### Conversation History
${history}

### Current User Request
${input.userMessage.trim()}

## Response Constraints

Only use the explicit context above. The stable protocol, manual context, and file snapshots are intentionally placed before conversation history and the current request so providers with prompt/context caching can reuse the longest unchanged prefix. If a judgment depends on hidden Codex context, say what is missing instead of guessing.`;
}

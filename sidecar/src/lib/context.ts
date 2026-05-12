import type { FileSnapshot } from "./types.js";

interface ContextPacketInput {
  reviewPrompt: string;
  manualContext: string;
  files: FileSnapshot[];
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

  return `${input.reviewPrompt}

## Explicit Context Packet

### Manual Context
${input.manualContext.trim() || "No manual context was supplied."}

### File Snapshots
${files}

### User Request
${input.userMessage.trim()}

## Response Constraints

Only use the explicit context above. If a judgment depends on hidden Codex context, say what is missing instead of guessing.`;
}

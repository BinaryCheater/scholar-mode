import type { FileSnapshot, SessionMessage, WorkspaceSkill, WorkspaceSkillTrigger } from "./types.js";

interface ContextPacketInput {
  reviewPrompt: string;
  manualContext: string;
  files: FileSnapshot[];
  instructionFiles: FileSnapshot[];
  workspaceSkills: WorkspaceSkill[];
  skillTriggers: WorkspaceSkillTrigger[];
  loadedSkillFiles: FileSnapshot[];
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
        .map((message) => `${roleLabel(message.role)}: ${message.content}`)
        .join("\n\n")
    : "No prior messages in this session.";

  const instructions = input.instructionFiles.length
    ? input.instructionFiles.map((file) => `### ${file.path}\n\n${file.content}`).join("\n\n---\n\n")
    : "Instruction files were not included.";

  const skills = input.workspaceSkills.length
    ? input.workspaceSkills.map((skill) => `- ${skill.name}: ${skill.description} (${skill.path})`).join("\n")
    : "No workspace skills were discovered.";

  const triggered = input.skillTriggers.length
    ? input.skillTriggers
        .map(
          (trigger) =>
            `- ${trigger.skill.name}: ${trigger.confidence} confidence, ${trigger.disclosure}. ${trigger.reason} (${trigger.skill.path})`
        )
        .join("\n")
    : "No workspace skill appears directly triggered by this turn.";

  const loadedSkills = input.loadedSkillFiles.length
    ? input.loadedSkillFiles.map((file) => `### Loaded Skill: ${file.path}\n\n${file.content}`).join("\n\n---\n\n")
    : "No full skill instructions were auto-loaded. If a candidate skill seems relevant, use the load_skill tool before relying on it.";

  return `${input.reviewPrompt}

## Explicit Context Packet

### Manual Context
${input.manualContext.trim() || "No manual context was supplied."}

### Instruction Files
${instructions}

### Workspace Skills
${skills}

### Triggered Skills For This Turn
${triggered}

### Loaded Skill Instructions
${loadedSkills}

### File Snapshots
${files}

### Conversation History
${history}

### Current User Request
${input.userMessage.trim()}

## Response Constraints

Only use the explicit context above. The stable protocol, manual context, and file snapshots are intentionally placed before conversation history and the current request so providers with prompt/context caching can reuse the longest unchanged prefix. If a judgment depends on hidden Codex context, say what is missing instead of guessing.`;
}

function roleLabel(role: SessionMessage["role"]) {
  if (role === "assistant") return "Assistant";
  if (role === "tool") return "Tool";
  if (role === "system") return "System";
  return "User";
}

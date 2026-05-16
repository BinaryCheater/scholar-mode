export type ApiMode = "responses" | "chat";

export interface FileSnapshot {
  id: string;
  path: string;
  content: string;
  bytes: number;
  format: "markdown" | "html" | "text";
  mimeType: string;
  addedAt: string;
}

export interface SessionMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt: string;
  source: "manual" | "model" | "system";
  model?: string;
  apiMode?: ApiMode;
  toolName?: string;
}

export interface SidecarSession {
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

export interface SessionSummary {
  id: string;
  title: string;
  updatedAt: string;
  model: string;
  apiMode: ApiMode;
  messageCount: number;
  fileCount: number;
}

export interface AppConfig {
  workspaceRoot: string;
  graphManifestPath: string;
  defaultModel: string;
  openaiBaseURL: string | null;
  apiMode: ApiMode;
  hasOpenAIKey: boolean;
}

export interface WorkspaceSkill {
  name: string;
  description: string;
  path: string;
}

export interface WorkspaceSkillTrigger {
  skill: WorkspaceSkill;
  score: number;
  confidence: "high" | "medium";
  reason: string;
  disclosure: "loaded" | "candidate";
}

export interface WorkspaceInfo {
  instructionFiles: Array<{ path: string; bytes: number }>;
  skills: WorkspaceSkill[];
}

export interface GraphManifestCandidate {
  path: string;
  selected: boolean;
  rootId?: string;
  title?: string;
  nodeCount?: number;
  edgeCount?: number;
  error?: string;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
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

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error.";
}

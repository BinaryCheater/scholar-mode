export type ApiMode = "responses" | "chat";

export type MessageRole = "user" | "assistant" | "system";

export interface FileSnapshot {
  id: string;
  path: string;
  content: string;
  bytes: number;
  addedAt: string;
}

export interface SessionMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  source: "manual" | "model" | "system";
  model?: string;
  apiMode?: ApiMode;
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

export interface ToolAdapter {
  name: string;
  description: string;
  invoke(args: unknown): Promise<unknown>;
}

export interface AppConfig {
  workspaceRoot: string;
  dataFile: string;
  defaultModel: string;
  openaiBaseURL?: string;
  port: number;
}

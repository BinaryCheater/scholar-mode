import { resolve } from "node:path";
import type { ApiMode, AppConfig } from "../lib/types.js";

interface LoadConfigOptions {
  env?: NodeJS.ProcessEnv;
}

export function loadConfig(options: LoadConfigOptions = {}): AppConfig {
  const env = options.env || process.env;
  const workspaceRoot = resolve(env.SIDECAR_WORKSPACE_ROOT || resolve(process.cwd(), ".."));
  const dataFile = resolve(env.SIDECAR_DATA_FILE || resolve(process.cwd(), "data", "sessions.json"));
  const port = Number.parseInt(env.PORT || "4317", 10);

  return {
    workspaceRoot,
    dataFile,
    defaultModel: env.SIDECAR_DEFAULT_MODEL || "gpt-5.5",
    openaiBaseURL: env.OPENAI_BASE_URL,
    apiMode: chooseApiMode(env.OPENAI_BASE_URL),
    port: Number.isFinite(port) ? port : 4317
  };
}

export function chooseApiMode(baseURL?: string): ApiMode {
  if (!baseURL?.trim()) return "responses";
  try {
    const host = new URL(baseURL).hostname;
    return host === "api.openai.com" || host.endsWith(".openai.com") ? "responses" : "chat";
  } catch {
    return "chat";
  }
}

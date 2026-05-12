import { resolve } from "node:path";
import type { AppConfig } from "../lib/types.js";

export function loadConfig(): AppConfig {
  const workspaceRoot = resolve(process.env.SIDECAR_WORKSPACE_ROOT || resolve(process.cwd(), ".."));
  const dataFile = resolve(process.env.SIDECAR_DATA_FILE || resolve(process.cwd(), "data", "sessions.json"));
  const port = Number.parseInt(process.env.PORT || "4317", 10);

  return {
    workspaceRoot,
    dataFile,
    defaultModel: process.env.SIDECAR_DEFAULT_MODEL || "gpt-5.5",
    port: Number.isFinite(port) ? port : 4317
  };
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ApiMode, AppConfig } from "../lib/types.js";

interface LoadConfigOptions {
  env?: NodeJS.ProcessEnv;
}

interface SidecarConfigFile {
  defaultModel?: string;
  openaiAPIKey?: string;
  openaiBaseURL?: string;
  apiMode?: ApiMode;
  graph?: {
    manifestPath?: string;
  };
  tools?: {
    allowedWriteExtensions?: string[];
  };
}

const DEFAULT_ALLOWED_WRITE_EXTENSIONS = [".md", ".markdown", ".html", ".htm"];
const DEFAULT_GRAPH_MANIFEST_PATH = "research/graph.yaml";

export function loadConfig(options: LoadConfigOptions = {}): AppConfig {
  const env = options.env || process.env;
  const workspaceRoot = resolve(env.SIDECAR_WORKSPACE_ROOT || resolve(process.cwd(), ".."));
  const sideDir = resolve(workspaceRoot, ".side");
  const configFile = resolve(sideDir, "config.json");
  mkdirSync(sideDir, { recursive: true });
  const persisted = readSidecarConfig(configFile);
  const port = Number.parseInt(env.PORT || "4317", 10);
  const openaiBaseURL = env.OPENAI_BASE_URL || persisted.openaiBaseURL;
  const apiMode = persisted.apiMode || chooseApiMode(openaiBaseURL);
  const allowedWriteExtensions = normalizeExtensions(persisted.tools?.allowedWriteExtensions);
  const config: AppConfig = {
    workspaceRoot,
    sideDir,
    dataFile: resolve(env.SIDECAR_DATA_FILE || resolve(sideDir, "sessions", "index.json")),
    graphManifestPath: normalizeManifestPath(env.SIDECAR_GRAPH_MANIFEST || persisted.graph?.manifestPath),
    defaultModel: env.SIDECAR_DEFAULT_MODEL || persisted.defaultModel || "gpt-5.5",
    openaiAPIKey: env.OPENAI_API_KEY || persisted.openaiAPIKey,
    openaiBaseURL,
    apiMode,
    port: Number.isFinite(port) ? port : 4317,
    allowedWriteExtensions
  };

  writeSidecarConfig(configFile, config);
  return config;
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

function readSidecarConfig(path: string): SidecarConfigFile {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  return raw.trim() ? (JSON.parse(raw) as SidecarConfigFile) : {};
}

function writeSidecarConfig(path: string, config: AppConfig) {
  const body: SidecarConfigFile = {
    defaultModel: config.defaultModel,
    openaiAPIKey: config.openaiAPIKey,
    openaiBaseURL: config.openaiBaseURL,
    apiMode: config.apiMode,
    graph: {
      manifestPath: config.graphManifestPath
    },
    tools: {
      allowedWriteExtensions: config.allowedWriteExtensions
    }
  };
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`);
}

function normalizeExtensions(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_ALLOWED_WRITE_EXTENSIONS;
  const normalized = value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().toLowerCase())
    .map((item) => (item.startsWith(".") ? item : `.${item}`));
  return normalized.length ? Array.from(new Set(normalized)) : DEFAULT_ALLOWED_WRITE_EXTENSIONS;
}

function normalizeManifestPath(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return DEFAULT_GRAPH_MANIFEST_PATH;
  return value.trim().replace(/^\.\//, "");
}

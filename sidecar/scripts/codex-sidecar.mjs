#!/usr/bin/env node

import { access, cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.url || "http://localhost:4317";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const defaultAllowedWriteExtensions = [".md", ".markdown", ".html", ".htm"];

if (args.help) {
  console.log(`Usage:
  npm run codex:install -- --workspace /path/to/research-repo
  npm run codex:call -- --title "Review" --context "Codex summary" --file SKILL.md --question "What should the sidecar inspect?"
  npm run codex:ask -- --title "Review" --context "Codex summary" --question "What is the weakest assumption?"
  npm run codex:session -- --title "Review" --context "Codex summary" --file SKILL.md --file notes.md

Options:
  --url       Sidecar server URL. Default: http://localhost:4317
  --workspace Workspace directory to initialize for install mode.
  --graph     Graph manifest path inside the workspace. Default: research/graph.yaml
  --no-graph  Do not create a starter graph manifest.
  --no-skills Do not copy bundled skills into the workspace.
  --force     Overwrite install-managed files when possible.
  --title     Session title.
  --context   Manual context packet notes.
  --file      Workspace-relative file path. Repeatable.
  --question  Optional user question for call mode; required prompt for ask mode.
  --model     Model string. Default server model is used when omitted.
  --api       responses or chat.
`);
  process.exit(0);
}

if (args.command === "install") {
  await installWorkspace(args);
  process.exit(0);
}

if (args.command !== "call" && args.command !== "session" && args.command !== "ask") {
  throw new Error(`Unknown command: ${args.command}`);
}

const session = await request(`${baseUrl}/api/sessions`, {
  method: "POST",
  body: JSON.stringify({
    title: args.title || "Codex handoff",
    model: args.model,
    apiMode: args.api
  })
});

if (args.context) {
  await request(`${baseUrl}/api/sessions/${session.id}`, {
    method: "PATCH",
    body: JSON.stringify({ manualContext: args.context })
  });
}

for (const file of args.files) {
  await request(`${baseUrl}/api/sessions/${session.id}/files`, {
    method: "POST",
    body: JSON.stringify({ path: file })
  });
}

if (args.command !== "ask" && args.question) {
  await request(`${baseUrl}/api/sessions/${session.id}/messages`, {
    method: "POST",
    body: JSON.stringify({ role: "user", content: args.question })
  });
}

console.log("Sidecar session ready");
console.log(`${baseUrl}`);
console.log(`Session: ${session.id}`);
console.log(`Open: ${baseUrl}`);

if (args.command === "ask") {
  if (!args.question) {
    throw new Error("--question is required for ask mode.");
  }
  console.log("");
  console.log("Sidecar answer:");
  await streamAnswer(`${baseUrl}/api/sessions/${session.id}/stream`, {
    message: args.question,
    enableTools: true,
    includeInstructionFiles: false
  });
  console.log("");
}

function parseArgs(raw) {
  const parsed = { command: "call", files: [] };
  const first = raw[0];
  const start = first && !first.startsWith("-") ? 1 : 0;
  if (start) {
    parsed.command = first;
  }
  for (let i = start; i < raw.length; i += 1) {
    const key = raw[i];
    const value = raw[i + 1];
    if (key === "--help" || key === "-h") parsed.help = true;
    if (key === "--url") parsed.url = value, i += 1;
    if (key === "--workspace") parsed.workspace = value, i += 1;
    if (key === "--graph") parsed.graph = value, i += 1;
    if (key === "--no-graph") parsed.noGraph = true;
    if (key === "--no-skills") parsed.noSkills = true;
    if (key === "--force") parsed.force = true;
    if (key === "--title") parsed.title = value, i += 1;
    if (key === "--context") parsed.context = value, i += 1;
    if (key === "--file") parsed.files.push(value), i += 1;
    if (key === "--question") parsed.question = value, i += 1;
    if (key === "--model") parsed.model = value, i += 1;
    if (key === "--api") parsed.api = value, i += 1;
  }
  return parsed;
}

async function installWorkspace(args) {
  const workspaceRoot = resolve(args.workspace || process.cwd());
  const graphManifestPath = normalizeWorkspacePath(args.graph || "research/graph.yaml");
  const sideDir = join(workspaceRoot, ".side");
  const sessionsDir = join(sideDir, "sessions");

  await mkdir(workspaceRoot, { recursive: true });
  await mkdir(sessionsDir, { recursive: true });
  await writeSidecarConfig(join(sideDir, "config.json"), graphManifestPath);
  await writeFileIfMissing(join(sessionsDir, "index.json"), `${JSON.stringify({ sessions: [] }, null, 2)}\n`);
  await ensureGitignore(workspaceRoot);

  if (!args.noSkills) {
    await installBundledSkills(workspaceRoot, Boolean(args.force));
  }

  if (!args.noGraph) {
    await installStarterGraph(workspaceRoot, graphManifestPath, Boolean(args.force));
  }

  console.log("Thinking Sidecar workspace installed");
  console.log(`Workspace: ${workspaceRoot}`);
  console.log(`Config: ${join(sideDir, "config.json")}`);
  console.log(`Graph: ${graphManifestPath}${args.noGraph ? " (not created)" : ""}`);
  console.log("");
  console.log("Run from a home/user-level Sidecar install:");
  console.log(`SIDECAR_WORKSPACE_ROOT="${workspaceRoot}" npm run dev`);
  console.log("");
  console.log("Or, if the Sidecar app itself is copied into this workspace:");
  console.log("cd sidecar && npm run dev");
}

async function writeSidecarConfig(configPath, graphManifestPath) {
  const existing = await readJsonFile(configPath);
  const config = {
    ...existing,
    graph: {
      ...(existing.graph || {}),
      manifestPath: graphManifestPath
    },
    tools: {
      allowedWriteExtensions: defaultAllowedWriteExtensions,
      ...(existing.tools || {})
    }
  };
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function installBundledSkills(workspaceRoot, force) {
  const sourceRoot = await findBundledSkillsRoot();
  if (!sourceRoot) return;
  const names = await readdir(sourceRoot, { withFileTypes: true });
  await mkdir(join(workspaceRoot, "skills"), { recursive: true });
  for (const entry of names) {
    if (!entry.isDirectory()) continue;
    const source = join(sourceRoot, entry.name);
    const target = join(workspaceRoot, "skills", entry.name);
    if (!force && (await exists(target))) continue;
    await cp(source, target, { recursive: true, force, errorOnExist: false });
  }
}

async function findBundledSkillsRoot() {
  for (const candidate of [join(repoRoot, "skills"), join(appRoot, "skills")]) {
    if (await exists(candidate)) return candidate;
  }
  return null;
}

async function installStarterGraph(workspaceRoot, graphManifestPath, force) {
  const graphPath = join(workspaceRoot, graphManifestPath);
  const graphDir = dirname(graphPath);
  const notePath = join(graphDir, "rq.main.md");
  const graphBody = `root: rq.main

ui:
  layout: LR
  expanded: [rq.main]

nodes:
  - id: rq.main
    title: Core research question
    type: question
    file: ./rq.main.md
    status: active
    tags: [framing]

edges: []
`;
  const noteBody = `# Core research question

Use this note as the first graph node, or replace it with your existing research Markdown.
`;
  await mkdir(graphDir, { recursive: true });
  await writeFileMaybe(graphPath, graphBody, force);
  await writeFileMaybe(notePath, noteBody, force);
}

async function ensureGitignore(workspaceRoot) {
  const path = join(workspaceRoot, ".gitignore");
  const current = await readTextFile(path);
  if (current === null) {
    await writeFile(path, ".side/\n", "utf8");
    return;
  }
  if (!current.split(/\r?\n/).some((line) => line.trim() === ".side/" || line.trim() === ".side")) {
    const suffix = current.endsWith("\n") || current.length === 0 ? "" : "\n";
    await writeFile(path, `${current}${suffix}.side/\n`, "utf8");
  }
}

async function writeFileIfMissing(path, body) {
  if (await exists(path)) return;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body, "utf8");
}

async function writeFileMaybe(path, body, force) {
  if (!force && (await exists(path))) return;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body, "utf8");
}

async function readJsonFile(path) {
  const raw = await readTextFile(path);
  if (!raw?.trim()) return {};
  return JSON.parse(raw);
}

async function readTextFile(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function normalizeWorkspacePath(path) {
  const normalized = path.trim().replace(/^\.\//, "");
  if (!normalized || normalized.startsWith("../") || normalized.includes("/../") || normalized === "..") {
    throw new Error("Workspace paths must stay inside the workspace.");
  }
  return normalized;
}

async function request(url, init) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || response.statusText);
  }
  return response.json();
}

async function streamAnswer(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok || !response.body) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || response.statusText);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";
    for (const frame of frames) {
      if (!frame.startsWith("data: ")) {
        continue;
      }
      const payload = JSON.parse(frame.slice(6));
      if (payload.type === "delta") {
        process.stdout.write(payload.delta);
      }
      if (payload.type === "error") {
        throw new Error(payload.error);
      }
    }
  }
}

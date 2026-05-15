import { access, cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ALLOWED_WRITE_EXTENSIONS = [".md", ".markdown", ".html", ".htm", ".yaml", ".yml"];

export interface InstallSkillsResult {
  sourceRoot: string | null;
  installed: string[];
  skipped: string[];
}

export interface InstallWorkspaceOptions {
  graphManifestPath?: string;
  createGraph?: boolean;
  installSkills?: boolean;
  force?: boolean;
}

export async function installWorkspaceScaffold(workspaceRoot: string, options: InstallWorkspaceOptions = {}) {
  const root = resolve(workspaceRoot);
  const graphManifestPath = normalizeWorkspacePath(options.graphManifestPath || "research/graph.yaml");
  const sideDir = join(root, ".side");
  const sessionsDir = join(sideDir, "sessions");

  await mkdir(root, { recursive: true });
  await mkdir(sessionsDir, { recursive: true });
  await writeSidecarConfig(join(sideDir, "config.json"), graphManifestPath);
  await writeFileIfMissing(join(sessionsDir, "index.json"), `${JSON.stringify({ sessions: [] }, null, 2)}\n`);
  await ensureGitignore(root);

  const skills = options.installSkills === false ? undefined : await installBundledSkills(root, { force: options.force });
  if (options.createGraph !== false) {
    await installStarterGraph(root, graphManifestPath, Boolean(options.force));
  }

  return {
    workspaceRoot: root,
    configPath: join(sideDir, "config.json"),
    graphManifestPath,
    skills
  };
}

export async function installBundledSkills(workspaceRoot: string, options: { force?: boolean } = {}): Promise<InstallSkillsResult> {
  const sourceRoot = await findBundledSkillsRoot();
  if (!sourceRoot) return { sourceRoot: null, installed: [], skipped: [] };

  const entries = await readdir(sourceRoot, { withFileTypes: true });
  const targetRoot = join(resolve(workspaceRoot), "skills");
  const installed: string[] = [];
  const skipped: string[] = [];
  await mkdir(targetRoot, { recursive: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const source = join(sourceRoot, entry.name);
    const target = join(targetRoot, entry.name);
    if (!options.force && (await exists(target))) {
      skipped.push(entry.name);
      continue;
    }
    await cp(source, target, { recursive: true, force: true });
    installed.push(entry.name);
  }

  return { sourceRoot, installed, skipped };
}

async function findBundledSkillsRoot() {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(moduleDir, "../../skills"),
    resolve(moduleDir, "../../../skills"),
    resolve(process.cwd(), "skills")
  ];
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  return null;
}

async function writeSidecarConfig(configPath: string, graphManifestPath: string) {
  const existing = await readJsonFile(configPath);
  const config = {
    ...existing,
    graph: {
      ...(existing.graph || {}),
      manifestPath: graphManifestPath
    },
    tools: {
      allowedWriteExtensions: DEFAULT_ALLOWED_WRITE_EXTENSIONS,
      ...(existing.tools || {})
    }
  };
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function installStarterGraph(workspaceRoot: string, graphManifestPath: string, force: boolean) {
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

async function ensureGitignore(workspaceRoot: string) {
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

async function writeFileIfMissing(path: string, body: string) {
  if (await exists(path)) return;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body, "utf8");
}

async function writeFileMaybe(path: string, body: string, force: boolean) {
  if (!force && (await exists(path))) return;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body, "utf8");
}

async function readJsonFile(path: string) {
  const raw = await readTextFile(path);
  if (!raw?.trim()) return {};
  return JSON.parse(raw);
}

async function readTextFile(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function normalizeWorkspacePath(value: string) {
  return value.trim().replace(/^\.\//, "").replace(/^\/+/, "");
}

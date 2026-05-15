import { readdir } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { loadResearchGraphManifest } from "./researchGraphManifest.js";

export interface GraphManifestCandidate {
  path: string;
  selected: boolean;
  rootId?: string;
  title?: string;
  nodeCount?: number;
  edgeCount?: number;
  error?: string;
}

const IGNORED_DIRECTORIES = new Set([".git", ".hg", ".side", ".next", ".turbo", "coverage", "dist", "dist-server", "node_modules"]);
const GRAPH_FILE_PATTERN = /(^graph|\.graph)\.ya?ml$/i;

export async function discoverGraphManifests(workspaceRoot: string, selectedPath?: string): Promise<GraphManifestCandidate[]> {
  const root = resolve(workspaceRoot);
  const paths = await findGraphManifestPaths(root);
  const candidates = await Promise.all(paths.map((path) => describeGraphManifest(root, path, selectedPath)));
  return candidates.sort((left, right) => {
    if (left.selected !== right.selected) return left.selected ? -1 : 1;
    return left.path.localeCompare(right.path);
  });
}

async function describeGraphManifest(workspaceRoot: string, path: string, selectedPath?: string): Promise<GraphManifestCandidate> {
  const selected = normalizePath(path) === normalizePath(selectedPath || "");
  try {
    const graph = await loadResearchGraphManifest(workspaceRoot, path);
    const rootNode = graph.nodes.find((node) => node.id === graph.rootId);
    return {
      path,
      selected,
      rootId: graph.rootId,
      title: rootNode?.title,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length
    };
  } catch (error) {
    return {
      path,
      selected,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function findGraphManifestPaths(root: string, dir = ""): Promise<string[]> {
  const fullDir = join(root, dir);
  let entries;
  try {
    entries = await readdir(fullDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const out: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".research") {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
    }
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      out.push(...(await findGraphManifestPaths(root, rel)));
    } else if (entry.isFile() && GRAPH_FILE_PATTERN.test(entry.name)) {
      out.push(normalizePath(relative(root, join(root, rel))));
    }
  }
  return out;
}

function normalizePath(path: string) {
  return path.split(sep).join("/").replace(/^\.\//, "").replace(/^\/+/, "");
}

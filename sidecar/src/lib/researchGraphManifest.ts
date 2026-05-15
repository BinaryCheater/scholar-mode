import { access, readFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join } from "node:path";
import YAML from "yaml";
import { resolveWorkspacePath, toWorkspaceRelativePath } from "./files.js";
import type { LayoutDirection, ResearchEdgeKind, ResearchGraph, ResearchGraphEdge, ResearchGraphNode, ResearchGraphNodeFile, ResearchNodeType } from "./researchGraph.js";

const DEFAULT_MANIFEST_PATH = "research/graph.yaml";
const NODE_TYPES = new Set<ResearchNodeType>(["question", "claim", "evidence", "method", "concept", "source", "task", "output"]);
const EDGE_KINDS = new Set<ResearchEdgeKind>(["decomposes", "answers", "supports", "contradicts", "depends_on", "operationalizes", "cites", "leads_to"]);
const STATUSES = new Set<NonNullable<ResearchGraphNode["status"]>>(["active", "draft", "blocked", "done"]);
const LAYOUTS = new Set<LayoutDirection>(["LR", "TB"]);

interface ManifestNode {
  id?: unknown;
  title?: unknown;
  type?: unknown;
  file?: unknown;
  files?: unknown;
  summary?: unknown;
  status?: unknown;
  tags?: unknown;
}

interface ManifestEdge {
  id?: unknown;
  from?: unknown;
  to?: unknown;
  kind?: unknown;
  label?: unknown;
}

interface FrontmatterNode {
  id?: unknown;
  title?: unknown;
  type?: unknown;
  file?: unknown;
  files?: unknown;
  summary?: unknown;
  status?: unknown;
  tags?: unknown;
}

export async function loadResearchGraphManifest(workspaceRoot: string, manifestPath = DEFAULT_MANIFEST_PATH): Promise<ResearchGraph> {
  const fullPath = resolveWorkspacePath(workspaceRoot, manifestPath);
  const manifest = parseYamlRecord(await readFile(fullPath, "utf8"), manifestPath);
  const manifestDir = dirname(manifestPath);
  const rootId = requiredString(manifest.root, "root");
  const nodes = asArray<ManifestNode>(manifest.nodes, "nodes");
  const edges = asArray<ManifestEdge>(manifest.edges ?? [], "edges");
  const warnings: string[] = [];
  const graphNodes: ResearchGraphNode[] = [];

  for (const node of nodes) {
    graphNodes.push(await normalizeNode(workspaceRoot, manifestDir, node, warnings));
  }

  const nodeIds = new Set(graphNodes.map((node) => node.id));
  if (!nodeIds.has(rootId)) {
    throw new Error(`Graph root ${rootId} does not match any node id.`);
  }

  const graphEdges = edges.map((edge) => normalizeEdge(edge, nodeIds));
  const ui = normalizeUi(manifest.ui);

  return {
    rootId,
    sourcePath: manifestPath,
    nodes: graphNodes,
    edges: graphEdges,
    warnings,
    ...(ui ? { ui } : {})
  };
}

async function normalizeNode(workspaceRoot: string, manifestDir: string, input: ManifestNode, warnings: string[]): Promise<ResearchGraphNode> {
  const id = requiredString(input.id, "node.id");
  const linkedFiles = normalizeManifestLinkedFiles(workspaceRoot, manifestDir, input.file, input.files);
  const primaryFile = linkedFiles[0]?.path;
  const frontmatter = primaryFile && isMarkdownPath(primaryFile) ? await readNodeFrontmatter(workspaceRoot, primaryFile) : {};
  const frontmatterFiles = linkedFiles.length ? [] : normalizeManifestLinkedFiles(workspaceRoot, manifestDir, frontmatter.file, frontmatter.files);
  const files = linkedFiles.length ? linkedFiles : frontmatterFiles;
  const file = files[0]?.path;
  const frontmatterId = optionalString(frontmatter.id);
  if (frontmatterId && frontmatterId !== id) {
    throw new Error(`Frontmatter id ${frontmatterId} does not match graph node ${id}.`);
  }
  const manifestTags = asStringArray(input.tags);
  const frontmatterTags = asStringArray(frontmatter.tags);

  const node: ResearchGraphNode = {
    id,
    title: optionalString(input.title) || optionalString(frontmatter.title) || id,
    type: normalizeNodeType(optionalString(input.type) || optionalString(frontmatter.type), id),
    ...(file ? { file } : {}),
    ...(files.length ? { files } : {}),
    ...optionalField("summary", optionalString(input.summary) || optionalString(frontmatter.summary)),
    ...optionalStatus(optionalString(input.status) || optionalString(frontmatter.status)),
    ...(manifestTags.length || frontmatterTags.length ? { tags: manifestTags.length ? manifestTags : frontmatterTags } : {})
  };

  if (files.length) {
    for (const linked of files) {
      linked.fileExists = await fileExists(workspaceRoot, linked.path);
      if (!linked.fileExists) {
        warnings.push(`Missing file for node ${id}: ${linked.path}`);
      }
    }
    node.fileExists = files[0].fileExists;
  }

  return node;
}

function normalizeEdge(input: ManifestEdge, nodeIds: Set<string>): ResearchGraphEdge {
  const from = requiredString(input.from, "edge.from");
  const to = requiredString(input.to, "edge.to");
  const kind = normalizeEdgeKind(input.kind);
  if (!nodeIds.has(from)) {
    throw new Error(`Edge source ${from} does not match any node id.`);
  }
  if (!nodeIds.has(to)) {
    throw new Error(`Edge target ${to} does not match any node id.`);
  }
  return {
    id: optionalString(input.id) || `${from}->${to}:${kind}`,
    from,
    to,
    kind,
    ...optionalField("label", input.label)
  };
}

function normalizeUi(value: unknown): ResearchGraph["ui"] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const expanded = asStringArray(input.expanded);
  const layout = optionalString(input.layout);
  return {
    ...(expanded.length ? { expanded } : {}),
    ...(layout && LAYOUTS.has(layout as LayoutDirection) ? { layout: layout as LayoutDirection } : {})
  };
}

async function readNodeFrontmatter(workspaceRoot: string, path: string): Promise<FrontmatterNode> {
  try {
    const raw = await readFile(resolveWorkspacePath(workspaceRoot, path), "utf8");
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    return match ? parseYamlRecord(match[1], path) : {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

function normalizeManifestLinkedPath(workspaceRoot: string, manifestDir: string, value?: string) {
  if (!value) return undefined;
  if (isAbsolute(value)) {
    throw new Error(`Graph file paths must be relative to the workspace or manifest directory: ${value}`);
  }
  const candidate = value.startsWith("./") || value.startsWith("../") || !value.includes("/") ? join(manifestDir, value) : value;
  return toWorkspaceRelativePath(workspaceRoot, resolveWorkspacePath(workspaceRoot, candidate));
}

function normalizeManifestLinkedFiles(workspaceRoot: string, manifestDir: string, fileValue: unknown, filesValue: unknown): ResearchGraphNodeFile[] {
  const out: ResearchGraphNodeFile[] = [];
  const seen = new Set<string>();

  function add(pathValue: unknown, titleValue?: unknown) {
    const path = normalizeManifestLinkedPath(workspaceRoot, manifestDir, optionalString(pathValue));
    if (!path || seen.has(path)) return;
    seen.add(path);
    out.push({
      path,
      ...optionalField("title", titleValue)
    });
  }

  add(fileValue);

  if (Array.isArray(filesValue)) {
    for (const item of filesValue) {
      if (typeof item === "string") {
        add(item);
      } else if (item && typeof item === "object" && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        add(record.path ?? record.file, record.title);
      }
    }
  }

  return out;
}

function parseYamlRecord(source: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = YAML.parse(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} is not valid YAML: ${message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must contain a YAML object.`);
  }
  return parsed as Record<string, unknown>;
}

function requiredString(value: unknown, label: string) {
  const normalized = optionalString(value);
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeNodeType(value: unknown, id: string): ResearchNodeType {
  const type = optionalString(value);
  if (!type || !NODE_TYPES.has(type as ResearchNodeType)) {
    throw new Error(`Node ${id} has invalid type ${type || "missing"}.`);
  }
  return type as ResearchNodeType;
}

function normalizeEdgeKind(value: unknown): ResearchEdgeKind {
  const kind = optionalString(value);
  if (!kind || !EDGE_KINDS.has(kind as ResearchEdgeKind)) {
    throw new Error(`Edge has invalid kind ${kind || "missing"}.`);
  }
  return kind as ResearchEdgeKind;
}

function optionalField<K extends "summary" | "label" | "title">(key: K, value: unknown) {
  const normalized = optionalString(value);
  return normalized ? { [key]: normalized } : {};
}

function optionalStatus(value: unknown) {
  const status = optionalString(value);
  return status && STATUSES.has(status as NonNullable<ResearchGraphNode["status"]>) ? { status: status as NonNullable<ResearchGraphNode["status"]> } : {};
}

function asArray<T>(value: unknown, label: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  return value as T[];
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

async function fileExists(workspaceRoot: string, path: string) {
  try {
    await access(resolveWorkspacePath(workspaceRoot, path));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function isMarkdownPath(path: string) {
  const extension = extname(path).toLowerCase();
  return extension === ".md" || extension === ".markdown";
}

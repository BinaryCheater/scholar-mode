import type { CSSProperties } from "react";
import type { GraphViewMode, LayoutResearchNode, ResearchGraph, ResearchGraphEdge, ResearchGraphNode, ResearchGraphNodeFile, ResearchNodeType } from "../../lib/researchGraph";

export type FilePreviewFormat = "markdown" | "html" | "text";
export type PreviewDock = "right" | "bottom";

export type FilePreviewState =
  | { status: "idle" }
  | { status: "note"; path: string; title: string; summary?: string }
  | { status: "loading"; path: string; title: string }
  | {
      status: "ready";
      path: string;
      title: string;
      content: string;
      bytes: number;
      format: FilePreviewFormat;
      mimeType: string;
      links: ResearchGraphNodeFile[];
    }
  | { status: "error"; path: string; title: string; message: string };

export interface FilePreviewSnapshot {
  path: string;
  content: string;
  bytes: number;
  format: FilePreviewFormat;
  mimeType: string;
}

export function readableEdgeLabel(edge: ResearchGraphEdge) {
  return edge.label || "";
}

export function defaultExpandedIds(graph: ResearchGraph) {
  return new Set(graph.ui?.expanded?.length ? graph.ui.expanded : [graph.rootId]);
}

export function defaultPreviewSize() {
  return { right: 500, bottom: 340 };
}

export function previewWorkspaceStyle(status: FilePreviewState["status"], dock: PreviewDock, size: { right: number; bottom: number }): CSSProperties | undefined {
  if (status === "idle") return undefined;
  if (dock === "right") {
    return { gridTemplateColumns: `minmax(0, 1fr) minmax(300px, ${size.right}px)` };
  }
  return { gridTemplateRows: `minmax(0, 1fr) minmax(220px, ${size.bottom}px)` };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function nodeClassName(item: LayoutResearchNode, mode: GraphViewMode, extra = "") {
  return ["research-node", mode, `type-${item.type}`, allLinkedFilesMissing(item) ? "missing-file" : "", extra].filter(Boolean).join(" ");
}

export function previewButtonTitle(node: LayoutResearchNode) {
  const links = linkedFiles(node);
  if (!links.length) return "Show graph.yaml summary";
  if (allLinkedFilesMissing(node)) return "All linked files are referenced by graph.yaml but do not exist yet";
  return links.length > 1 ? "Preview linked documents" : "Preview file";
}

export function previewButtonLabel(node: LayoutResearchNode) {
  const links = linkedFiles(node);
  if (!links.length) return "Note";
  if (allLinkedFilesMissing(node)) return "Missing";
  return links.length > 1 ? "Docs" : "Open";
}

export function linkedFiles(node: Pick<ResearchGraphNode, "file" | "fileExists" | "files">): ResearchGraphNodeFile[] {
  if (node.files?.length) return node.files;
  if (node.file) return [{ path: node.file, fileExists: node.fileExists }];
  return [];
}

export function firstExistingLinkedFile(node: Pick<ResearchGraphNode, "file" | "fileExists" | "files">) {
  return linkedFiles(node).find((link) => link.fileExists !== false);
}

export function allLinkedFilesMissing(node: Pick<ResearchGraphNode, "file" | "fileExists" | "files">) {
  const links = linkedFiles(node);
  return links.length > 0 && links.every((link) => link.fileExists === false);
}

export function nodeSubtitle(node: Pick<ResearchGraphNode, "id" | "file" | "fileExists" | "files">) {
  const links = linkedFiles(node);
  if (!links.length) return node.id;
  if (links.length === 1) return links[0].path;
  const existing = links.filter((link) => link.fileExists !== false).length;
  return `${existing}/${links.length} linked docs`;
}

export function shortPath(path: string) {
  return path.split("/").pop() || path;
}

export function viewerUrl(path: string) {
  return `/viewer?path=${encodeURIComponent(path)}`;
}

export function htmlWithWorkspaceBase(path: string, content: string) {
  const baseDir = path.split("/").slice(0, -1).map(encodeURIComponent).join("/");
  const base = `<base href="/api/workspace/raw-path/${baseDir ? `${baseDir}/` : ""}">`;
  if (/<head[\s>]/i.test(content)) {
    return content.replace(/<head([^>]*)>/i, `<head$1>${base}`);
  }
  return `${base}${content}`;
}

export function nodeColor(type?: ResearchNodeType) {
  if (type === "claim") return "#7c3aed";
  if (type === "evidence") return "#0f766e";
  if (type === "method") return "#b45309";
  if (type === "source") return "#2563eb";
  if (type === "task") return "#be123c";
  if (type === "concept") return "#475569";
  return "#111827";
}

export function edgeColor(kind: ResearchGraphEdge["kind"]) {
  if (kind === "supports") return "#27847b";
  if (kind === "cites") return "#3b73c8";
  if (kind === "contradicts") return "#c9352b";
  if (kind === "leads_to") return "#8a6a15";
  return "#9aa3ad";
}

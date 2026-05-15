import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  buildGraphIndex,
  getExpandableDescendantIds,
  getExpandableNodeIds,
  getVisibleResearchGraph,
  layoutResearchGraph,
  type GraphViewMode,
  type LayoutResearchGraph,
  type LayoutResearchNode,
  type ResearchGraph,
  type ResearchGraphEdge,
  type ResearchGraphNode,
  type ResearchGraphNodeFile,
  type ResearchNodeType
} from "../lib/researchGraph";
import { MarkdownContent } from "./MarkdownContent";
import { sampleResearchGraph } from "./researchGraphData";

type GraphNodeData = {
  item: LayoutResearchNode;
  childCount: number;
  expanded: boolean;
  highlighted: boolean;
  isRoot: boolean;
  mode: GraphViewMode;
  onExpandBranch: (id: string) => void;
  onToggle: (id: string) => void;
} & Record<string, unknown>;

type ResearchFlowNode = Node<GraphNodeData, "research">;

const nodeTypes = { research: ResearchNodeCard };

type FilePreviewState =
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
type PreviewDock = "right" | "bottom";
type FilePreviewFormat = "markdown" | "html" | "text";

export function ResearchGraphView({
  error,
  graph = sampleResearchGraph,
  header,
  sidebarCollapsed = false,
  sidebarHeader,
  sidebarResizeHandle,
  sidebarWidth
}: {
  error?: string;
  graph?: ResearchGraph;
  header?: ReactNode;
  sidebarCollapsed?: boolean;
  sidebarHeader?: ReactNode;
  sidebarResizeHandle?: ReactNode;
  sidebarWidth?: number;
}) {
  return (
    <ReactFlowProvider>
      <ResearchGraphCanvas
        error={error}
        graph={graph}
        header={header}
        sidebarCollapsed={sidebarCollapsed}
        sidebarHeader={sidebarHeader}
        sidebarResizeHandle={sidebarResizeHandle}
        sidebarWidth={sidebarWidth}
      />
    </ReactFlowProvider>
  );
}

function ResearchGraphCanvas({
  error,
  graph,
  header,
  sidebarCollapsed,
  sidebarHeader,
  sidebarResizeHandle,
  sidebarWidth
}: {
  error?: string;
  graph: ResearchGraph;
  header?: ReactNode;
  sidebarCollapsed: boolean;
  sidebarHeader?: ReactNode;
  sidebarResizeHandle?: ReactNode;
  sidebarWidth?: number;
}) {
  const [expandedIds, setExpandedIds] = useState(() => defaultExpandedIds(graph));
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<GraphViewMode>("compact");
  const [preview, setPreview] = useState<FilePreviewState>({ status: "idle" });
  const [previewDock, setPreviewDock] = useState<PreviewDock>("right");
  const [previewSize, setPreviewSize] = useState({ right: 500, bottom: 340 });
  const { fitView, setCenter } = useReactFlow<ResearchFlowNode, Edge>();
  const graphIndex = useMemo(() => buildGraphIndex(graph), [graph]);
  const searchResults = useMemo(() => graphIndex.search(query), [graphIndex, query]);
  const visible = useMemo(() => getVisibleResearchGraph(graph, { expandedIds, query }), [expandedIds, graph, query]);
  const layout = useMemo(() => layoutResearchGraph(visible, { direction: "LR", mode }), [mode, visible]);
  const matchedIds = useMemo(() => new Set(searchResults.map((node) => node.id)), [searchResults]);
  const expandableIds = useMemo(() => getExpandableNodeIds(graph), [graph]);

  useEffect(() => {
    setExpandedIds(defaultExpandedIds(graph));
  }, [graph]);

  const flowNodes = useMemo<ResearchFlowNode[]>(
    () =>
      layout.nodes.map((node) => ({
        id: node.id,
        type: "research",
        position: node.position,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          item: node,
          childCount: layout.childCounts[node.id] || 0,
          expanded: expandedIds.has(node.id),
          highlighted: Boolean(query.trim()) && matchedIds.has(node.id),
          isRoot: node.id === graph.rootId,
          mode,
          onExpandBranch: expandBranch,
          onToggle: toggleNode
        }
      })),
    [expandedIds, graph.rootId, layout.childCounts, layout.nodes, matchedIds, mode, query]
  );

  const flowEdges = useMemo<Edge[]>(
    () =>
      layout.edges.map((edge) => ({
        id: edge.id,
        source: edge.from,
        target: edge.to,
        label: readableEdgeLabel(edge),
        type: mode === "compact" ? "bezier" : "smoothstep",
        className: `research-edge kind-${edge.kind}`,
        interactionWidth: 16,
        style: { stroke: edgeColor(edge.kind), strokeWidth: mode === "compact" ? 1.45 : 1.7 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: mode === "compact" ? 11 : 15,
          height: mode === "compact" ? 11 : 15,
          color: edgeColor(edge.kind)
        }
      })),
    [layout.edges, mode]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => fitView({ padding: 0.16, maxZoom: mode === "compact" ? 1.15 : 0.9, duration: 260 }), 80);
    return () => window.clearTimeout(timer);
  }, [fitView, flowNodes.length, mode, query]);

  function toggleNode(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpandedIds(new Set(expandableIds));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  function expandBranch(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      for (const branchId of getExpandableDescendantIds(graph, id)) {
        next.add(branchId);
      }
      return next;
    });
  }

  function focusNode(node: LayoutResearchNode) {
    const offset = mode === "compact" ? 9 : 130;
    setCenter(node.position.x + offset, node.position.y + offset, { zoom: mode === "compact" ? 1.55 : 1.08, duration: 280 });
  }

  async function openNodePreview(node: Pick<ResearchGraphNode, "id" | "title" | "summary" | "file" | "fileExists" | "files">, preferredPath?: string) {
    const links = linkedFiles(node);
    if (!links.length) {
      setPreview({ status: "note", path: node.id, title: node.title, summary: node.summary });
      return;
    }

    const target = (preferredPath ? links.find((link) => link.path === preferredPath && link.fileExists !== false) : undefined) || links.find((link) => link.fileExists !== false);
    if (!target) {
      setPreview({ status: "error", path: node.id, title: node.title, message: "This graph node only links to missing files." });
      return;
    }

    setPreview({ status: "loading", path: target.path, title: target.title || node.title });
    try {
      const snapshot = await api<FilePreviewSnapshot>(`/api/workspace/file?path=${encodeURIComponent(target.path)}`);
      setPreview({
        status: "ready",
        path: snapshot.path,
        title: target.title || node.title,
        content: snapshot.content,
        bytes: snapshot.bytes,
        format: snapshot.format,
        mimeType: snapshot.mimeType,
        links
      });
    } catch (error) {
      setPreview({ status: "error", path: target.path, title: target.title || node.title, message: errorText(error) });
    }
  }

  function openPathFromPreview(path: string) {
    const node = graph.nodes.find((item) => linkedFiles(item).some((link) => link.path === path));
    if (node) return openNodePreview(node, path);
    return undefined;
  }

  return (
    <main className={sidebarCollapsed ? "app-shell graph-view sidebar-collapsed" : "app-shell graph-view"} style={sidebarWidth ? ({ "--workspace-sidebar-width": `${sidebarWidth}px` } as CSSProperties) : undefined}>
      <aside className="graph-index-panel">
        {sidebarHeader}
        {sidebarResizeHandle}
        {!sidebarCollapsed && (
          <>
            <div className="graph-panel-header">
              <div>
                <strong>Overview</strong>
                <span>
                  {visible.nodes.length}/{graph.nodes.length} nodes · {visible.edges.length} edges
                </span>
              </div>
              <button className="secondary-button compact" onClick={() => fitView({ padding: 0.16, maxZoom: mode === "compact" ? 1.15 : 0.9, duration: 260 })}>
                Fit
              </button>
            </div>

            <label className="graph-search">
              Search
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, id, path, tag..." />
            </label>

            <div className="graph-layout-toggle" aria-label="Graph display mode">
              <button className={mode === "compact" ? "active" : ""} onClick={() => setMode("compact")}>
                Compact
              </button>
              <button className={mode === "full" ? "active" : ""} onClick={() => setMode("full")}>
                Full
              </button>
            </div>

            <div className="graph-actions" aria-label="Graph expansion controls">
              <button onClick={expandAll}>Expand all</button>
              <button onClick={collapseAll}>Collapse all</button>
            </div>

            <div className="graph-index-list">
              {layout.nodes.map((node) => (
                <div key={node.id} className={matchedIds.has(node.id) && query.trim() ? "graph-index-item match" : "graph-index-item"}>
                  <button className="graph-index-focus" onClick={() => focusNode(node)}>
                    <span className={`node-type type-${node.type}`}>{node.type}</span>
                    <strong>{node.title}</strong>
                    <small>{nodeSubtitle(node)}</small>
                  </button>
                  <button className="graph-index-open" onClick={() => void openNodePreview(node)} disabled={allLinkedFilesMissing(node)} title={previewButtonTitle(node)}>
                    {previewButtonLabel(node)}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </aside>

      <section className="chat-pane graph-active">
        {header}
        {error && <div className="error-banner">{error}</div>}
        <div className={preview.status === "idle" ? "graph-workspace" : `graph-workspace preview-${previewDock}`} style={previewWorkspaceStyle(preview.status, previewDock, previewSize)}>
          <div className="graph-canvas">
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              nodeTypes={nodeTypes}
              minZoom={0.25}
              maxZoom={1.7}
              fitView
              fitViewOptions={{ padding: 0.16, maxZoom: mode === "compact" ? 1.15 : 0.9 }}
              onNodeClick={(_, node) => void openNodePreview(node.data.item)}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={28} size={1} color="#dce3ea" />
              <Controls position="bottom-right" />
            </ReactFlow>
            <GraphOverview layout={layout} mode={mode} />
          </div>
          <FilePreviewPanel
            dock={previewDock}
            onClose={() => setPreview({ status: "idle" })}
            onDockChange={setPreviewDock}
            onOpenPath={(path) => void openPathFromPreview(path)}
            onResize={setPreviewSize}
            preview={preview}
            size={previewSize}
          />
        </div>
      </section>
    </main>
  );
}

function ResearchNodeCard({ data, selected }: NodeProps<ResearchFlowNode>) {
  const item = data.item;
  const canBranch = data.childCount > 0;
  const canCollapse = canBranch && !data.isRoot;

  return (
    <article
      className={selected ? nodeClassName(item, data.mode, "selected") : nodeClassName(item, data.mode)}
      title={`${item.title}\n${item.type}${item.status ? ` · ${item.status}` : ""}\n${item.file || item.id}${item.summary ? `\n${item.summary}` : ""}`}
    >
      <Handle type="target" position={Position.Left} className="node-handle node-handle-left" />
      <Handle type="source" position={Position.Right} className="node-handle node-handle-right" />
      <Handle type="target" position={Position.Top} className="node-handle node-handle-top" />
      <Handle type="source" position={Position.Bottom} className="node-handle node-handle-bottom" />
      {data.mode === "full" ? (
        <FullNodeContent item={item} highlighted={data.highlighted} />
      ) : (
        <CompactNodeContent item={item} />
      )}
      {canCollapse && (
        <button
          className="node-toggle nodrag"
          onClick={(event) => {
            event.stopPropagation();
            data.onToggle(item.id);
          }}
          title={data.expanded ? "Collapse node" : "Expand node"}
        >
          {data.expanded ? "−" : "+"}
        </button>
      )}
      {canBranch && (
        <button
          className="node-branch-toggle nodrag"
          onClick={(event) => {
            event.stopPropagation();
            data.onExpandBranch(item.id);
          }}
          title="Expand full branch"
        >
          ↧
        </button>
      )}
      {data.highlighted && <span className="node-match" />}
      <div className="node-tooltip" role="tooltip">
        <strong>{item.title}</strong>
        <span>
          {item.type}
          {item.status ? ` · ${item.status}` : ""}
        </span>
        {item.summary && <p>{item.summary}</p>}
        <small>{nodeSubtitle(item)}</small>
      </div>
    </article>
  );
}

function FilePreviewPanel({
  dock,
  onClose,
  onDockChange,
  onOpenPath,
  onResize,
  size,
  preview
}: {
  dock: PreviewDock;
  onClose: () => void;
  onDockChange: (dock: PreviewDock) => void;
  onOpenPath: (path: string) => void;
  onResize: (size: { right: number; bottom: number }) => void;
  size: { right: number; bottom: number };
  preview: FilePreviewState;
}) {
  if (preview.status === "idle") return null;

  return (
    <aside className="file-preview-panel">
      <button className={`preview-resize-handle ${dock}`} onDoubleClick={() => onResize(defaultPreviewSize())} onPointerDown={(event) => startPreviewResize(event, dock, size, onResize)} title={dock === "right" ? "Drag to resize preview width" : "Drag to resize preview height"} />
      <header>
        <div>
          <strong>{preview.title}</strong>
          <span>{preview.path}</span>
        </div>
        <div className="file-preview-actions">
          <button className={dock === "right" ? "active" : ""} onClick={() => onDockChange("right")} title="Dock right">
            Right
          </button>
          <button className={dock === "bottom" ? "active" : ""} onClick={() => onDockChange("bottom")} title="Dock bottom">
            Bottom
          </button>
          <button onClick={onClose} title="Close preview">
            ×
          </button>
        </div>
      </header>
      {preview.status === "loading" && <div className="file-preview-state">Loading file...</div>}
      {preview.status === "note" && (
        <div className="file-preview-state">
          {preview.summary || "This node is currently represented only in graph.yaml. Add file or files later when it needs longer notes."}
        </div>
      )}
      {preview.status === "error" && <div className="file-preview-state error">{preview.message}</div>}
      {preview.status === "ready" && (
        <>
          <div className="file-preview-meta">
            {preview.bytes.toLocaleString()} bytes · {preview.mimeType}
          </div>
          {preview.links.length > 1 && (
            <div className="file-preview-links" aria-label="Linked documents">
              {preview.links.map((link) => (
                <button key={link.path} className={link.path === preview.path ? "active" : ""} disabled={link.fileExists === false} onClick={() => onOpenPath(link.path)} title={link.path}>
                  {link.title || shortPath(link.path)}
                </button>
              ))}
            </div>
          )}
          <FilePreviewContent preview={preview} />
        </>
      )}
    </aside>
  );
}

function FilePreviewContent({ preview }: { preview: Extract<FilePreviewState, { status: "ready" }> }) {
  if (preview.format === "markdown") {
    return <MarkdownContent basePath={preview.path} className="file-preview-markdown" content={preview.content} />;
  }

  if (preview.format === "html") {
    return <iframe className="file-preview-html" sandbox="allow-same-origin" srcDoc={htmlWithWorkspaceBase(preview.path, preview.content)} title={preview.title} />;
  }

  return <pre>{preview.content}</pre>;
}

interface FilePreviewSnapshot {
  path: string;
  content: string;
  bytes: number;
  format: FilePreviewFormat;
  mimeType: string;
}

function CompactNodeContent({ item }: { item: LayoutResearchNode }) {
  return (
    <>
      <span className="node-dot" />
      <span className="node-caption">{item.title}</span>
    </>
  );
}

function FullNodeContent({ item, highlighted }: { item: LayoutResearchNode; highlighted: boolean }) {
  return (
    <>
      <header>
        <span className={`node-type type-${item.type}`}>{item.type}</span>
        {item.status && <span className={`node-status status-${item.status}`}>{item.status}</span>}
      </header>
      <h3>{item.title}</h3>
      {item.summary && <p>{item.summary}</p>}
      <footer>
        <span>{nodeSubtitle(item)}</span>
        {allLinkedFilesMissing(item) && <strong>missing files</strong>}
        {linkedFiles(item).length > 1 && <strong>{linkedFiles(item).length} docs</strong>}
        {highlighted && <strong>match</strong>}
      </footer>
    </>
  );
}

function readableEdgeLabel(edge: ResearchGraphEdge) {
  return edge.label || "";
}

function htmlWithWorkspaceBase(path: string, content: string) {
  const baseDir = path.split("/").slice(0, -1).map(encodeURIComponent).join("/");
  const base = `<base href="/api/workspace/raw-path/${baseDir ? `${baseDir}/` : ""}">`;
  if (/<head[\s>]/i.test(content)) {
    return content.replace(/<head([^>]*)>/i, `<head$1>${base}`);
  }
  return `${base}${content}`;
}

function defaultExpandedIds(graph: ResearchGraph) {
  return new Set(graph.ui?.expanded?.length ? graph.ui.expanded : [graph.rootId]);
}

function defaultPreviewSize() {
  return { right: 500, bottom: 340 };
}

function previewWorkspaceStyle(status: FilePreviewState["status"], dock: PreviewDock, size: { right: number; bottom: number }): CSSProperties | undefined {
  if (status === "idle") return undefined;
  if (dock === "right") {
    return { gridTemplateColumns: `minmax(0, 1fr) minmax(300px, ${size.right}px)` };
  }
  return { gridTemplateRows: `minmax(0, 1fr) minmax(220px, ${size.bottom}px)` };
}

function startPreviewResize(
  event: ReactPointerEvent<HTMLButtonElement>,
  dock: PreviewDock,
  size: { right: number; bottom: number },
  onResize: (size: { right: number; bottom: number }) => void
) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.setPointerCapture(event.pointerId);
  const startX = event.clientX;
  const startY = event.clientY;
  const start = { ...size };

  function onMove(moveEvent: PointerEvent) {
    if (dock === "right") {
      const next = clamp(start.right - (moveEvent.clientX - startX), 300, Math.max(360, window.innerWidth - 520));
      onResize({ ...start, right: next });
    } else {
      const next = clamp(start.bottom - (moveEvent.clientY - startY), 220, Math.max(260, window.innerHeight - 240));
      onResize({ ...start, bottom: next });
    }
  }

  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp, { once: true });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function nodeClassName(item: LayoutResearchNode, mode: GraphViewMode, extra = "") {
  return ["research-node", mode, `type-${item.type}`, allLinkedFilesMissing(item) ? "missing-file" : "", extra].filter(Boolean).join(" ");
}

function previewButtonTitle(node: LayoutResearchNode) {
  const links = linkedFiles(node);
  if (!links.length) return "Show graph.yaml summary";
  if (allLinkedFilesMissing(node)) return "All linked files are referenced by graph.yaml but do not exist yet";
  return links.length > 1 ? "Preview linked documents" : "Preview file";
}

function previewButtonLabel(node: LayoutResearchNode) {
  const links = linkedFiles(node);
  if (!links.length) return "Note";
  if (allLinkedFilesMissing(node)) return "Missing";
  return links.length > 1 ? "Docs" : "Open";
}

function linkedFiles(node: Pick<ResearchGraphNode, "file" | "fileExists" | "files">): ResearchGraphNodeFile[] {
  if (node.files?.length) return node.files;
  if (node.file) return [{ path: node.file, fileExists: node.fileExists }];
  return [];
}

function allLinkedFilesMissing(node: Pick<ResearchGraphNode, "file" | "fileExists" | "files">) {
  const links = linkedFiles(node);
  return links.length > 0 && links.every((link) => link.fileExists === false);
}

function nodeSubtitle(node: Pick<ResearchGraphNode, "id" | "file" | "fileExists" | "files">) {
  const links = linkedFiles(node);
  if (!links.length) return node.id;
  if (links.length === 1) return links[0].path;
  const existing = links.filter((link) => link.fileExists !== false).length;
  return `${existing}/${links.length} linked docs`;
}

function shortPath(path: string) {
  return path.split("/").pop() || path;
}

function GraphOverview({ layout, mode }: { layout: LayoutResearchGraph; mode: GraphViewMode }) {
  const nodeMetrics = mode === "full" ? { width: 310, height: 136, radius: 54 } : { width: 18, height: 18, radius: 9 };
  const points = layout.nodes.map((node) => ({
    ...node,
    cx: node.position.x + nodeMetrics.width / 2,
    cy: node.position.y + nodeMetrics.height / 2
  }));

  if (!points.length) return null;

  const byId = new Map(points.map((node) => [node.id, node]));
  const minX = Math.min(...points.map((node) => node.cx));
  const maxX = Math.max(...points.map((node) => node.cx));
  const minY = Math.min(...points.map((node) => node.cy));
  const maxY = Math.max(...points.map((node) => node.cy));
  const padding = Math.max(42, nodeMetrics.radius * 1.6);
  const viewBox = `${minX - padding} ${minY - padding} ${Math.max(maxX - minX + padding * 2, 1)} ${Math.max(maxY - minY + padding * 2, 1)}`;

  return (
    <svg className="graph-overview" viewBox={viewBox} aria-hidden="true">
      {layout.edges.map((edge) => {
        const source = byId.get(edge.from);
        const target = byId.get(edge.to);
        if (!source || !target) return null;
        return <line key={edge.id} x1={source.cx} y1={source.cy} x2={target.cx} y2={target.cy} className={`overview-edge kind-${edge.kind}`} />;
      })}
      {points.map((node) => (
        <circle key={node.id} cx={node.cx} cy={node.cy} r={nodeMetrics.radius} fill={nodeColor(node.type)} className="overview-node" />
      ))}
    </svg>
  );
}

function nodeColor(type?: ResearchNodeType) {
  if (type === "claim") return "#7c3aed";
  if (type === "evidence") return "#0f766e";
  if (type === "method") return "#b45309";
  if (type === "source") return "#2563eb";
  if (type === "task") return "#be123c";
  if (type === "concept") return "#475569";
  return "#111827";
}

function edgeColor(kind: ResearchGraphEdge["kind"]) {
  if (kind === "supports") return "#27847b";
  if (kind === "cites") return "#3b73c8";
  if (kind === "contradicts") return "#c9352b";
  if (kind === "leads_to") return "#8a6a15";
  return "#9aa3ad";
}

async function api<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || response.statusText);
  }
  return response.json() as Promise<T>;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error.";
}

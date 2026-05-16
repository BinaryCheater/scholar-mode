import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Background,
  Controls,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  buildGraphIndex,
  getExpandableDescendantIds,
  getExpandableNodeIds,
  getFocusedResearchGraph,
  getNextExpandedIdsForNodeClick,
  getVisibleResearchGraph,
  layoutResearchGraph,
  type GraphViewMode,
  type LayoutResearchNode,
  type ResearchGraph,
  type ResearchGraphNode
} from "../lib/researchGraph";
import { api, errorText } from "./api";
import { FilePreviewPanel } from "./graph/FilePreviewPanel";
import { GraphOverview } from "./graph/GraphOverview";
import { NodeContextMenu, NodeHoverCard, ResearchNodeCard, type ResearchFlowNode } from "./graph/ResearchNodeCard";
import {
  allLinkedFilesMissing,
  defaultExpandedIds,
  defaultPreviewSize,
  edgeColor,
  firstExistingLinkedFile,
  linkedFiles,
  nodeSubtitle,
  previewButtonLabel,
  previewButtonTitle,
  previewWorkspaceStyle,
  readableEdgeLabel,
  type FilePreviewSnapshot,
  type FilePreviewState,
  type PreviewDock
} from "./graph/graphUi";
import { sampleResearchGraph } from "./researchGraphData";

const nodeTypes = { research: ResearchNodeCard };
type FocusSubgraphState = { nodeId: string; includeAntecedents: boolean };
type NodeContextMenuState = { nodeId: string; x: number; y: number } | null;
type HoverCardState = { nodeId: string; x: number; y: number } | null;

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
  const [focusSubgraph, setFocusSubgraph] = useState<FocusSubgraphState | null>(null);
  const [contextMenu, setContextMenu] = useState<NodeContextMenuState>(null);
  const [hoverCard, setHoverCard] = useState<HoverCardState>(null);
  const closeHoverTimer = useRef<number | null>(null);
  const { fitView, setCenter } = useReactFlow<ResearchFlowNode, Edge>();
  const graphIndex = useMemo(() => buildGraphIndex(graph), [graph]);
  const searchResults = useMemo(() => graphIndex.search(query), [graphIndex, query]);
  const visible = useMemo(
    () =>
      focusSubgraph
        ? getFocusedResearchGraph(graph, { focusId: focusSubgraph.nodeId, includeAntecedents: focusSubgraph.includeAntecedents })
        : getVisibleResearchGraph(graph, { expandedIds, query }),
    [expandedIds, focusSubgraph, graph, query]
  );
  const layout = useMemo(() => layoutResearchGraph(visible, { direction: "LR", mode }), [mode, visible]);
  const matchedIds = useMemo(() => new Set(searchResults.map((node) => node.id)), [searchResults]);
  const expandableIds = useMemo(() => getExpandableNodeIds(graph), [graph]);
  const selectedContextNode = contextMenu ? layout.nodes.find((node) => node.id === contextMenu.nodeId) : undefined;
  const hoveredNode = hoverCard ? layout.nodes.find((node) => node.id === hoverCard.nodeId) : undefined;
  const focusNodeTitle = focusSubgraph ? graphIndex.byId.get(focusSubgraph.nodeId)?.title || focusSubgraph.nodeId : "";

  useEffect(() => {
    setExpandedIds(defaultExpandedIds(graph));
    setFocusSubgraph(null);
    setContextMenu(null);
    setHoverCard(null);
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
          mode
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
    setExpandedIds((current) => getNextExpandedIdsForNodeClick(graph, current, id));
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

  function openFocusSubgraph(id: string) {
    setFocusSubgraph({ nodeId: id, includeAntecedents: false });
    setContextMenu(null);
    window.setTimeout(() => fitView({ padding: 0.22, maxZoom: mode === "compact" ? 1.2 : 0.92, duration: 260 }), 80);
  }

  function toggleFocusAntecedents() {
    setFocusSubgraph((current) => (current ? { ...current, includeAntecedents: !current.includeAntecedents } : current));
    window.setTimeout(() => fitView({ padding: 0.22, maxZoom: mode === "compact" ? 1.2 : 0.92, duration: 260 }), 80);
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

  async function openWorkspaceFile(path: string) {
    await api<{ opened: boolean; path: string }>("/api/workspace/open", {
      method: "POST",
      body: JSON.stringify({ path })
    });
  }

  async function openWorkspaceFileWithError(path: string, title = path) {
    try {
      await openWorkspaceFile(path);
    } catch (error) {
      setPreview({ status: "error", path, title, message: errorText(error) });
    }
  }

  async function openNodeInBrowser(node: Pick<ResearchGraphNode, "file" | "fileExists" | "files">) {
    const target = firstExistingLinkedFile(node);
    if (!target) return;
    await openWorkspaceFileWithError(target.path, target.title || target.path);
  }

  function showHoverCard(id: string, x: number, y: number) {
    clearHoverCloseTimer();
    setHoverCard({ nodeId: id, x, y });
  }

  function scheduleHoverCardClose() {
    clearHoverCloseTimer();
    closeHoverTimer.current = window.setTimeout(() => setHoverCard(null), 140);
  }

  function clearHoverCloseTimer() {
    if (closeHoverTimer.current !== null) {
      window.clearTimeout(closeHoverTimer.current);
      closeHoverTimer.current = null;
    }
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
                  <button className="graph-index-open" onClick={() => void openNodePreview(node)} disabled={allLinkedFilesMissing(node)} aria-label={previewButtonTitle(node)}>
                    {previewButtonLabel(node)}
                  </button>
                  <button className="graph-index-browser" onClick={() => void openNodeInBrowser(node)} disabled={!firstExistingLinkedFile(node)} aria-label="Open linked document with the system default app">
                    File
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
            {focusSubgraph && (
              <div className="subgraph-toolbar">
                <div>
                  <strong>Focus: {focusNodeTitle}</strong>
                  <span>
                    {visible.nodes.length} nodes · {focusSubgraph.includeAntecedents ? "with antecedents" : "nearby"}
                  </span>
                </div>
                <button onClick={toggleFocusAntecedents}>{focusSubgraph.includeAntecedents ? "Hide antecedents" : "Show antecedents"}</button>
                <button onClick={() => setFocusSubgraph(null)}>Back to full graph</button>
              </div>
            )}
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              nodeTypes={nodeTypes}
              minZoom={0.25}
              maxZoom={1.7}
              fitView
              fitViewOptions={{ padding: 0.16, maxZoom: mode === "compact" ? 1.15 : 0.9 }}
              onNodeClick={(_, node) => {
                toggleNode(node.id);
                setContextMenu(null);
              }}
              onNodeContextMenu={(event, node) => {
                event.preventDefault();
                setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
              }}
              onNodeMouseEnter={(event, node) => showHoverCard(node.id, event.clientX, event.clientY)}
              onNodeMouseMove={(event, node) => showHoverCard(node.id, event.clientX, event.clientY)}
              onNodeMouseLeave={scheduleHoverCardClose}
              onPaneClick={() => {
                setContextMenu(null);
              }}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={28} size={1} color="#dce3ea" />
              <Controls position="bottom-right" />
            </ReactFlow>
            {hoverCard && hoveredNode && (
              <NodeHoverCard
                canBranch={(layout.childCounts[hoveredNode.id] || 0) > 0}
                expanded={expandedIds.has(hoveredNode.id)}
                isRoot={hoveredNode.id === graph.rootId}
                node={hoveredNode}
                onExpandBranch={expandBranch}
                onFocusSubgraph={openFocusSubgraph}
                onMouseEnter={clearHoverCloseTimer}
                onMouseLeave={scheduleHoverCardClose}
                onOpenBrowser={openNodeInBrowser}
                onOpenPreview={(node) => void openNodePreview(node)}
                onToggle={toggleNode}
                position={hoverCard}
                style={hoverCardStyle(hoverCard)}
              />
            )}
            {contextMenu && selectedContextNode && (
              <NodeContextMenu
                node={selectedContextNode}
                onClose={() => setContextMenu(null)}
                onExpandBranch={expandBranch}
                onFocusSubgraph={openFocusSubgraph}
                onOpenBrowser={openNodeInBrowser}
                onOpenPreview={(node) => void openNodePreview(node)}
                onToggle={toggleNode}
                position={contextMenu}
              />
            )}
            <GraphOverview layout={layout} mode={mode} />
          </div>
          <FilePreviewPanel
            dock={previewDock}
            onClose={() => setPreview({ status: "idle" })}
            onDockChange={setPreviewDock}
            onOpenFile={(path) => void openWorkspaceFileWithError(path, path)}
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

function hoverCardStyle(position: { x: number; y: number }): CSSProperties {
  const width = 400;
  const heightEstimate = 260;
  const margin = 14;
  const left = Math.min(position.x + 18, Math.max(margin, window.innerWidth - width - margin));
  const top = Math.min(position.y + 18, Math.max(margin, window.innerHeight - heightEstimate - margin));
  return { left, top, width };
}

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  type ResearchNodeType
} from "../lib/researchGraph";
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

export function ResearchGraphView({ error, graph = sampleResearchGraph, header }: { error?: string; graph?: ResearchGraph; header?: ReactNode }) {
  return (
    <ReactFlowProvider>
      <ResearchGraphCanvas error={error} graph={graph} header={header} />
    </ReactFlowProvider>
  );
}

function ResearchGraphCanvas({ error, graph, header }: { error?: string; graph: ResearchGraph; header?: ReactNode }) {
  const [expandedIds, setExpandedIds] = useState(() => new Set([graph.rootId, "rq.theory", "rq.method", "rq.evidence"]));
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<GraphViewMode>("compact");
  const { fitView, setCenter } = useReactFlow<ResearchFlowNode, Edge>();
  const graphIndex = useMemo(() => buildGraphIndex(graph), [graph]);
  const searchResults = useMemo(() => graphIndex.search(query), [graphIndex, query]);
  const visible = useMemo(() => getVisibleResearchGraph(graph, { expandedIds, query }), [expandedIds, graph, query]);
  const layout = useMemo(() => layoutResearchGraph(visible, { direction: "LR", mode }), [mode, visible]);
  const matchedIds = useMemo(() => new Set(searchResults.map((node) => node.id)), [searchResults]);
  const expandableIds = useMemo(() => getExpandableNodeIds(graph), [graph]);

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
        label: mode === "compact" ? compactEdgeLabel(edge) : edgeLabel(edge),
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
    const timer = window.setTimeout(() => fitView({ padding: 0.1, maxZoom: mode === "compact" ? 1.45 : 1.05, duration: 260 }), 80);
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

  return (
    <main className="app-shell graph-view">
      <aside className="graph-index-panel">
        <div className="graph-panel-header">
          <div>
            <strong>Research Graph</strong>
            <span>
              {visible.nodes.length}/{graph.nodes.length} nodes · {visible.edges.length} edges
            </span>
          </div>
          <button className="secondary-button compact" onClick={() => fitView({ padding: 0.1, maxZoom: mode === "compact" ? 1.45 : 1.05, duration: 260 })}>
            Fit
          </button>
        </div>

        <label className="graph-search">
          Index
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
            <button key={node.id} className={matchedIds.has(node.id) && query.trim() ? "graph-index-item match" : "graph-index-item"} onClick={() => focusNode(node)}>
              <span className={`node-type type-${node.type}`}>{node.type}</span>
              <strong>{node.title}</strong>
              <small>{node.file || node.id}</small>
            </button>
          ))}
        </div>
      </aside>

      <section className="chat-pane graph-active">
        {header}
        {error && <div className="error-banner">{error}</div>}
        <div className="graph-canvas">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            minZoom={0.25}
            maxZoom={1.7}
            fitView
            fitViewOptions={{ padding: 0.1, maxZoom: mode === "compact" ? 1.45 : 1.05 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={28} size={1} color="#dce3ea" />
            <Controls position="bottom-right" />
          </ReactFlow>
          <GraphOverview layout={layout} mode={mode} />
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
      className={selected ? `research-node ${data.mode} selected type-${item.type}` : `research-node ${data.mode} type-${item.type}`}
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
        <button className="node-toggle nodrag" onClick={() => data.onToggle(item.id)} title={data.expanded ? "Collapse node" : "Expand node"}>
          {data.expanded ? "−" : "+"}
        </button>
      )}
      {canBranch && (
        <button className="node-branch-toggle nodrag" onClick={() => data.onExpandBranch(item.id)} title="Expand full branch">
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
        <small>{item.file || item.id}</small>
      </div>
    </article>
  );
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
        <span>{item.file || item.id}</span>
        {highlighted && <strong>match</strong>}
      </footer>
    </>
  );
}

function edgeLabel(edge: ResearchGraphEdge) {
  return edge.label || edge.kind.replaceAll("_", " ");
}

function compactEdgeLabel(edge: ResearchGraphEdge) {
  if (edge.kind === "decomposes") return "";
  if (edge.kind === "leads_to") return "next";
  return edgeLabel(edge);
}

function GraphOverview({ layout, mode }: { layout: LayoutResearchGraph; mode: GraphViewMode }) {
  const nodeMetrics = mode === "full" ? { width: 260, height: 112, radius: 48 } : { width: 18, height: 18, radius: 9 };
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

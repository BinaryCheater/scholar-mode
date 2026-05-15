export type ResearchNodeType = "question" | "claim" | "evidence" | "method" | "concept" | "source" | "task" | "output";

export type ResearchEdgeKind =
  | "decomposes"
  | "answers"
  | "supports"
  | "contradicts"
  | "depends_on"
  | "operationalizes"
  | "cites"
  | "leads_to";

export interface ResearchGraphNode {
  id: string;
  title: string;
  type: ResearchNodeType;
  file?: string;
  fileExists?: boolean;
  files?: ResearchGraphNodeFile[];
  summary?: string;
  status?: "active" | "draft" | "blocked" | "done";
  tags?: string[];
}

export interface ResearchGraphNodeFile {
  path: string;
  title?: string;
  fileExists?: boolean;
}

export interface ResearchGraphEdge {
  id: string;
  from: string;
  to: string;
  kind: ResearchEdgeKind;
  label?: string;
}

export interface ResearchGraph {
  rootId: string;
  nodes: ResearchGraphNode[];
  edges: ResearchGraphEdge[];
  sourcePath?: string;
  warnings?: string[];
  ui?: {
    expanded?: string[];
    layout?: LayoutDirection;
  };
}

export interface VisibleResearchGraph {
  rootId: string;
  nodes: ResearchGraphNode[];
  edges: ResearchGraphEdge[];
  childCounts: Record<string, number>;
}

export type LayoutDirection = "TB" | "LR";

export interface LayoutResearchNode extends ResearchGraphNode {
  position: { x: number; y: number };
}

export interface LayoutResearchGraph {
  rootId: string;
  nodes: LayoutResearchNode[];
  edges: ResearchGraphEdge[];
  childCounts: Record<string, number>;
}

export type GraphViewMode = "compact" | "full";

export interface GraphIndex {
  nodes: ResearchGraphNode[];
  byId: Map<string, ResearchGraphNode>;
  search: (query: string) => ResearchGraphNode[];
}

const hierarchyEdgeKinds = new Set<ResearchEdgeKind>(["decomposes", "answers", "operationalizes", "leads_to"]);

export function buildGraphIndex(graph: ResearchGraph): GraphIndex {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));

  return {
    nodes: graph.nodes,
    byId,
    search(query: string) {
      const normalized = normalize(query);
      if (!normalized) return graph.nodes;
      return graph.nodes.filter((node) => searchableNodeText(node).includes(normalized));
    }
  };
}

export function getVisibleResearchGraph(graph: ResearchGraph, options: { expandedIds: Set<string>; query?: string }): VisibleResearchGraph {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const hierarchyEdges = graph.edges.filter((edge) => hierarchyEdgeKinds.has(edge.kind));
  const childrenByParent = groupEdges(hierarchyEdges, "from");
  const parentsByChild = groupEdges(hierarchyEdges, "to");
  const childCounts = Object.fromEntries(graph.nodes.map((node) => [node.id, childrenByParent.get(node.id)?.length || 0]));
  const visibleIds = new Set<string>();
  const query = normalize(options.query || "");

  if (query) {
    for (const node of graph.nodes) {
      if (!searchableNodeText(node).includes(query)) continue;
      visibleIds.add(node.id);
      for (const ancestorId of getAncestorIds(node.id, parentsByChild)) {
        visibleIds.add(ancestorId);
      }
    }
  } else {
    collectExpandedTree(graph.rootId, childrenByParent, options.expandedIds, visibleIds);
  }

  const nodes = graph.nodes.filter((node) => visibleIds.has(node.id));
  const edges = graph.edges.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to));

  return {
    rootId: graph.rootId,
    nodes,
    edges,
    childCounts
  };
}

export function getExpandableNodeIds(graph: ResearchGraph) {
  const hierarchyEdges = graph.edges.filter((edge) => hierarchyEdgeKinds.has(edge.kind));
  const parentIds = new Set(hierarchyEdges.map((edge) => edge.from));
  return graph.nodes.map((node) => node.id).filter((id) => parentIds.has(id));
}

export function getExpandableDescendantIds(graph: ResearchGraph, rootId: string) {
  const hierarchyEdges = graph.edges.filter((edge) => hierarchyEdgeKinds.has(edge.kind));
  const childrenByParent = groupEdges(hierarchyEdges, "from");
  const expandableIds = new Set(getExpandableNodeIds(graph));
  const result: string[] = [];
  const queue = [rootId];
  const seen = new Set<string>();

  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index];
    if (seen.has(id)) continue;
    seen.add(id);
    if (expandableIds.has(id)) result.push(id);

    for (const edge of childrenByParent.get(id) || []) {
      queue.push(edge.to);
    }
  }

  return result;
}

export function layoutResearchGraph(graph: VisibleResearchGraph, options: { direction: LayoutDirection; mode?: GraphViewMode }): LayoutResearchGraph {
  const hierarchyEdges = graph.edges.filter((edge) => hierarchyEdgeKinds.has(edge.kind));
  const childrenByParent = groupEdges(hierarchyEdges, "from");
  const depthById = new Map<string, number>([[graph.rootId, 0]]);
  const queue = [graph.rootId];

  for (let index = 0; index < queue.length; index += 1) {
    const parentId = queue[index];
    const parentDepth = depthById.get(parentId) || 0;
    for (const edge of childrenByParent.get(parentId) || []) {
      if (depthById.has(edge.to)) continue;
      depthById.set(edge.to, parentDepth + 1);
      queue.push(edge.to);
    }
  }

  const rows = new Map<number, ResearchGraphNode[]>();
  for (const node of graph.nodes) {
    const depth = depthById.get(node.id) ?? 0;
    rows.set(depth, [...(rows.get(depth) || []), node]);
  }

  const rowOffsets = new Map<string, number>();
  for (const [depth, nodes] of rows) {
    nodes.forEach((node, offset) => rowOffsets.set(node.id, offset - (nodes.length - 1) / 2));
    rows.set(depth, nodes);
  }

  const nodes = graph.nodes.map((node) => {
    const depth = depthById.get(node.id) ?? 0;
    const offset = rowOffsets.get(node.id) || 0;
    const spacing = options.mode === "full" ? { depth: 610, cross: 320 } : { depth: 300, cross: 160 };
    const position =
      options.direction === "LR" ? { x: depth * spacing.depth, y: offset * spacing.cross } : { x: offset * spacing.depth, y: depth * spacing.cross };
    return { ...node, position };
  });

  return {
    rootId: graph.rootId,
    nodes,
    edges: graph.edges,
    childCounts: graph.childCounts
  };
}

function collectExpandedTree(id: string, childrenByParent: Map<string, ResearchGraphEdge[]>, expandedIds: Set<string>, visibleIds: Set<string>) {
  visibleIds.add(id);
  if (!expandedIds.has(id)) return;

  for (const edge of childrenByParent.get(id) || []) {
    collectExpandedTree(edge.to, childrenByParent, expandedIds, visibleIds);
  }
}

function getAncestorIds(id: string, parentsByChild: Map<string, ResearchGraphEdge[]>) {
  const ancestors: string[] = [];
  const seen = new Set<string>();
  const queue = [id];

  for (let index = 0; index < queue.length; index += 1) {
    for (const edge of parentsByChild.get(queue[index]) || []) {
      if (seen.has(edge.from)) continue;
      seen.add(edge.from);
      ancestors.push(edge.from);
      queue.push(edge.from);
    }
  }

  return ancestors.reverse();
}

function groupEdges(edges: ResearchGraphEdge[], key: "from" | "to") {
  const grouped = new Map<string, ResearchGraphEdge[]>();
  for (const edge of edges) {
    grouped.set(edge[key], [...(grouped.get(edge[key]) || []), edge]);
  }
  return grouped;
}

function searchableNodeText(node: ResearchGraphNode) {
  return normalize([node.title, node.id, node.type, node.file, ...(node.files || []).map((file) => file.path), node.summary, ...(node.tags || [])].filter(Boolean).join(" "));
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

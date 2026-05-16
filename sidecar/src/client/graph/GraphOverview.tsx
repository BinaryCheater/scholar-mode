import type { GraphViewMode, LayoutResearchGraph } from "../../lib/researchGraph";
import { nodeColor } from "./graphUi";

export function GraphOverview({ layout, mode }: { layout: LayoutResearchGraph; mode: GraphViewMode }) {
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

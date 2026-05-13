import { describe, expect, it } from "vitest";
import {
  buildGraphIndex,
  getExpandableDescendantIds,
  getExpandableNodeIds,
  getVisibleResearchGraph,
  layoutResearchGraph,
  type ResearchGraph
} from "../src/lib/researchGraph";

const graph: ResearchGraph = {
  rootId: "rq.main",
  nodes: [
    { id: "rq.main", title: "Main research question", type: "question", file: "research/rq.main.md", summary: "Top-level framing." },
    { id: "rq.theory", title: "Theory mechanism", type: "question", file: "research/rq.theory.md" },
    { id: "rq.method", title: "Method design", type: "method", file: "research/rq.method.md" },
    { id: "claim.001", title: "Mechanism claim", type: "claim", file: "research/claim.001.md" },
    { id: "evidence.001", title: "Interview evidence", type: "evidence", file: "research/evidence.001.md" }
  ],
  edges: [
    { id: "e1", from: "rq.main", to: "rq.theory", kind: "decomposes" },
    { id: "e2", from: "rq.main", to: "rq.method", kind: "decomposes" },
    { id: "e3", from: "rq.theory", to: "claim.001", kind: "answers" },
    { id: "e4", from: "evidence.001", to: "claim.001", kind: "supports" }
  ]
};

describe("research graph view model", () => {
  it("hides descendants of collapsed nodes while preserving cross-links between visible nodes", () => {
    const visible = getVisibleResearchGraph(graph, { expandedIds: new Set(["rq.main"]) });

    expect(visible.nodes.map((node) => node.id)).toEqual(["rq.main", "rq.theory", "rq.method"]);
    expect(visible.edges.map((edge) => edge.id)).toEqual(["e1", "e2"]);
  });

  it("searches the node index and keeps matching ancestors in the visible graph", () => {
    const index = buildGraphIndex(graph);
    const searchResults = index.search("mechanism");
    const visible = getVisibleResearchGraph(graph, { expandedIds: new Set(), query: "mechanism" });

    expect(searchResults.map((node) => node.id)).toEqual(["rq.theory", "claim.001"]);
    expect(visible.nodes.map((node) => node.id)).toEqual(["rq.main", "rq.theory", "claim.001"]);
  });

  it("lays out the same graph differently when direction changes", () => {
    const visible = getVisibleResearchGraph(graph, { expandedIds: new Set(["rq.main", "rq.theory"]) });
    const topDown = layoutResearchGraph(visible, { direction: "TB" });
    const leftRight = layoutResearchGraph(visible, { direction: "LR" });

    expect(topDown.nodes.find((node) => node.id === "rq.theory")?.position.y).toBeGreaterThan(
      topDown.nodes.find((node) => node.id === "rq.main")?.position.y ?? 0
    );
    expect(leftRight.nodes.find((node) => node.id === "rq.theory")?.position.x).toBeGreaterThan(
      leftRight.nodes.find((node) => node.id === "rq.main")?.position.x ?? 0
    );
  });

  it("keeps sibling spacing compact for the graph overview", () => {
    const visible = getVisibleResearchGraph(graph, { expandedIds: new Set(["rq.main", "rq.theory"]) });
    const leftRight = layoutResearchGraph(visible, { direction: "LR", mode: "compact" });
    const yPositions = leftRight.nodes.map((node) => node.position.y);

    expect(Math.max(...yPositions) - Math.min(...yPositions)).toBeLessThanOrEqual(120);
  });

  it("uses roomier spacing for the full card view", () => {
    const visible = getVisibleResearchGraph(graph, { expandedIds: new Set(["rq.main", "rq.theory"]) });
    const full = layoutResearchGraph(visible, { direction: "LR", mode: "full" });
    const yPositions = full.nodes.map((node) => node.position.y);

    expect(Math.max(...yPositions) - Math.min(...yPositions)).toBeGreaterThanOrEqual(170);
  });

  it("returns expandable nodes for bulk and branch expansion controls", () => {
    expect(getExpandableNodeIds(graph)).toEqual(["rq.main", "rq.theory"]);
    expect(getExpandableDescendantIds(graph, "rq.main")).toEqual(["rq.main", "rq.theory"]);
    expect(getExpandableDescendantIds(graph, "rq.method")).toEqual([]);
  });
});

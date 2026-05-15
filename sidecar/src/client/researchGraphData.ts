import type { ResearchGraph } from "../lib/researchGraph";

export const sampleResearchGraph: ResearchGraph = {
  rootId: "rq.main",
  nodes: [
    {
      id: "rq.main",
      title: "Core research question",
      type: "question",
      summary: "What exactly has to be explained, bounded, and tested?",
      status: "active",
      tags: ["framing"]
    },
    {
      id: "rq.theory",
      title: "Theoretical mechanism",
      type: "question",
      summary: "Which mechanism makes the expected effect plausible?",
      status: "active",
      tags: ["theory", "mechanism"]
    },
    {
      id: "rq.method",
      title: "Method and identification",
      type: "method",
      summary: "How can the mechanism be observed without overclaiming?",
      status: "draft",
      tags: ["method"]
    },
    {
      id: "rq.evidence",
      title: "Evidence map",
      type: "evidence",
      summary: "Which sources support, weaken, or falsify the argument?",
      status: "active",
      tags: ["evidence"]
    },
    {
      id: "concept.001",
      title: "Boundary condition",
      type: "concept",
      summary: "Where the mechanism should stop applying.",
      status: "draft",
      tags: ["scope"]
    },
    {
      id: "claim.001",
      title: "Mechanism claim",
      type: "claim",
      summary: "A precise, falsifiable version of the central claim.",
      status: "active",
      tags: ["claim"]
    },
    {
      id: "source.001",
      title: "Anchor paper",
      type: "source",
      summary: "Closest prior work and vocabulary.",
      status: "done",
      tags: ["literature"]
    },
    {
      id: "source.html-demo",
      title: "External artifact",
      type: "source",
      summary: "A placeholder for a source document or rendered artifact.",
      status: "draft",
      tags: ["source"]
    },
    {
      id: "evidence.001",
      title: "Observed pattern",
      type: "evidence",
      summary: "A repeated observation that should be explained by the claim.",
      status: "draft",
      tags: ["observation"]
    },
    {
      id: "task.001",
      title: "Next reading pass",
      type: "task",
      summary: "Collect rival explanations before drafting.",
      status: "active",
      tags: ["next"]
    }
  ],
  edges: [
    { id: "edge.main.theory", from: "rq.main", to: "rq.theory", kind: "decomposes" },
    { id: "edge.main.method", from: "rq.main", to: "rq.method", kind: "decomposes" },
    { id: "edge.main.evidence", from: "rq.main", to: "rq.evidence", kind: "decomposes" },
    { id: "edge.theory.boundary", from: "rq.theory", to: "concept.001", kind: "decomposes" },
    { id: "edge.theory.claim", from: "rq.theory", to: "claim.001", kind: "answers" },
    { id: "edge.theory.source", from: "rq.theory", to: "source.001", kind: "cites" },
    { id: "edge.method.task", from: "rq.method", to: "task.001", kind: "leads_to" },
    { id: "edge.source.claim", from: "source.001", to: "claim.001", kind: "supports" },
    { id: "edge.evidence.html", from: "rq.evidence", to: "source.html-demo", kind: "cites" },
    { id: "edge.evidence.claim", from: "evidence.001", to: "claim.001", kind: "supports" },
    { id: "edge.evidence.pattern", from: "rq.evidence", to: "evidence.001", kind: "decomposes" },
    { id: "edge.source.theory", from: "source.001", to: "rq.theory", kind: "cites" }
  ]
};

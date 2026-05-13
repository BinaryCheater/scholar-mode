import type { ResearchGraph } from "../lib/researchGraph";

export const sampleResearchGraph: ResearchGraph = {
  rootId: "rq.main",
  nodes: [
    {
      id: "rq.main",
      title: "Core research question",
      type: "question",
      file: "research/rq.main.md",
      summary: "What exactly has to be explained, bounded, and tested?",
      status: "active",
      tags: ["framing"]
    },
    {
      id: "rq.theory",
      title: "Theoretical mechanism",
      type: "question",
      file: "research/rq.theory.md",
      summary: "Which mechanism makes the expected effect plausible?",
      status: "active",
      tags: ["theory", "mechanism"]
    },
    {
      id: "rq.method",
      title: "Method and identification",
      type: "method",
      file: "research/rq.method.md",
      summary: "How can the mechanism be observed without overclaiming?",
      status: "draft",
      tags: ["method"]
    },
    {
      id: "rq.evidence",
      title: "Evidence map",
      type: "evidence",
      file: "research/rq.evidence.md",
      summary: "Which sources support, weaken, or falsify the argument?",
      status: "active",
      tags: ["evidence"]
    },
    {
      id: "concept.001",
      title: "Boundary condition",
      type: "concept",
      file: "research/concept.boundary.md",
      summary: "Where the mechanism should stop applying.",
      status: "draft",
      tags: ["scope"]
    },
    {
      id: "claim.001",
      title: "Mechanism claim",
      type: "claim",
      file: "research/claim.mechanism.md",
      summary: "A precise, falsifiable version of the central claim.",
      status: "active",
      tags: ["claim"]
    },
    {
      id: "source.001",
      title: "Anchor paper",
      type: "source",
      file: "sources/papers/anchor-paper.md",
      summary: "Closest prior work and vocabulary.",
      status: "done",
      tags: ["literature"]
    },
    {
      id: "evidence.001",
      title: "Observed pattern",
      type: "evidence",
      file: "research/evidence.pattern.md",
      summary: "A repeated observation that should be explained by the claim.",
      status: "draft",
      tags: ["observation"]
    },
    {
      id: "task.001",
      title: "Next reading pass",
      type: "task",
      file: "research/tasks/reading-pass.md",
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
    { id: "edge.method.task", from: "rq.method", to: "task.001", kind: "leads_to" },
    { id: "edge.source.claim", from: "source.001", to: "claim.001", kind: "supports" },
    { id: "edge.evidence.claim", from: "evidence.001", to: "claim.001", kind: "supports" },
    { id: "edge.evidence.pattern", from: "rq.evidence", to: "evidence.001", kind: "decomposes" },
    { id: "edge.source.theory", from: "source.001", to: "rq.theory", kind: "cites" }
  ]
};

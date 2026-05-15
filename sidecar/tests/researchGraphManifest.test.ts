import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadResearchGraphManifest } from "../src/lib/researchGraphManifest";

async function makeWorkspace() {
  const root = join(tmpdir(), `sidecar-graph-${crypto.randomUUID()}`);
  await mkdir(root, { recursive: true });
  return root;
}

describe("research graph manifest", () => {
  it("loads graph.yaml as the authoritative graph structure and marks missing files", async () => {
    const root = await makeWorkspace();
    await mkdir(join(root, "research/tasks"), { recursive: true });
    await writeFile(
      join(root, "research/graph.yaml"),
      `root: rq.main
ui:
  expanded: [rq.main]
  layout: LR
nodes:
  - id: rq.main
    title: Core research question
    type: question
    file: ./rq.main.md
    status: active
    tags: [framing]
  - id: task.reading
    title: Reading pass
    type: task
    file: ./tasks/reading-pass.md
edges:
  - from: rq.main
    to: task.reading
    kind: leads_to
`,
      "utf8"
    );
    await writeFile(join(root, "research/rq.main.md"), "# Core research question\n", "utf8");

    const graph = await loadResearchGraphManifest(root);

    expect(graph.rootId).toBe("rq.main");
    expect(graph.sourcePath).toBe("research/graph.yaml");
    expect(graph.ui).toEqual({ expanded: ["rq.main"], layout: "LR" });
    expect(graph.nodes).toEqual([
      {
        id: "rq.main",
        title: "Core research question",
        type: "question",
        file: "research/rq.main.md",
        fileExists: true,
        files: [{ path: "research/rq.main.md", fileExists: true }],
        status: "active",
        tags: ["framing"]
      },
      {
        id: "task.reading",
        title: "Reading pass",
        type: "task",
        file: "research/tasks/reading-pass.md",
        fileExists: false,
        files: [{ path: "research/tasks/reading-pass.md", fileExists: false }]
      }
    ]);
    expect(graph.edges).toEqual([{ id: "rq.main->task.reading:leads_to", from: "rq.main", to: "task.reading", kind: "leads_to" }]);
    expect(graph.warnings).toEqual(["Missing file for node task.reading: research/tasks/reading-pass.md"]);

    await rm(root, { recursive: true, force: true });
  });

  it("uses markdown frontmatter as fallback metadata while keeping graph.yaml higher priority", async () => {
    const root = await makeWorkspace();
    await mkdir(join(root, "research"), { recursive: true });
    await writeFile(
      join(root, "research/graph.yaml"),
      `root: claim.mechanism
nodes:
  - id: claim.mechanism
    title: Manifest title
    type: claim
    file: ./claim.mechanism.md
edges: []
`,
      "utf8"
    );
    await writeFile(
      join(root, "research/claim.mechanism.md"),
      `---
id: claim.mechanism
title: Frontmatter title
type: evidence
status: draft
tags: [mechanism, claim]
summary: Frontmatter summary
---

# Claim
`,
      "utf8"
    );

    const graph = await loadResearchGraphManifest(root);

    expect(graph.nodes[0]).toMatchObject({
      id: "claim.mechanism",
      title: "Manifest title",
      type: "claim",
      status: "draft",
      tags: ["mechanism", "claim"],
      summary: "Frontmatter summary"
    });

    await rm(root, { recursive: true, force: true });
  });

  it("resolves manifest-relative file paths and keeps returned paths workspace-relative", async () => {
    const root = await makeWorkspace();
    await mkdir(join(root, "notes/subgraph"), { recursive: true });
    await mkdir(join(root, "sources"), { recursive: true });
    await writeFile(
      join(root, "notes/subgraph/graph.yaml"),
      `root: local.main
nodes:
  - id: local.main
    title: Local main
    type: question
    file: ./main.md
  - id: source.note
    title: Nearby source
    type: source
    file: ../../sources/source.md
edges:
  - from: local.main
    to: source.note
    kind: cites
`,
      "utf8"
    );
    await writeFile(join(root, "notes/subgraph/main.md"), "# Local main\n", "utf8");
    await writeFile(join(root, "sources/source.md"), "# Source\n", "utf8");

    const graph = await loadResearchGraphManifest(root, "notes/subgraph/graph.yaml");

    expect(graph.nodes.map((node) => node.file)).toEqual(["notes/subgraph/main.md", "sources/source.md"]);
    expect(graph.nodes.every((node) => node.fileExists)).toBe(true);

    await rm(root, { recursive: true, force: true });
  });

  it("allows summary-only nodes and nodes linked to multiple documents", async () => {
    const root = await makeWorkspace();
    await mkdir(join(root, "research/notes"), { recursive: true });
    await writeFile(
      join(root, "research/graph.yaml"),
      `root: rq.main
nodes:
  - id: rq.main
    title: Main question
    type: question
    summary: A one-sentence node that can be expanded later.
  - id: evidence.bundle
    title: Evidence bundle
    type: evidence
    summary: This node points at more than one document.
    files:
      - ./notes/evidence-a.md
      - path: ./notes/evidence-b.md
        title: Follow-up evidence
      - ./notes/missing.md
edges:
  - from: rq.main
    to: evidence.bundle
    kind: supports
`,
      "utf8"
    );
    await writeFile(join(root, "research/notes/evidence-a.md"), "# Evidence A\n", "utf8");
    await writeFile(join(root, "research/notes/evidence-b.md"), "# Evidence B\n", "utf8");

    const graph = await loadResearchGraphManifest(root);

    expect(graph.nodes[0]).toEqual({
      id: "rq.main",
      title: "Main question",
      type: "question",
      summary: "A one-sentence node that can be expanded later."
    });
    expect(graph.nodes[1]).toMatchObject({
      id: "evidence.bundle",
      title: "Evidence bundle",
      type: "evidence",
      file: "research/notes/evidence-a.md",
      fileExists: true,
      files: [
        { path: "research/notes/evidence-a.md", fileExists: true },
        { path: "research/notes/evidence-b.md", title: "Follow-up evidence", fileExists: true },
        { path: "research/notes/missing.md", fileExists: false }
      ]
    });
    expect(graph.warnings).toEqual(["Missing file for node evidence.bundle: research/notes/missing.md"]);

    await rm(root, { recursive: true, force: true });
  });

  it("rejects frontmatter ids that disagree with the manifest node id", async () => {
    const root = await makeWorkspace();
    await mkdir(join(root, "research"), { recursive: true });
    await writeFile(
      join(root, "research/graph.yaml"),
      `root: rq.main
nodes:
  - id: rq.main
    title: Main
    type: question
    file: ./rq.main.md
edges: []
`,
      "utf8"
    );
    await writeFile(join(root, "research/rq.main.md"), "---\nid: other.node\n---\n# Main\n", "utf8");

    await expect(loadResearchGraphManifest(root)).rejects.toThrow("Frontmatter id other.node does not match graph node rq.main");

    await rm(root, { recursive: true, force: true });
  });

  it("ships a workspace graph manifest for the demo research files", async () => {
    const graph = await loadResearchGraphManifest(join(process.cwd(), ".."));
    const manifest = await readFile(join(process.cwd(), "..", "research/graph.yaml"), "utf8");

    expect(manifest).toContain("root: rq.main");
    expect(graph.nodes.length).toBeGreaterThan(5);
    expect(graph.nodes.filter((node) => node.file && !node.fileExists)).toEqual([]);
  });
});

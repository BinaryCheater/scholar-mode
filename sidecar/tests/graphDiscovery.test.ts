import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverGraphManifests } from "../src/lib/graphDiscovery";
import { loadResearchGraphManifest } from "../src/lib/researchGraphManifest";

async function makeWorkspace() {
  const root = join(tmpdir(), `sidecar-discovery-${crypto.randomUUID()}`);
  await mkdir(root, { recursive: true });
  return root;
}

describe("graph discovery", () => {
  it("finds graph manifests across the workspace while ignoring dependency folders", async () => {
    const root = await makeWorkspace();
    try {
      await mkdir(join(root, "dingyi/synthetic/reports"), { recursive: true });
      await mkdir(join(root, "notes"), { recursive: true });
      await mkdir(join(root, "node_modules/pkg"), { recursive: true });
      await writeFile(
        join(root, "dingyi/synthetic/graph.yaml"),
        `root: rq.main
nodes:
  - id: rq.main
    title: Synthetic RQ
    type: question
    file: ./rq.main.md
  - id: evidence.report
    title: Report
    type: evidence
    file: reports/stage1.md
edges: []
`,
        "utf8"
      );
      await writeFile(join(root, "dingyi/synthetic/rq.main.md"), "# Main\n", "utf8");
      await writeFile(join(root, "dingyi/synthetic/reports/stage1.md"), "# Stage 1\n", "utf8");
      await writeFile(
        join(root, "notes/graph.yml"),
        `root: note.main
nodes:
  - id: note.main
    title: Notes
    type: question
edges: []
`,
        "utf8"
      );
      await writeFile(join(root, "node_modules/pkg/graph.yaml"), "root: ignored\nnodes: []\nedges: []\n", "utf8");

      const candidates = await discoverGraphManifests(root, "dingyi/synthetic/graph.yaml");

      expect(candidates.map((candidate) => candidate.path)).toEqual(["dingyi/synthetic/graph.yaml", "notes/graph.yml"]);
      expect(candidates[0]).toMatchObject({ selected: true, rootId: "rq.main", nodeCount: 2, title: "Synthetic RQ" });
      expect(candidates[1]).toMatchObject({ selected: false, rootId: "note.main", nodeCount: 1, title: "Notes" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("resolves ordinary graph links relative to the graph file and slash-prefixed links from the workspace root", async () => {
    const root = await makeWorkspace();
    try {
      await mkdir(join(root, "graphs/local/docs"), { recursive: true });
      await mkdir(join(root, "shared"), { recursive: true });
      await writeFile(
        join(root, "graphs/local/graph.yaml"),
        `root: local.main
nodes:
  - id: local.main
    title: Local main
    type: question
    file: docs/main.md
  - id: shared.note
    title: Shared note
    type: source
    file: /shared/source.md
edges: []
`,
        "utf8"
      );
      await writeFile(join(root, "graphs/local/docs/main.md"), "# Main\n", "utf8");
      await writeFile(join(root, "shared/source.md"), "# Source\n", "utf8");

      const graph = await loadResearchGraphManifest(root, "graphs/local/graph.yaml");

      expect(graph.nodes.map((node) => node.file)).toEqual(["graphs/local/docs/main.md", "shared/source.md"]);
      expect(graph.nodes.every((node) => node.fileExists)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

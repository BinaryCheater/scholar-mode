import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { installBundledSkills, installWorkspaceScaffold } from "../src/lib/workspaceInstall";

async function makeWorkspace() {
  const root = join(tmpdir(), `sidecar-install-${crypto.randomUUID()}`);
  await mkdir(root, { recursive: true });
  return root;
}

describe("workspace installation", () => {
  it("installs bundled skills into the workspace without overwriting user edits by default", async () => {
    const root = await makeWorkspace();
    try {
      const first = await installBundledSkills(root);
      const skillPath = join(root, "skills/sidecar-thinking/SKILL.md");
      const installed = await readFile(skillPath, "utf8");
      await writeFile(skillPath, "user edit\n", "utf8");
      const second = await installBundledSkills(root);
      const preserved = await readFile(skillPath, "utf8");
      const third = await installBundledSkills(root, { force: true });

      expect(first.installed).toContain("sidecar-thinking");
      expect(installed).toContain("name: sidecar-thinking");
      expect(second.skipped).toContain("sidecar-thinking");
      expect(preserved).toBe("user edit\n");
      expect(await readFile(skillPath, "utf8")).toContain("name: sidecar-thinking");
      expect(third.installed).toContain("sidecar-thinking");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("initializes .side config without requiring a starter graph", async () => {
    const root = await makeWorkspace();
    try {
      const result = await installWorkspaceScaffold(root, { graphManifestPath: "dingyi/synthetic/graph.yaml", createGraph: false, installSkills: false });
      const config = JSON.parse(await readFile(join(root, ".side/config.json"), "utf8"));
      const index = JSON.parse(await readFile(join(root, ".side/sessions/index.json"), "utf8"));

      expect(result.workspaceRoot).toBe(root);
      expect(config.graph.manifestPath).toBe("dingyi/synthetic/graph.yaml");
      expect(index).toEqual({ sessions: [] });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

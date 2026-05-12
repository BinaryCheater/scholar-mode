import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createWorkspaceTools } from "../src/lib/tools";

describe("workspace tools", () => {
  it("lists and reads files inside the workspace", async () => {
    const root = join(process.cwd(), ".tmp-tests", crypto.randomUUID());
    await mkdir(join(root, "notes"), { recursive: true });
    await writeFile(join(root, "notes", "claim.md"), "claim body");

    const tools = createWorkspaceTools(root);
    const list = await tools.execute("list_workspace_files", { pattern: "notes/*.md" });
    const read = await tools.execute("read_workspace_file", { path: "notes/claim.md" });

    expect(list).toContain("notes/claim.md");
    expect(read).toContain("claim body");
  });

  it("loads discovered skill instructions by name", async () => {
    const root = join(process.cwd(), ".tmp-tests", crypto.randomUUID());
    await mkdir(join(root, "skills", "research"), { recursive: true });
    await writeFile(
      join(root, "skills", "research", "SKILL.md"),
      "---\nname: research-review\ndescription: Use for research critique.\n---\n# Research Review"
    );

    const tools = createWorkspaceTools(root);
    const content = await tools.execute("load_skill", { name: "research-review" });

    expect(content).toContain("# Research Review");
  });
});

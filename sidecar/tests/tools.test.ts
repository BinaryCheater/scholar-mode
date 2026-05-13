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

  it("reads multiple workspace files in one tool call", async () => {
    const root = join(process.cwd(), ".tmp-tests", crypto.randomUUID());
    await mkdir(join(root, "notes"), { recursive: true });
    await writeFile(join(root, "notes", "one.md"), "first body");
    await writeFile(join(root, "notes", "two.md"), "second body");

    const tools = createWorkspaceTools(root);
    const read = await tools.execute("read_workspace_files", { paths: ["notes/one.md", "notes/two.md"] });

    expect(read).toContain("## notes/one.md");
    expect(read).toContain("first body");
    expect(read).toContain("## notes/two.md");
    expect(read).toContain("second body");
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

  it("writes only files allowed by the configured extension whitelist", async () => {
    const root = join(process.cwd(), ".tmp-tests", crypto.randomUUID());
    await mkdir(root, { recursive: true });

    const tools = createWorkspaceTools(root, { allowedWriteExtensions: [".md", ".html"] });
    const markdownResult = await tools.execute("write_workspace_file", {
      path: "notes/claim.md",
      content: "# Claim\n\nDraft body."
    });
    const htmlResult = await tools.execute("write_workspace_file", {
      path: "notes/demo.html",
      content: "<h1>Demo</h1>"
    });

    await expect(
      tools.execute("write_workspace_file", {
        path: "src/demo.ts",
        content: "export const demo = true;"
      })
    ).rejects.toThrow(/not allowed|code/i);

    expect(markdownResult).toContain("Wrote notes/claim.md");
    expect(htmlResult).toContain("Wrote notes/demo.html");
  });
});

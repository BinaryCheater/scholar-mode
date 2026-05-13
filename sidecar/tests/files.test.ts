import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readWorkspaceFile, resolveWorkspacePath, resolveWorkspaceRelativeLink } from "../src/lib/files";

describe("workspace file access", () => {
  it("resolves relative paths inside the configured workspace", async () => {
    const root = await makeTempWorkspace();
    await mkdir(join(root, "notes"), { recursive: true });
    await writeFile(join(root, "notes", "claim.md"), "claim body");

    const resolved = resolveWorkspacePath(root, "notes/claim.md");

    expect(resolved).toBe(join(root, "notes", "claim.md"));
  });

  it("rejects traversal outside the workspace", async () => {
    const root = await makeTempWorkspace();

    expect(() => resolveWorkspacePath(root, "../secret.txt")).toThrow(/outside/i);
  });

  it("reads file snapshots with metadata", async () => {
    const root = await makeTempWorkspace();
    await writeFile(join(root, "context.md"), "visible context");

    const snapshot = await readWorkspaceFile(root, "context.md");

    expect(snapshot.path).toBe("context.md");
    expect(snapshot.content).toBe("visible context");
    expect(snapshot.bytes).toBe(Buffer.byteLength("visible context"));
    expect(snapshot.format).toBe("markdown");
    expect(snapshot.mimeType).toBe("text/markdown");
  });

  it("identifies html snapshots for preview rendering", async () => {
    const root = await makeTempWorkspace();
    await writeFile(join(root, "demo.html"), "<h1>Demo</h1>");

    const snapshot = await readWorkspaceFile(root, "demo.html");

    expect(snapshot.format).toBe("html");
    expect(snapshot.mimeType).toBe("text/html");
  });

  it("resolves relative markdown and html links against the current document", () => {
    expect(resolveWorkspaceRelativeLink("research/rq.main.md", "./notes/source.md")).toBe("research/notes/source.md");
    expect(resolveWorkspaceRelativeLink("research/rq.main.md", "../sources/paper.html")).toBe("sources/paper.html");
    expect(resolveWorkspaceRelativeLink("research/rq.main.md", "https://example.com")).toBeNull();
    expect(resolveWorkspaceRelativeLink("research/rq.main.md", "#local-heading")).toBeNull();
  });
});

async function makeTempWorkspace() {
  const root = join(process.cwd(), ".tmp-tests", crypto.randomUUID());
  await mkdir(root, { recursive: true });
  return root;
}

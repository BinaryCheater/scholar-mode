import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getWorkspaceOpenCommand, readWorkspaceFile, readWorkspaceRawFile, resolveWorkspaceFileForOpen, resolveWorkspacePath, resolveWorkspaceRelativeLink } from "../src/lib/files";

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

  it("reads raw workspace assets as binary data with an image mime type", async () => {
    const root = await makeTempWorkspace();
    await mkdir(join(root, "assets"), { recursive: true });
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await writeFile(join(root, "assets", "figure.png"), pngHeader);

    const raw = await readWorkspaceRawFile(root, "assets/figure.png");

    expect(raw.path).toBe("assets/figure.png");
    expect(raw.content.equals(pngHeader)).toBe(true);
    expect(raw.mimeType).toBe("image/png");
  });

  it("resolves existing workspace files for OS open commands", async () => {
    const root = await makeTempWorkspace();
    await writeFile(join(root, "note.md"), "open me");

    const target = await resolveWorkspaceFileForOpen(root, "note.md");

    expect(target).toEqual({ path: "note.md", fullPath: join(root, "note.md") });
  });

  it("rejects directories for OS open commands", async () => {
    const root = await makeTempWorkspace();
    await mkdir(join(root, "notes"), { recursive: true });

    await expect(resolveWorkspaceFileForOpen(root, "notes")).rejects.toThrow(/not a file/i);
  });

  it("builds platform-specific OS open commands", () => {
    expect(getWorkspaceOpenCommand("/tmp/note.md", "darwin")).toEqual({ command: "open", args: ["/tmp/note.md"] });
    expect(getWorkspaceOpenCommand("/tmp/note.md", "linux")).toEqual({ command: "xdg-open", args: ["/tmp/note.md"] });
    expect(getWorkspaceOpenCommand("C:\\note.md", "win32")).toEqual({ command: "cmd", args: ["/c", "start", "", "C:\\note.md"] });
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

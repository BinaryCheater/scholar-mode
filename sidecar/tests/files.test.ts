import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readWorkspaceFile, resolveWorkspacePath } from "../src/lib/files";

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
  });
});

async function makeTempWorkspace() {
  const root = join(process.cwd(), ".tmp-tests", crypto.randomUUID());
  await mkdir(root, { recursive: true });
  return root;
}

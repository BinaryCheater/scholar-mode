import { readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { FileSnapshot } from "./types.js";

const MAX_FILE_BYTES = 512_000;

export function resolveWorkspacePath(workspaceRoot: string, requestedPath: string) {
  if (!requestedPath.trim()) {
    throw new Error("Path is required.");
  }

  if (isAbsolute(requestedPath)) {
    throw new Error("Use a path relative to the workspace root.");
  }

  const root = resolve(workspaceRoot);
  const target = resolve(root, requestedPath);
  const rel = relative(root, target);

  if (rel === "" || rel.startsWith("..") || rel.includes(`..${sep}`) || isAbsolute(rel)) {
    throw new Error("Requested path is outside the workspace.");
  }

  return target;
}

export async function readWorkspaceFile(workspaceRoot: string, requestedPath: string): Promise<FileSnapshot> {
  const fullPath = resolveWorkspacePath(workspaceRoot, requestedPath);
  const info = await stat(fullPath);

  if (!info.isFile()) {
    throw new Error("Requested path is not a file.");
  }

  if (info.size > MAX_FILE_BYTES) {
    throw new Error(`File is too large for the sidecar snapshot (${info.size} bytes).`);
  }

  const content = await readFile(fullPath, "utf8");

  return {
    id: crypto.randomUUID(),
    path: requestedPath,
    content,
    bytes: Buffer.byteLength(content),
    addedAt: new Date().toISOString()
  };
}

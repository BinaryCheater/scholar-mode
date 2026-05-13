import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import type { FileSnapshot } from "./types.js";

const MAX_FILE_BYTES = 512_000;
const CODE_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".go",
  ".java",
  ".js",
  ".jsx",
  ".mjs",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".swift",
  ".ts",
  ".tsx"
]);

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

export function toWorkspaceRelativePath(workspaceRoot: string, fullPath: string) {
  const root = resolve(workspaceRoot);
  const target = resolve(fullPath);
  const rel = relative(root, target);
  if (rel === "" || rel.startsWith("..") || rel.includes(`..${sep}`) || isAbsolute(rel)) {
    throw new Error("Requested path is outside the workspace.");
  }
  return rel.split(sep).join("/");
}

export function resolveWorkspaceRelativeLink(basePath: string, href: string) {
  const cleanHref = href.trim();
  if (!cleanHref || cleanHref.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(cleanHref) || cleanHref.startsWith("//")) {
    return null;
  }
  const [pathPart, suffix = ""] = splitLinkSuffix(cleanHref);
  if (!pathPart) return null;
  const baseDir = dirname(basePath);
  const next = normalize(join(baseDir, pathPart)).split(sep).join("/");
  if (next === "." || next.startsWith("../") || next === "..") {
    return null;
  }
  return `${next}${suffix}`;
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
    ...detectFilePreviewFormat(requestedPath),
    addedAt: new Date().toISOString()
  };
}

export async function writeWorkspaceFile(workspaceRoot: string, requestedPath: string, content: string, allowedExtensions: string[]) {
  assertWritableWorkspacePath(requestedPath, allowedExtensions);
  const fullPath = resolveWorkspacePath(workspaceRoot, requestedPath);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
  return {
    path: requestedPath,
    bytes: Buffer.byteLength(content)
  };
}

export function detectFilePreviewFormat(path: string): Pick<FileSnapshot, "format" | "mimeType"> {
  const extension = extname(path).toLowerCase();
  if (extension === ".md" || extension === ".markdown") {
    return { format: "markdown", mimeType: "text/markdown" };
  }
  if (extension === ".html" || extension === ".htm") {
    return { format: "html", mimeType: "text/html" };
  }
  return { format: "text", mimeType: "text/plain" };
}

function assertWritableWorkspacePath(path: string, allowedExtensions: string[]) {
  const extension = extname(path).toLowerCase();
  if (CODE_EXTENSIONS.has(extension)) {
    throw new Error(`Writing code files is not allowed (${extension}).`);
  }
  const normalized = allowedExtensions.map((item) => (item.startsWith(".") ? item : `.${item}`).toLowerCase());
  if (!normalized.includes(extension)) {
    throw new Error(`Writing ${extension || "extensionless"} files is not allowed. Allowed extensions: ${normalized.join(", ")}.`);
  }
}

function splitLinkSuffix(href: string): [string, string] {
  const hashIndex = href.indexOf("#");
  const queryIndex = href.indexOf("?");
  const candidates = [hashIndex, queryIndex].filter((index) => index >= 0);
  if (!candidates.length) return [href, ""];
  const index = Math.min(...candidates);
  return [href.slice(0, index), href.slice(index)];
}

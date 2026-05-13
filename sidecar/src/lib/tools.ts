import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readWorkspaceFile, resolveWorkspacePath } from "./files.js";
import { loadSkillByReference } from "./workspaceMeta.js";

const execFileAsync = promisify(execFile);

export interface WorkspaceToolCall {
  name: string;
  arguments: string | Record<string, unknown>;
}

export function createWorkspaceTools(workspaceRoot: string) {
  return {
    definitions: [
      {
        type: "function" as const,
        function: {
          name: "list_workspace_files",
          description: "List workspace files matching a simple substring or glob-like suffix pattern.",
          parameters: {
            type: "object",
            properties: {
              pattern: { type: "string", description: "Optional substring or simple pattern like notes/*.md." }
            },
            additionalProperties: false
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "read_workspace_file",
          description: "Read a UTF-8 text file by workspace-relative path.",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string", description: "Workspace-relative path to read." }
            },
            required: ["path"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "read_workspace_files",
          description:
            "Read several UTF-8 text files by workspace-relative path in one call. Prefer this over repeated single-file reads when comparing or reviewing multiple files.",
          parameters: {
            type: "object",
            properties: {
              paths: {
                type: "array",
                items: { type: "string" },
                minItems: 1,
                maxItems: 8,
                description: "Workspace-relative paths to read."
              }
            },
            required: ["paths"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "get_git_diff",
          description: "Return the current git diff for the workspace, optionally scoped to a path.",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string", description: "Optional workspace-relative path to diff." }
            },
            additionalProperties: false
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "load_skill",
          description:
            "Load the full SKILL.md instructions for a discovered workspace skill by exact skill name or workspace-relative SKILL.md path.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Exact skill name, such as scholar-mode." },
              path: { type: "string", description: "Workspace-relative path to a SKILL.md file." }
            },
            additionalProperties: false
          }
        }
      }
    ],
    async execute(name: string, rawArgs: string | Record<string, unknown>) {
      const args = parseArgs(rawArgs);
      if (name === "list_workspace_files") {
        const pattern = typeof args.pattern === "string" ? args.pattern : "";
        const files = await listFiles(workspaceRoot);
        return files.filter((file) => matchesPattern(file, pattern)).slice(0, 200).join("\n") || "No files matched.";
      }
      if (name === "read_workspace_file") {
        const path = requireString(args.path, "path");
        const snapshot = await readWorkspaceFile(workspaceRoot, path);
        return snapshot.content;
      }
      if (name === "read_workspace_files") {
        const paths = requireStringArray(args.paths, "paths").slice(0, 8);
        const snapshots = await Promise.all(paths.map((path) => readWorkspaceFile(workspaceRoot, path)));
        return snapshots.map((snapshot) => `## ${snapshot.path}\n\n${snapshot.content}`).join("\n\n---\n\n");
      }
      if (name === "get_git_diff") {
        const path = typeof args.path === "string" && args.path.trim() ? args.path.trim() : null;
        if (path) {
          resolveWorkspacePath(workspaceRoot, path);
        }
        const commandArgs = ["diff", "--", ...(path ? [path] : [])];
        const { stdout } = await execFileAsync("git", commandArgs, { cwd: workspaceRoot, maxBuffer: 1_000_000 });
        return stdout || "No git diff.";
      }
      if (name === "load_skill") {
        const reference = typeof args.name === "string" && args.name.trim() ? args.name : args.path;
        const snapshot = await loadSkillByReference(workspaceRoot, requireString(reference, "name or path"));
        return snapshot.content;
      }
      throw new Error(`Unknown tool: ${name}`);
    }
  };
}

function parseArgs(rawArgs: string | Record<string, unknown>) {
  if (typeof rawArgs === "string") {
    return rawArgs.trim() ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  }
  return rawArgs || {};
}

function requireString(value: unknown, name: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

function requireStringArray(value: unknown, name: string) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${name} must be a non-empty array.`);
  }
  return value.map((item, index) => requireString(item, `${name}[${index}]`));
}

async function listFiles(root: string, dir = ""): Promise<string[]> {
  const full = join(root, dir);
  const entries = await readdir(full, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "dist" || entry.name === "dist-server") {
      continue;
    }
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...(await listFiles(root, rel)));
    } else if (entry.isFile()) {
      results.push(relative(root, join(root, rel)));
    }
  }
  return results.sort();
}

function matchesPattern(file: string, pattern: string) {
  if (!pattern.trim()) {
    return true;
  }
  const normalized = pattern.replace(/^\.\//, "");
  if (normalized.includes("*")) {
    const [prefix, suffix] = normalized.split("*", 2);
    return file.startsWith(prefix) && file.endsWith(suffix || "");
  }
  return file.includes(normalized);
}

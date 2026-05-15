import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const scriptPath = join(process.cwd(), "scripts", "codex-sidecar.mjs");

let activeServer: ReturnType<typeof createServer> | null = null;

afterEach(async () => {
  if (activeServer) {
    await new Promise<void>((resolve, reject) => {
      activeServer?.close((error) => (error ? reject(error) : resolve()));
    });
    activeServer = null;
  }
});

describe("codex sidecar CLI", () => {
  it("installs sidecar workspace state, starter graph, and bundled skills into any directory", async () => {
    const workspace = join(process.cwd(), ".tmp-tests", crypto.randomUUID());

    const { stdout } = await execFileAsync("node", [scriptPath, "install", "--workspace", workspace, "--graph", "notes/maps/graph.yaml"]);

    const config = JSON.parse(await readFile(join(workspace, ".side", "config.json"), "utf8"));
    const index = JSON.parse(await readFile(join(workspace, ".side", "sessions", "index.json"), "utf8"));
    const graph = await readFile(join(workspace, "notes", "maps", "graph.yaml"), "utf8");
    const note = await readFile(join(workspace, "notes", "maps", "rq.main.md"), "utf8");
    const gitignore = await readFile(join(workspace, ".gitignore"), "utf8");
    const sidecarSkill = await readFile(join(workspace, "skills", "sidecar-thinking", "SKILL.md"), "utf8");
    const scholarSkill = await readFile(join(workspace, "skills", "scholar-mode", "SKILL.md"), "utf8");
    const graphSkill = await readFile(join(workspace, "skills", "research-graph-sop", "SKILL.md"), "utf8");
    const reportSkill = await readFile(join(workspace, "skills", "writing-explanatory-reports", "SKILL.md"), "utf8");

    expect(stdout).toContain("Research Sidecar workspace installed");
    expect(stdout).toContain(`Workspace: ${workspace}`);
    expect(stdout).toContain("Run from a home/user-level Sidecar install:");
    expect(stdout).toContain("Or, if the Sidecar app itself is copied into this workspace:");
    expect(config.graph.manifestPath).toBe("notes/maps/graph.yaml");
    expect(config.tools.allowedWriteExtensions).toEqual([".md", ".markdown", ".html", ".htm", ".yaml", ".yml"]);
    expect(index).toEqual({ sessions: [] });
    expect(graph).toContain("root: rq.main");
    expect(note).toContain("# Core research question");
    expect(gitignore).toContain(".side/");
    expect(sidecarSkill).toContain("name: sidecar-thinking");
    expect(scholarSkill).toContain("name: scholar-mode");
    expect(graphSkill).toContain("name: research-graph-sop");
    expect(reportSkill).toContain("name: writing-explanatory-reports");
  });

  it("does not overwrite existing graph files unless force is used", async () => {
    const workspace = join(process.cwd(), ".tmp-tests", crypto.randomUUID());
    await mkdir(join(workspace, "research"), { recursive: true });
    await writeFile(join(workspace, "research", "graph.yaml"), "root: existing\n", "utf8");

    await execFileAsync("node", [scriptPath, "install", "--workspace", workspace]);
    expect(await readFile(join(workspace, "research", "graph.yaml"), "utf8")).toBe("root: existing\n");

    await execFileAsync("node", [scriptPath, "install", "--workspace", workspace, "--force"]);
    expect(await readFile(join(workspace, "research", "graph.yaml"), "utf8")).toContain("root: rq.main");
  });

  it("creates a call session with context, files, and an optional user question", async () => {
    const requests: Array<{ method: string; url: string; body: unknown }> = [];
    activeServer = createServer(async (req, res) => {
      const body = await readJson(req);
      requests.push({ method: req.method || "GET", url: req.url || "/", body });

      if (req.method === "POST" && req.url === "/api/sessions") {
        writeJson(res, 201, { id: "session-123", title: body.title || "Codex call" });
        return;
      }

      if (req.method === "PATCH" && req.url === "/api/sessions/session-123") {
        writeJson(res, 200, { id: "session-123" });
        return;
      }

      if (req.method === "POST" && req.url === "/api/sessions/session-123/files") {
        writeJson(res, 201, { id: "session-123" });
        return;
      }

      if (req.method === "POST" && req.url === "/api/sessions/session-123/messages") {
        writeJson(res, 201, { id: "session-123" });
        return;
      }

      writeJson(res, 404, { error: "not found" });
    });

    await new Promise<void>((resolve) => activeServer?.listen(0, "127.0.0.1", resolve));
    const address = activeServer.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address.");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const { stdout } = await execFileAsync("node", [
      scriptPath,
      "call",
      "--url",
      baseUrl,
      "--title",
      "Claim review",
      "--context",
      "Current Codex context",
      "--file",
      "README.md",
      "--question",
      "What is the weakest assumption?"
    ]);

    expect(stdout).toContain("Sidecar session ready");
    expect(stdout).toContain("Session: session-123");
    expect(stdout).toContain(`Open: ${baseUrl}`);
    expect(requests).toEqual([
      { method: "POST", url: "/api/sessions", body: { title: "Claim review" } },
      { method: "PATCH", url: "/api/sessions/session-123", body: { manualContext: "Current Codex context" } },
      { method: "POST", url: "/api/sessions/session-123/files", body: { path: "README.md" } },
      {
        method: "POST",
        url: "/api/sessions/session-123/messages",
        body: { role: "user", content: "What is the weakest assumption?" }
      }
    ]);
  });

  it("offers an ask mode that streams the sidecar answer to stdout", async () => {
    const requests: Array<{ method: string; url: string; body: unknown }> = [];
    activeServer = createServer(async (req, res) => {
      const body = await readJson(req);
      requests.push({ method: req.method || "GET", url: req.url || "/", body });

      if (req.method === "POST" && req.url === "/api/sessions") {
        writeJson(res, 201, { id: "session-ask", title: body.title || "Codex ask" });
        return;
      }

      if (req.method === "PATCH" && req.url === "/api/sessions/session-ask") {
        writeJson(res, 200, { id: "session-ask" });
        return;
      }

      if (req.method === "POST" && req.url === "/api/sessions/session-ask/stream") {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        res.write(`data: ${JSON.stringify({ type: "delta", delta: "weakest " })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "delta", delta: "assumption" })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
        return;
      }

      writeJson(res, 404, { error: "not found" });
    });

    await new Promise<void>((resolve) => activeServer?.listen(0, "127.0.0.1", resolve));
    const address = activeServer.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address.");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const { stdout } = await execFileAsync("node", [
      scriptPath,
      "ask",
      "--url",
      baseUrl,
      "--title",
      "Ask review",
      "--context",
      "Current Codex context",
      "--question",
      "Answer directly"
    ]);

    expect(stdout).toContain("Sidecar session ready");
    expect(stdout).toContain("Sidecar answer:");
    expect(stdout).toContain("weakest assumption");
    expect(requests).toEqual([
      { method: "POST", url: "/api/sessions", body: { title: "Ask review" } },
      { method: "PATCH", url: "/api/sessions/session-ask", body: { manualContext: "Current Codex context" } },
      {
        method: "POST",
        url: "/api/sessions/session-ask/stream",
        body: { message: "Answer directly", enableTools: true, includeInstructionFiles: false }
      }
    ]);
  });
});

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function writeJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

import express from "express";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildContextPacket } from "../lib/context.js";
import { readWorkspaceFile } from "../lib/files.js";
import { DEFAULT_REVIEW_PROMPT } from "../lib/prompt.js";
import { streamOpenAIReview } from "../lib/openaiProvider.js";
import { JsonSessionStore } from "../lib/store.js";
import type { ApiMode } from "../lib/types.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const store = new JsonSessionStore(config.dataFile);
const app = express();
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const clientDist = resolve(__dirname, "../../dist/client");

app.use(express.json({ limit: "4mb" }));

app.get("/api/config", (_req, res) => {
  res.json({
    workspaceRoot: config.workspaceRoot,
    defaultModel: config.defaultModel,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY)
  });
});

app.get("/api/sessions", async (_req, res, next) => {
  try {
    res.json(await store.listSessions());
  } catch (error) {
    next(error);
  }
});

app.post("/api/sessions", async (req, res, next) => {
  try {
    const session = await store.createSession({
      title: req.body?.title,
      model: req.body?.model || config.defaultModel,
      apiMode: req.body?.apiMode || "responses"
    });
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

app.get("/api/sessions/:id", async (req, res, next) => {
  try {
    const session = await store.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    res.json(session);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/sessions/:id", async (req, res, next) => {
  try {
    const session = await store.updateSession(req.params.id, {
      title: req.body?.title,
      manualContext: req.body?.manualContext,
      reviewPrompt: req.body?.reviewPrompt || DEFAULT_REVIEW_PROMPT,
      model: req.body?.model,
      apiMode: req.body?.apiMode
    });
    res.json(session);
  } catch (error) {
    next(error);
  }
});

app.post("/api/sessions/:id/files", async (req, res, next) => {
  try {
    const snapshot = await readWorkspaceFile(config.workspaceRoot, req.body?.path || "");
    const session = await store.addFile(req.params.id, snapshot);
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/sessions/:id/files/:fileId", async (req, res, next) => {
  try {
    const session = await store.removeFile(req.params.id, req.params.fileId);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

app.post("/api/sessions/:id/stream", async (req, res, next) => {
  try {
    const session = await store.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found." });
      return;
    }

    const userMessage = String(req.body?.message || "").trim();
    if (!userMessage) {
      res.status(400).json({ error: "Message is required." });
      return;
    }

    const model = String(req.body?.model || session.model || config.defaultModel);
    const apiMode = normalizeApiMode(req.body?.apiMode || session.apiMode);
    const manualContext = String(req.body?.manualContext ?? session.manualContext);
    const reviewPrompt = String(req.body?.reviewPrompt || session.reviewPrompt || DEFAULT_REVIEW_PROMPT);
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      res.status(400).json({ error: "OPENAI_API_KEY is not set." });
      return;
    }

    await store.updateSession(session.id, { model, apiMode, manualContext, reviewPrompt });
    await store.addMessage(session.id, { role: "user", content: userMessage, source: "manual" });

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });

    let assistantContent = "";
    const contextPacket = buildContextPacket({
      reviewPrompt,
      manualContext,
      files: session.files,
      userMessage
    });

    await streamOpenAIReview({
      apiKey,
      apiMode,
      model,
      contextPacket,
      onDelta(delta) {
        assistantContent += delta;
        res.write(`data: ${JSON.stringify({ type: "delta", delta })}\n\n`);
      }
    });

    await store.addMessage(session.id, {
      role: "assistant",
      content: assistantContent,
      source: "model",
      model,
      apiMode
    });
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      next(error);
      return;
    }
    res.write(`data: ${JSON.stringify({ type: "error", error: errorMessage(error) })}\n\n`);
    res.end();
  }
});

app.use(express.static(clientDist));
app.get("*path", (_req, res) => {
  res.sendFile(resolve(clientDist, "index.html"));
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(400).json({ error: errorMessage(error) });
});

app.listen(config.port, () => {
  console.log(`Thinking Sidecar: http://localhost:${config.port}`);
  console.log(`Workspace root: ${config.workspaceRoot}`);
});

function normalizeApiMode(value: unknown): ApiMode {
  return value === "chat" ? "chat" : "responses";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error.";
}

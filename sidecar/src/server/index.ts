import express from "express";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildContextPacket } from "../lib/context.js";
import { readWorkspaceFile } from "../lib/files.js";
import { DEFAULT_REVIEW_PROMPT } from "../lib/prompt.js";
import { streamOpenAIReview } from "../lib/openaiProvider.js";
import { JsonSessionStore } from "../lib/store.js";
import { findInstructionFiles, scanWorkspaceSkills, selectTriggeredSkills } from "../lib/workspaceMeta.js";
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
    openaiBaseURL: config.openaiBaseURL || null,
    apiMode: config.apiMode,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY)
  });
});

app.get("/api/workspace", async (_req, res, next) => {
  try {
    res.json({
      instructionFiles: (await findInstructionFiles(config.workspaceRoot)).map(({ path, bytes }) => ({ path, bytes })),
      skills: await scanWorkspaceSkills(config.workspaceRoot)
    });
  } catch (error) {
    next(error);
  }
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
      apiMode: config.apiMode
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
      apiMode: config.apiMode
    });
    res.json(session);
  } catch (error) {
    next(error);
  }
});

app.post("/api/sessions/:id/messages/:messageId/edit", async (req, res, next) => {
  try {
    const content = String(req.body?.content || "").trim();
    if (!content) {
      res.status(400).json({ error: "Content is required." });
      return;
    }
    const session = await store.replaceMessageAndTruncate(req.params.id, req.params.messageId, content);
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
  const abortController = new AbortController();
  req.on("aborted", () => abortController.abort());
  res.on("close", () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

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
    const apiMode = config.apiMode;
    const manualContext = String(req.body?.manualContext ?? session.manualContext);
    const reviewPrompt = String(req.body?.reviewPrompt || session.reviewPrompt || DEFAULT_REVIEW_PROMPT);
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      res.status(400).json({ error: "OPENAI_API_KEY is not set." });
      return;
    }

    await store.updateSession(session.id, { model, apiMode, manualContext, reviewPrompt });
    const existingMessageId = typeof req.body?.existingMessageId === "string" ? req.body.existingMessageId : null;
    let history = session.messages;
    if (existingMessageId) {
      const existingIndex = session.messages.findIndex((message) => message.id === existingMessageId && message.role === "user");
      if (existingIndex < 0) {
        res.status(400).json({ error: "Existing user message not found." });
        return;
      }
      history = session.messages.slice(0, existingIndex);
    } else {
      await store.addMessage(session.id, { role: "user", content: userMessage, source: "manual" });
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });

    let assistantContent = "";
    const toolMessages: Array<{ name: string; content: string }> = [];
    const workspaceSkills = await scanWorkspaceSkills(config.workspaceRoot);
    const triggeredSkills = selectTriggeredSkills(workspaceSkills, `${manualContext}\n${userMessage}`);
    const instructionFiles = req.body?.includeInstructionFiles ? await findInstructionFiles(config.workspaceRoot) : [];
    if (triggeredSkills.length) {
      await store.addMessage(session.id, {
        role: "system",
        content: `Triggered workspace skills:\n\n${triggeredSkills.map((skill) => `- \`${skill.name}\` - ${skill.description || skill.path}`).join("\n")}`,
        source: "system"
      });
      res.write(`data: ${JSON.stringify({ type: "skills", skills: triggeredSkills })}\n\n`);
    }
    const contextPacket = buildContextPacket({
      reviewPrompt,
      manualContext,
      files: session.files,
      instructionFiles,
      workspaceSkills,
      triggeredSkills,
      history,
      userMessage
    });

    await streamOpenAIReview({
      apiKey,
      baseURL: config.openaiBaseURL,
      apiMode,
      model,
      contextPacket,
      workspaceRoot: config.workspaceRoot,
      enableTools: Boolean(req.body?.enableTools) && apiMode === "chat",
      signal: abortController.signal,
      onToolCall(name, args) {
        toolMessages.push({
          name,
          content: `Calling \`${name}\` with:\n\n\`\`\`json\n${args}\n\`\`\``
        });
        res.write(`data: ${JSON.stringify({ type: "tool_call", name, args })}\n\n`);
      },
      onToolResult(name, result) {
        toolMessages.push({
          name,
          content: `Result from \`${name}\`:\n\n\`\`\`\n${String(result).slice(0, 4000)}\n\`\`\``
        });
        res.write(`data: ${JSON.stringify({ type: "tool_result", name, result })}\n\n`);
      },
      onDelta(delta) {
        assistantContent += delta;
        res.write(`data: ${JSON.stringify({ type: "delta", delta })}\n\n`);
      }
    });

    for (const toolMessage of toolMessages) {
      await store.addMessage(session.id, {
        role: "tool",
        content: toolMessage.content,
        source: "model",
        toolName: toolMessage.name
      });
    }

    if (assistantContent.trim()) {
      await store.addMessage(session.id, {
        role: "assistant",
        content: assistantContent,
        source: "model",
        model,
        apiMode
      });
    }
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error.";
}

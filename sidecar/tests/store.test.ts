import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JsonSessionStore } from "../src/lib/store";

describe("session store", () => {
  it("creates sessions and persists messages", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sidecar-store-"));
    const store = new JsonSessionStore(join(dir, "sessions", "index.json"));

    const session = await store.createSession({ title: "Review loop" });
    await store.addMessage(session.id, {
      role: "user",
      content: "What is weak?",
      source: "manual"
    });

    const loaded = await store.getSession(session.id);

    expect(loaded?.title).toBe("Review loop");
    expect(loaded?.messages).toHaveLength(1);
    expect(loaded?.messages[0].content).toBe("What is weak?");

    const index = JSON.parse(await readFile(join(dir, "sessions", "index.json"), "utf8"));
    const sessionFile = JSON.parse(await readFile(join(dir, "sessions", `${session.id}.json`), "utf8"));
    expect(index.sessions[0].id).toBe(session.id);
    expect(index.sessions[0].messageCount).toBe(1);
    expect(index.sessions[0].messages).toBeUndefined();
    expect(sessionFile.messages[0].content).toBe("What is weak?");
  });

  it("stores file snapshots on a session", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sidecar-store-"));
    const store = new JsonSessionStore(join(dir, "sessions", "index.json"));
    const session = await store.createSession({ title: "Files" });

    await store.addFile(session.id, {
      path: "SKILL.md",
      content: "skill body",
      bytes: 10
    });

    const loaded = await store.getSession(session.id);

    expect(loaded?.files).toHaveLength(1);
    expect(loaded?.files[0].path).toBe("SKILL.md");
  });

  it("replaces a user message and truncates later messages", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sidecar-store-"));
    const store = new JsonSessionStore(join(dir, "sessions", "index.json"));
    const session = await store.createSession({ title: "Edit" });

    const first = await store.addMessage(session.id, {
      role: "user",
      content: "old question",
      source: "manual"
    });
    await store.addMessage(session.id, {
      role: "assistant",
      content: "old answer",
      source: "model"
    });

    await store.replaceMessageAndTruncate(session.id, first.messages[0].id, "new question");
    const loaded = await store.getSession(session.id);

    expect(loaded?.messages).toHaveLength(1);
    expect(loaded?.messages[0].content).toBe("new question");
  });

  it("migrates an old combined sessions file into index and per-session files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sidecar-store-"));
    const legacyFile = join(dir, "data", "sessions.json");
    const session = {
      id: "legacy-session",
      title: "Legacy",
      createdAt: "2026-05-13T00:00:00.000Z",
      updatedAt: "2026-05-13T00:00:01.000Z",
      manualContext: "",
      reviewPrompt: "Review",
      model: "deepseek-v4-pro",
      apiMode: "chat",
      files: [],
      messages: [{ id: "m1", role: "user", content: "old", createdAt: "2026-05-13T00:00:00.000Z", source: "manual" }]
    };
    await mkdir(join(dir, "data"), { recursive: true });
    await writeFile(legacyFile, JSON.stringify({ sessions: [session] }));

    const store = new JsonSessionStore(join(dir, ".side", "sessions", "index.json"), { legacyFile });
    const sessions = await store.listSessions();
    const loaded = await store.getSession("legacy-session");

    expect(sessions).toHaveLength(1);
    expect(sessions[0].messageCount).toBe(1);
    expect(loaded?.messages[0].content).toBe("old");
  });
});

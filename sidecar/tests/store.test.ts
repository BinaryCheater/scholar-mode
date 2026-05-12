import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JsonSessionStore } from "../src/lib/store";

describe("session store", () => {
  it("creates sessions and persists messages", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sidecar-store-"));
    const store = new JsonSessionStore(join(dir, "sessions.json"));

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
  });

  it("stores file snapshots on a session", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sidecar-store-"));
    const store = new JsonSessionStore(join(dir, "sessions.json"));
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
    const store = new JsonSessionStore(join(dir, "sessions.json"));
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
});

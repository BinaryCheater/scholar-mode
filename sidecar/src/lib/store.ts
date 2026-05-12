import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { DEFAULT_MODEL, DEFAULT_REVIEW_PROMPT } from "./prompt.js";
import type { FileSnapshot, SessionMessage, SidecarSession } from "./types.js";

interface StoreShape {
  sessions: SidecarSession[];
}

export class JsonSessionStore {
  constructor(private readonly filePath: string) {}

  async listSessions() {
    const data = await this.read();
    return data.sessions
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(({ messages, files, ...session }) => ({
        ...session,
        messageCount: messages.length,
        fileCount: files.length
      }));
  }

  async createSession(input: Partial<Pick<SidecarSession, "title" | "model" | "apiMode">> = {}) {
    const now = new Date().toISOString();
    const session: SidecarSession = {
      id: crypto.randomUUID(),
      title: input.title?.trim() || "Untitled review",
      createdAt: now,
      updatedAt: now,
      manualContext: "",
      reviewPrompt: DEFAULT_REVIEW_PROMPT,
      model: input.model || DEFAULT_MODEL,
      apiMode: input.apiMode || "responses",
      files: [],
      messages: []
    };

    const data = await this.read();
    data.sessions.push(session);
    await this.write(data);
    return session;
  }

  async getSession(id: string) {
    const data = await this.read();
    return data.sessions.find((session) => session.id === id) ?? null;
  }

  async updateSession(
    id: string,
    patch: Partial<Pick<SidecarSession, "title" | "manualContext" | "reviewPrompt" | "model" | "apiMode">>
  ) {
    return this.mutateSession(id, (session) => {
      Object.assign(session, compactPatch(patch));
    });
  }

  async addMessage(
    sessionId: string,
    input: Pick<SessionMessage, "role" | "content" | "source"> &
      Partial<Pick<SessionMessage, "model" | "apiMode" | "toolName" | "toolCallId">>
  ) {
    return this.mutateSession(sessionId, (session) => {
      session.messages.push({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        ...input
      });
    });
  }

  async replaceMessageAndTruncate(sessionId: string, messageId: string, content: string) {
    return this.mutateSession(sessionId, (session) => {
      const index = session.messages.findIndex((message) => message.id === messageId);
      if (index < 0) {
        throw new Error("Message not found.");
      }
      if (session.messages[index].role !== "user") {
        throw new Error("Only user messages can be edited.");
      }
      session.messages[index] = {
        ...session.messages[index],
        content,
        createdAt: new Date().toISOString()
      };
      session.messages = session.messages.slice(0, index + 1);
    });
  }

  async addFile(sessionId: string, input: Omit<FileSnapshot, "id" | "addedAt"> & Partial<Pick<FileSnapshot, "id" | "addedAt">>) {
    return this.mutateSession(sessionId, (session) => {
      session.files.push({
        id: input.id || crypto.randomUUID(),
        addedAt: input.addedAt || new Date().toISOString(),
        path: input.path,
        content: input.content,
        bytes: input.bytes
      });
    });
  }

  async removeFile(sessionId: string, fileId: string) {
    return this.mutateSession(sessionId, (session) => {
      session.files = session.files.filter((file) => file.id !== fileId);
    });
  }

  private async mutateSession(id: string, mutate: (session: SidecarSession) => void) {
    const data = await this.read();
    const session = data.sessions.find((candidate) => candidate.id === id);
    if (!session) {
      throw new Error("Session not found.");
    }
    mutate(session);
    session.updatedAt = new Date().toISOString();
    await this.write(data);
    return session;
  }

  private async read(): Promise<StoreShape> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw) as StoreShape;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { sessions: [] };
      }
      throw error;
    }
  }

  private async write(data: StoreShape) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${crypto.randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2));
    await rename(tmp, this.filePath);
  }
}

function compactPatch<T extends Record<string, unknown>>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Partial<T>;
}

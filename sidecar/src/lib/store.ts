import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { detectFilePreviewFormat } from "./files.js";
import { DEFAULT_MODEL, DEFAULT_REVIEW_PROMPT } from "./prompt.js";
import type { FileSnapshot, SessionMessage, SidecarSession } from "./types.js";

interface SessionIndex {
  sessions: SessionIndexEntry[];
}

interface SessionIndexEntry extends Omit<SidecarSession, "files" | "messages" | "manualContext" | "reviewPrompt"> {
  messageCount: number;
  fileCount: number;
}

export class JsonSessionStore {
  constructor(
    private readonly indexFile: string,
    private readonly options: { legacyFile?: string } = {}
  ) {}

  async listSessions() {
    const index = await this.readIndex();
    return index.sessions
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
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

    const index = await this.readIndex();
    index.sessions.push(toIndexEntry(session));
    await this.writeSession(session);
    await this.writeIndex(index);
    return session;
  }

  async getSession(id: string) {
    try {
      return await this.readSession(id);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
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

  async addFile(
    sessionId: string,
    input: Omit<FileSnapshot, "id" | "addedAt" | "format" | "mimeType"> & Partial<Pick<FileSnapshot, "id" | "addedAt" | "format" | "mimeType">>
  ) {
    return this.mutateSession(sessionId, (session) => {
      const previewFormat = input.format && input.mimeType ? { format: input.format, mimeType: input.mimeType } : detectFilePreviewFormat(input.path);
      session.files.push({
        id: input.id || crypto.randomUUID(),
        addedAt: input.addedAt || new Date().toISOString(),
        path: input.path,
        content: input.content,
        bytes: input.bytes,
        ...previewFormat
      });
    });
  }

  async removeFile(sessionId: string, fileId: string) {
    return this.mutateSession(sessionId, (session) => {
      session.files = session.files.filter((file) => file.id !== fileId);
    });
  }

  private async mutateSession(id: string, mutate: (session: SidecarSession) => void) {
    const session = await this.getSession(id);
    if (!session) throw new Error("Session not found.");
    mutate(session);
    session.updatedAt = new Date().toISOString();
    await this.writeSession(session);
    await this.upsertIndex(session);
    return session;
  }

  private async readIndex(): Promise<SessionIndex> {
    try {
      const raw = await readFile(this.indexFile, "utf8");
      return JSON.parse(raw) as SessionIndex;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const migrated = await this.migrateLegacyFile();
        if (migrated) return migrated;
        return { sessions: [] };
      }
      throw error;
    }
  }

  private async writeIndex(index: SessionIndex) {
    await atomicWriteJson(this.indexFile, index);
  }

  private async readSession(id: string): Promise<SidecarSession> {
    const raw = await readFile(this.sessionPath(id), "utf8");
    return JSON.parse(raw) as SidecarSession;
  }

  private async writeSession(session: SidecarSession) {
    await atomicWriteJson(this.sessionPath(session.id), session);
  }

  private async upsertIndex(session: SidecarSession) {
    const index = await this.readIndex();
    const next = toIndexEntry(session);
    const existing = index.sessions.findIndex((item) => item.id === session.id);
    if (existing >= 0) index.sessions[existing] = next;
    else index.sessions.push(next);
    await this.writeIndex(index);
  }

  private sessionPath(id: string) {
    return join(dirname(this.indexFile), `${id}.json`);
  }

  private async migrateLegacyFile(): Promise<SessionIndex | null> {
    if (!this.options.legacyFile) return null;
    try {
      const raw = await readFile(this.options.legacyFile, "utf8");
      const legacy = JSON.parse(raw) as { sessions?: SidecarSession[] };
      const sessions = Array.isArray(legacy.sessions) ? legacy.sessions : [];
      const index: SessionIndex = { sessions: sessions.map(toIndexEntry) };
      await Promise.all(sessions.map((session) => this.writeSession(session)));
      await this.writeIndex(index);
      return index;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
}

async function atomicWriteJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`);
    await rename(tmp, path);
  } catch (error) {
    await unlink(tmp).catch(() => undefined);
    throw error;
  }
}

function toIndexEntry(session: SidecarSession): SessionIndexEntry {
  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    model: session.model,
    apiMode: session.apiMode,
    messageCount: session.messages.length,
    fileCount: session.files.length
  };
}

function compactPatch<T extends Record<string, unknown>>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Partial<T>;
}

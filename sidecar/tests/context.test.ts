import { describe, expect, it } from "vitest";
import { buildContextPacket } from "../src/lib/context";
import { DEFAULT_REVIEW_PROMPT } from "../src/lib/prompt";

describe("context packet", () => {
  it("keeps manual notes, file snapshots, and the user request visibly separated", () => {
    const packet = buildContextPacket({
      reviewPrompt: DEFAULT_REVIEW_PROMPT,
      manualContext: "Codex summary here",
      files: [
        {
          id: "file-1",
          path: "notes/experiment.md",
          content: "metric: unstable",
          bytes: 16,
          addedAt: "2026-05-12T00:00:00.000Z"
        }
      ],
      history: [],
      userMessage: "Judge the next experiment."
    });

    expect(packet).toContain("Independent Thinking Protocol");
    expect(packet).toContain("Manual Context");
    expect(packet).toContain("notes/experiment.md");
    expect(packet).toContain("metric: unstable");
    expect(packet).toContain("User Request");
    expect(packet).toContain("Judge the next experiment.");
  });

  it("includes prior messages after stable context and before the current request", () => {
    const packet = buildContextPacket({
      reviewPrompt: DEFAULT_REVIEW_PROMPT,
      manualContext: "Stable project context",
      files: [],
      history: [
        {
          id: "u1",
          role: "user",
          content: "First question",
          createdAt: "2026-05-12T00:00:00.000Z",
          source: "manual"
        },
        {
          id: "a1",
          role: "assistant",
          content: "First answer",
          createdAt: "2026-05-12T00:00:01.000Z",
          source: "model"
        }
      ],
      userMessage: "Second question"
    });

    expect(packet.indexOf("Stable project context")).toBeLessThan(packet.indexOf("Conversation History"));
    expect(packet.indexOf("Conversation History")).toBeLessThan(packet.indexOf("Current User Request"));
    expect(packet).toContain("User: First question");
    expect(packet).toContain("Assistant: First answer");
    expect(packet).toContain("Second question");
  });
});

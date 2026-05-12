import { describe, expect, it } from "vitest";
import { chooseApiMode } from "../src/server/config";

describe("api routing", () => {
  it("uses responses for the official OpenAI endpoint", () => {
    expect(chooseApiMode(undefined)).toBe("responses");
    expect(chooseApiMode("https://api.openai.com/v1")).toBe("responses");
  });

  it("uses chat completions for OpenAI-compatible non-OpenAI endpoints", () => {
    expect(chooseApiMode("https://api.deepseek.com")).toBe("chat");
    expect(chooseApiMode("http://localhost:4000/v1")).toBe("chat");
  });
});

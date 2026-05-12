import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/server/config";

describe("server config", () => {
  it("accepts an OpenAI-compatible base URL without changing provider shape", () => {
    const config = loadConfig({
      env: {
        OPENAI_BASE_URL: "https://api.deepseek.com",
        SIDECAR_DEFAULT_MODEL: "deepseek-v4-pro",
        PORT: "4999"
      }
    });

    expect(config.openaiBaseURL).toBe("https://api.deepseek.com");
    expect(config.defaultModel).toBe("deepseek-v4-pro");
    expect(config.port).toBe(4999);
  });
});

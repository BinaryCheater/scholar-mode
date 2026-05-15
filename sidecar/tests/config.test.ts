import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  it("stores app config and session state under the workspace .side directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "sidecar-config-"));
    try {
      const config = loadConfig({
        env: {
          SIDECAR_WORKSPACE_ROOT: root,
          SIDECAR_GRAPH_MANIFEST: "notes/maps/main.yaml",
          SIDECAR_DEFAULT_MODEL: "deepseek-v4-pro",
          OPENAI_BASE_URL: "https://api.deepseek.com",
          OPENAI_API_KEY: "test-key"
        }
      });

      expect(config.sideDir).toBe(join(root, ".side"));
      expect(config.dataFile).toBe(join(root, ".side", "sessions", "index.json"));
      expect(config.graphManifestPath).toBe("notes/maps/main.yaml");
      expect(config.defaultModel).toBe("deepseek-v4-pro");
      expect(config.openaiAPIKey).toBe("test-key");
      expect(config.allowedWriteExtensions).toEqual([".md", ".markdown", ".html", ".htm", ".yaml", ".yml"]);

      const persisted = JSON.parse(await readFile(join(root, ".side", "config.json"), "utf8"));
      expect(persisted.defaultModel).toBe("deepseek-v4-pro");
      expect(persisted.graph.manifestPath).toBe("notes/maps/main.yaml");
      expect(persisted.openaiAPIKey).toBe("test-key");
      expect(persisted.tools.allowedWriteExtensions).toEqual([".md", ".markdown", ".html", ".htm", ".yaml", ".yml"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses the launch cwd as the workspace root when no override is provided", async () => {
    const root = await mkdtemp(join(tmpdir(), "sidecar-cwd-"));
    const previous = process.cwd();
    try {
      process.chdir(root);
      const cwd = process.cwd();
      const config = loadConfig({ env: {} });

      expect(config.workspaceRoot).toBe(cwd);
      expect(config.sideDir).toBe(join(cwd, ".side"));
      expect(JSON.parse(await readFile(join(cwd, ".side", "config.json"), "utf8")).graph.manifestPath).toBe("research/graph.yaml");
    } finally {
      process.chdir(previous);
      await rm(root, { recursive: true, force: true });
    }
  });

  it("updates only the selected graph path in the workspace config file", async () => {
    const root = await mkdtemp(join(tmpdir(), "sidecar-config-update-"));
    try {
      const config = loadConfig({
        env: {
          SIDECAR_WORKSPACE_ROOT: root,
          SIDECAR_DEFAULT_MODEL: "deepseek-v4-pro",
          OPENAI_BASE_URL: "https://api.deepseek.com",
          OPENAI_API_KEY: "test-key"
        }
      });

      const { updateGraphManifestPath } = await import("../src/server/config");
      const next = updateGraphManifestPath(config, "dingyi/synthetic/graph.yaml");

      expect(next.graphManifestPath).toBe("dingyi/synthetic/graph.yaml");
      expect(next.defaultModel).toBe("deepseek-v4-pro");
      expect(next.openaiAPIKey).toBe("test-key");

      const persisted = JSON.parse(await readFile(join(root, ".side", "config.json"), "utf8"));
      expect(persisted.graph.manifestPath).toBe("dingyi/synthetic/graph.yaml");
      expect(persisted.defaultModel).toBe("deepseek-v4-pro");
      expect(persisted.openaiAPIKey).toBe("test-key");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

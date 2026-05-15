#!/usr/bin/env node

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const command = args[0] && !args[0].startsWith("-") ? args[0] : "start";
const commandArgs = command === "start" ? args : args.slice(1);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

if (command === "help" || commandArgs.includes("--help") || commandArgs.includes("-h")) {
  printHelp();
  process.exit(0);
}

if (command === "init") {
  const workspaceRoot = resolve(readOption(commandArgs, "--workspace") || process.cwd());
  const graphManifestPath = readOption(commandArgs, "--graph") || "research/graph.yaml";
  const { installWorkspaceScaffold } = await import(pathToFileURL(resolve(packageRoot, "dist-server/lib/workspaceInstall.js")).href);
  const result = await installWorkspaceScaffold(workspaceRoot, {
    graphManifestPath,
    createGraph: !commandArgs.includes("--no-graph"),
    installSkills: !commandArgs.includes("--no-skills"),
    force: commandArgs.includes("--force")
  });
  console.log("Research Sidecar workspace initialized");
  console.log(`Workspace: ${result.workspaceRoot}`);
  console.log(`Config: ${result.configPath}`);
  console.log(`Graph: ${result.graphManifestPath}${commandArgs.includes("--no-graph") ? " (not created)" : ""}`);
  process.exit(0);
}

if (command === "install-skills") {
  const workspaceRoot = resolve(readOption(commandArgs, "--workspace") || process.cwd());
  const { installBundledSkills } = await import(pathToFileURL(resolve(packageRoot, "dist-server/lib/workspaceInstall.js")).href);
  const result = await installBundledSkills(workspaceRoot, { force: commandArgs.includes("--force") });
  console.log("Research Sidecar workspace skills installed");
  console.log(`Workspace: ${workspaceRoot}`);
  console.log(`Installed: ${result.installed.length ? result.installed.join(", ") : "none"}`);
  console.log(`Skipped: ${result.skipped.length ? result.skipped.join(", ") : "none"}`);
  process.exit(0);
}

if (command !== "start") {
  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

const workspaceRoot = resolve(readOption(commandArgs, "--workspace") || process.cwd());
const graphManifestPath = readOption(commandArgs, "--graph");
const port = readOption(commandArgs, "--port");
const serverEntry = resolve(packageRoot, "dist-server/server/index.js");
const child = spawn(process.execPath, [serverEntry], {
  cwd: packageRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    SIDECAR_WORKSPACE_ROOT: workspaceRoot,
    ...(graphManifestPath ? { SIDECAR_GRAPH_MANIFEST: graphManifestPath } : {}),
    ...(port ? { PORT: port } : {})
  }
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

function readOption(values, name) {
  const index = values.indexOf(name);
  if (index < 0) return undefined;
  return values[index + 1];
}

function printHelp() {
  console.log(`Usage:
  research-sidecar [--workspace /path/to/workspace] [--graph path/to/graph.yaml] [--port 4317]
  research-sidecar init [--graph path/to/graph.yaml] [--no-graph] [--no-skills] [--force]
  research-sidecar install-skills [--force]

Default behavior:
  The directory where you run research-sidecar becomes the workspace.
  Workspace config is stored in .side/config.json.
`);
}

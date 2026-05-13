#!/usr/bin/env node

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.url || "http://localhost:4317";

if (args.help) {
  console.log(`Usage:
  npm run codex:call -- --title "Review" --context "Codex summary" --file SKILL.md --question "What should the sidecar inspect?"
  npm run codex:ask -- --title "Review" --context "Codex summary" --question "What is the weakest assumption?"
  npm run codex:session -- --title "Review" --context "Codex summary" --file SKILL.md --file notes.md

Options:
  --url       Sidecar server URL. Default: http://localhost:4317
  --title     Session title.
  --context   Manual context packet notes.
  --file      Workspace-relative file path. Repeatable.
  --question  Optional user question for call mode; required prompt for ask mode.
  --model     Model string. Default server model is used when omitted.
  --api       responses or chat.
`);
  process.exit(0);
}

if (args.command !== "call" && args.command !== "session" && args.command !== "ask") {
  throw new Error(`Unknown command: ${args.command}`);
}

const session = await request(`${baseUrl}/api/sessions`, {
  method: "POST",
  body: JSON.stringify({
    title: args.title || "Codex handoff",
    model: args.model,
    apiMode: args.api
  })
});

if (args.context) {
  await request(`${baseUrl}/api/sessions/${session.id}`, {
    method: "PATCH",
    body: JSON.stringify({ manualContext: args.context })
  });
}

for (const file of args.files) {
  await request(`${baseUrl}/api/sessions/${session.id}/files`, {
    method: "POST",
    body: JSON.stringify({ path: file })
  });
}

if (args.command !== "ask" && args.question) {
  await request(`${baseUrl}/api/sessions/${session.id}/messages`, {
    method: "POST",
    body: JSON.stringify({ role: "user", content: args.question })
  });
}

console.log("Sidecar session ready");
console.log(`${baseUrl}`);
console.log(`Session: ${session.id}`);
console.log(`Open: ${baseUrl}`);

if (args.command === "ask") {
  if (!args.question) {
    throw new Error("--question is required for ask mode.");
  }
  console.log("");
  console.log("Sidecar answer:");
  await streamAnswer(`${baseUrl}/api/sessions/${session.id}/stream`, {
    message: args.question,
    enableTools: true,
    includeInstructionFiles: false
  });
  console.log("");
}

function parseArgs(raw) {
  const parsed = { command: "call", files: [] };
  const first = raw[0];
  const start = first && !first.startsWith("-") ? 1 : 0;
  if (start) {
    parsed.command = first;
  }
  for (let i = start; i < raw.length; i += 1) {
    const key = raw[i];
    const value = raw[i + 1];
    if (key === "--help" || key === "-h") parsed.help = true;
    if (key === "--url") parsed.url = value, i += 1;
    if (key === "--title") parsed.title = value, i += 1;
    if (key === "--context") parsed.context = value, i += 1;
    if (key === "--file") parsed.files.push(value), i += 1;
    if (key === "--question") parsed.question = value, i += 1;
    if (key === "--model") parsed.model = value, i += 1;
    if (key === "--api") parsed.api = value, i += 1;
  }
  return parsed;
}

async function request(url, init) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || response.statusText);
  }
  return response.json();
}

async function streamAnswer(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok || !response.body) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || response.statusText);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";
    for (const frame of frames) {
      if (!frame.startsWith("data: ")) {
        continue;
      }
      const payload = JSON.parse(frame.slice(6));
      if (payload.type === "delta") {
        process.stdout.write(payload.delta);
      }
      if (payload.type === "error") {
        throw new Error(payload.error);
      }
    }
  }
}

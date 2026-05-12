#!/usr/bin/env node

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.url || "http://localhost:4317";

if (args.help) {
  console.log(`Usage:
  npm run codex:session -- --title "Review" --context "Codex summary" --file SKILL.md --file notes.md

Options:
  --url       Sidecar server URL. Default: http://localhost:4317
  --title     Session title.
  --context   Manual context packet notes.
  --file      Workspace-relative file path. Repeatable.
  --model     Model string. Default server model is used when omitted.
  --api       responses or chat.
`);
  process.exit(0);
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

console.log(`${baseUrl}`);
console.log(`Session: ${session.id}`);
console.log(`Open: ${baseUrl}`);

function parseArgs(raw) {
  const parsed = { files: [] };
  for (let i = 0; i < raw.length; i += 1) {
    const key = raw[i];
    const value = raw[i + 1];
    if (key === "--help" || key === "-h") parsed.help = true;
    if (key === "--url") parsed.url = value, i += 1;
    if (key === "--title") parsed.title = value, i += 1;
    if (key === "--context") parsed.context = value, i += 1;
    if (key === "--file") parsed.files.push(value), i += 1;
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

# Thinking Sidecar

A local web sidecar for explicit-context reasoning beside Codex. It keeps context transparent: paste a Codex summary, attach workspace-relative file snapshots, then ask an independent review model to challenge the claim, assumptions, rival explanations, weak links, and next evidence.

## Run

```bash
cd sidecar
cp .env.example .env
OPENAI_API_KEY=sk-... npm run dev
```

Open `http://localhost:4317`.

Useful environment variables:

- `OPENAI_API_KEY`: required for model calls.
- `OPENAI_BASE_URL`: optional OpenAI-compatible endpoint, for example `https://api.deepseek.com`.
- `SIDECAR_WORKSPACE_ROOT`: file-read root. Defaults to the parent of `sidecar`.
- `SIDECAR_DEFAULT_MODEL`: defaults to `gpt-5.5`.
- `PORT`: defaults to `4317`.

## API Modes

- `responses`: OpenAI Responses API, streaming text deltas.
- `chat`: Chat Completions API, streaming text deltas.

The provider layer is intentionally small. Tool use is not wired into the first UI path, but the code keeps a `ToolAdapter` seam for future model tools, LangGraph, or Deep Agents orchestration.

For OpenAI-compatible providers such as DeepSeek, set:

```bash
OPENAI_BASE_URL=https://api.deepseek.com
SIDECAR_DEFAULT_MODEL=deepseek-v4-pro
```

Then use `chat` mode in the UI.

## Context And Caching

Each request is self-contained. The server sends the review protocol, manual context, file snapshots, prior session messages, and the current user request together. Stable protocol/context/file content is placed before conversation history and the current request so providers with automatic prompt/context caching can reuse the longest unchanged prefix.

The UI renders assistant messages as Markdown and keeps streaming state per session, so switching sessions during generation does not move partial output into the wrong chat. Use `Stop` to abort an in-flight answer. Edit the context or prompt, then use `Rerun` to answer the previous user request again with the updated context.

## Codex Handoff

With the sidecar server running:

```bash
npm run codex:session -- --title "Skill review" --context "Codex summary..." --file SKILL.md --file README.md
```

This creates a session, stores the explicit context, snapshots the listed files, and prints the URL.

## Tests

```bash
npm test
npm run typecheck
npm run build
```

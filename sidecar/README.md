# Thinking Sidecar

A local web sidecar for explicit-context reasoning beside Codex. It keeps context transparent: paste a Codex summary, ask the model to read workspace files through tools, and get an independent review of claims, assumptions, rival explanations, weak links, and next evidence.

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

## API Routing

- Official OpenAI endpoints use the Responses API.
- OpenAI-compatible non-OpenAI endpoints, such as DeepSeek, use Chat Completions.

The UI does not expose this as a user choice; the server picks from `OPENAI_BASE_URL`.

For OpenAI-compatible providers such as DeepSeek, set:

```bash
OPENAI_BASE_URL=https://api.deepseek.com
SIDECAR_DEFAULT_MODEL=deepseek-v4-pro
```

The app will automatically route this through Chat Completions.

## Context And Caching

Each request is self-contained. The server sends the review protocol, manual context, optional instruction files, discovered workspace skills, triggered skills, tool results, prior session messages, and the current user request together. Stable protocol/context content is placed before conversation history and the current request so providers with automatic prompt/context caching can reuse the longest unchanged prefix.

The UI renders assistant messages as Markdown and keeps streaming state per session, so switching sessions during generation does not move partial output into the wrong chat. Use `Stop` to abort an in-flight answer. Edit the context or prompt, then use `Rerun` to answer the previous user request again with the updated context.

User messages can also be edited in place. Saving an edit truncates the session after that user turn and regenerates from the edited point, matching the "rewind and answer again" interaction used by coding agents.

## Workspace Tools

When the auto-selected route is Chat Completions, enable workspace tools to let the model call a small OpenAI-compatible tool set:

- `list_workspace_files`
- `read_workspace_file`
- `get_git_diff`

All file paths are workspace-relative and constrained to `SIDECAR_WORKSPACE_ROOT`. Tool calls and tool results are shown in the chat and persisted in the session history before the final assistant answer.

The UI also lists workspace skills discovered from `SKILL.md` files. When a turn appears to trigger a workspace skill, the triggered skill is inserted into the conversation flow before the answer.

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

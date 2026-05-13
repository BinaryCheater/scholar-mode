# Thinking Sidecar

A local web sidecar for explicit-context reasoning beside Codex. It keeps context transparent: paste a Codex summary, ask the model to read workspace files through tools, and get an independent review of claims, assumptions, rival explanations, weak links, and next evidence.

## Run

There are two supported ways to use the app.

### Home Install

Install the app once under a user directory and point it at any workspace:

```bash
cd ~/Applications/thinking-sidecar/sidecar
npm install
npm run build
npm run codex:install -- --workspace ~/Research/project-a
SIDECAR_WORKSPACE_ROOT=~/Research/project-a npm start
```

### Workspace-Local Install

Keep the app inside the research workspace:

```bash
cd sidecar
cp .env.example .env
npm install
npm run build
npm run codex:install -- --workspace ..
OPENAI_API_KEY=sk-... npm start
```

Open `http://localhost:4317`.

Use `npm run dev` only when editing the Sidecar source. It runs the TypeScript server through `tsx` and serves the Vite client in development mode. For normal use, build once and run `npm start`.

Useful environment variables:

- `OPENAI_API_KEY`: required for model calls.
- `OPENAI_BASE_URL`: optional OpenAI-compatible endpoint, for example `https://api.deepseek.com`.
- `SIDECAR_WORKSPACE_ROOT`: file-read root. Defaults to the parent of `sidecar`.
- `SIDECAR_GRAPH_MANIFEST`: graph manifest path inside the workspace. Defaults to `research/graph.yaml`.
- `SIDECAR_DEFAULT_MODEL`: defaults to `gpt-5.5`.
- `PORT`: defaults to `4317`.

In home-install mode, always set `SIDECAR_WORKSPACE_ROOT` to the repo that contains the Markdown, HTML, `graph.yaml`, and `.side/` state. In workspace-local mode, the default workspace root is the parent of `sidecar`.

## Workspace Install Command

Initialize any workspace:

```bash
npm run codex:install -- --workspace /path/to/workspace
```

This creates `.side/config.json`, `.side/sessions/index.json`, a `.gitignore` entry for `.side/`, bundled workspace skills, and a starter graph unless disabled.

Useful options:

- `--graph notes/maps/graph.yaml`
- `--no-graph`
- `--no-skills`
- `--force`

## CLI Commands

All CLI commands are wrappers around `scripts/codex-sidecar.mjs`.

Initialize a workspace:

```bash
npm run codex:install -- --workspace /path/to/workspace
```

Create a session and stage context without calling the model:

```bash
npm run codex:call -- --title "Review" --context "Codex summary..." --file research/graph.yaml --question "What is the weakest assumption?"
```

Create a session and stream the model answer to stdout:

```bash
npm run codex:ask -- --title "Review" --context "Codex summary..." --question "What should Codex do next?"
```

Create a plain session:

```bash
npm run codex:session -- --title "Review" --context "Codex summary..."
```

Direct invocation is equivalent:

```bash
node scripts/codex-sidecar.mjs install --workspace /path/to/workspace
node scripts/codex-sidecar.mjs call --url http://localhost:4317 --title "Review"
```

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
- `read_workspace_files`
- `write_workspace_file`
- `get_git_diff`
- `load_skill`

All file paths are workspace-relative and constrained to `SIDECAR_WORKSPACE_ROOT`. `write_workspace_file` defaults to Markdown and HTML only: `.md`, `.markdown`, `.html`, `.htm`. The allow-list is stored in `.side/config.json` under `tools.allowedWriteExtensions`.

Tool calls and tool results are shown in the chat and persisted in the session history before the final assistant answer.

The UI also lists workspace skills discovered from `SKILL.md` files. Skill handling is progressive:

- Discovery scans frontmatter only: `name`, `description`, and `path`.
- Each turn matches the prompt and manual context against discovered skill metadata.
- High-confidence matches auto-load the full `SKILL.md` into the context packet.
- Medium-confidence matches are shown as candidates; the model can call `load_skill` to read the full instructions before relying on that skill.
- The conversation flow records skill routing and tool use separately, so you can see what was discovered, triggered, loaded, and called.

## Codex Handoff

With the sidecar server running:

```bash
npm run codex:call -- --title "Skill review" --context "Codex summary..." --file SKILL.md --file README.md --question "What is the weakest assumption?"
```

This creates a session, stores the explicit context, snapshots the listed files, optionally adds a manual user question, and prints the URL. The question is staged in the session; it does not call the model until the user continues in the web UI.

For an explicit all-automatic path, Codex can ask the sidecar and stream the answer back:

```bash
npm run codex:ask -- --title "Skill review" --context "Codex summary..." --file SKILL.md --question "What should Codex do next?"
```

Use `codex:ask` when the user wants Codex to relay the answer directly. Use `codex:call` as the default integration path.

## Research Graph

The graph is loaded from the configured manifest, defaulting to `research/graph.yaml`.

```yaml
root: rq.main

nodes:
  - id: rq.main
    title: Core research question
    type: question
    file: ./rq.main.md

edges:
  - from: rq.main
    to: rq.theory
    kind: decomposes
```

`graph.yaml` owns structure and UI hints. Markdown/HTML files own content. Node file links can be workspace-relative, or manifest-relative with `./`, `../`, or a bare filename. Returned paths are normalized to workspace-relative form.

See `../docs/sidecar-usage.md` and `../docs/api.md` for the full project layout and API reference.

## Tests

```bash
npm test
npm run typecheck
npm run build
```

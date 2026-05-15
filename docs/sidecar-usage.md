# Research Sidecar Usage Guide

## Purpose

Research Sidecar is a local research companion for Codex. It keeps three concerns separate:

- Research content lives in your workspace as Markdown or HTML.
- Research structure lives in a graph manifest, usually `research/graph.yaml`.
- App state and private configuration live in `.side/`.

The app can be installed globally or locally. The directory where `research-sidecar` is launched becomes the workspace root.

## Installation Shapes

Install globally:

```bash
npm install -g @binarycheater/research-sidecar
cd ~/Research/project-a
research-sidecar init --graph research/graph.yaml
research-sidecar
```

Or install in a project:

```bash
npm install -D @binarycheater/research-sidecar
npx research-sidecar
```

```txt
my-research-repo/
  research/
    graph.yaml
    rq.main.md
  .side/
```

Graph paths, file previews, tools, session state, and `.side/config.json` apply to the workspace root, not to the package install directory.

`npm run dev` is for developing Sidecar itself. Normal use is `npm run build` once, then `npm start`.

## Workspace State

Sidecar writes app state under the workspace:

```txt
.side/
  config.json
  sessions/
    index.json
    <session-id>.json
```

`config.json` stores local app preferences:

```json
{
  "defaultModel": "deepseek-v4-pro",
  "openaiAPIKey": "sk-...",
  "openaiBaseURL": "https://api.deepseek.com",
  "apiMode": "chat",
  "graph": {
    "manifestPath": "research/graph.yaml"
  },
  "tools": {
    "allowedWriteExtensions": [".md", ".markdown", ".html", ".htm", ".yaml", ".yml"]
  }
}
```

Keep `.side/` out of git because it may contain API keys and private session history.

## Workspace Install Command

`research-sidecar init` initializes the current workspace:

```bash
research-sidecar init --graph research/graph.yaml
```

It creates:

- `.side/config.json`
- `.side/sessions/index.json`
- `.gitignore` entry for `.side/`
- `skills/research-graph-sop`
- `skills/scholar-mode`
- `skills/sidecar-thinking`
- `skills/writing-explanatory-reports`
- starter `research/graph.yaml` and `research/rq.main.md`, unless disabled

Options:

- `--graph notes/maps/graph.yaml`: choose the graph manifest path.
- `--no-graph`: skip starter graph creation.
- `--no-skills`: skip copying bundled skills.
- `--force`: overwrite install-managed graph and skill files.

## Command Line Use

Normal use:

```bash
research-sidecar
research-sidecar --graph dingyi/synthetic/graph.yaml
research-sidecar install-skills
```

Development handoff helpers remain available through npm scripts:

```bash
npm run codex:install -- --workspace /path/to/workspace
npm run codex:call -- --title "Review" --context "..." --file research/graph.yaml --question "What is weak?"
npm run codex:ask -- --title "Review" --context "..." --question "Answer directly"
npm run codex:session -- --title "Review" --context "..."
```

`codex:call` creates a session, stores context, attaches files, and optionally stages a user question. It does not call the model. `codex:ask` does the same setup and then streams the answer to stdout. `codex:session` is the base session creation path.

Direct node invocation is equivalent:

```bash
node scripts/codex-sidecar.mjs install --workspace /path/to/workspace
node scripts/codex-sidecar.mjs call --url http://localhost:4317 --title "Review"
```

## Research Graph

The graph is manifest-first:

```txt
research/
  graph.yaml
  rq.main.md
  rq.theory.md
  tasks/reading-pass.md
```

`graph.yaml` is the authority for:

- nodes
- edges
- root node
- UI defaults such as expanded nodes and layout
- file pointers

Markdown or HTML files are the content layer. Markdown frontmatter can supply local metadata, but the manifest wins when both define the same field.

## Graph Manifest

Example:

```yaml
root: rq.main

ui:
  layout: LR
  expanded: [rq.main, rq.theory]

nodes:
  - id: rq.main
    title: Core research question
    type: question
    file: ./rq.main.md
    status: active
    tags: [framing]

  - id: rq.theory
    title: Theoretical mechanism
    type: question
    file: ./rq.theory.md

edges:
  - from: rq.main
    to: rq.theory
    kind: decomposes
```

Default manifest path: `research/graph.yaml`.

The UI discovers graph files across the workspace and can save the selected manifest to `.side/config.json`. Override it with either:

```bash
SIDECAR_GRAPH_MANIFEST=notes/maps/graph.yaml npm run dev
```

or `.side/config.json`:

```json
{
  "graph": {
    "manifestPath": "notes/maps/graph.yaml"
  }
}
```

## File Path Rules

All paths must remain inside `SIDECAR_WORKSPACE_ROOT`.

In `graph.yaml`, node `file` paths may be:

- Manifest-relative: `rq.main.md`, `./rq.main.md`, `reports/stage1.md`, `../sources/paper.md`
- Explicit workspace-root-relative: `/research/rq.main.md`

The server normalizes returned node paths to workspace-relative paths so the UI, API, and tools use one stable form.

Markdown previews resolve relative links and images against the current Markdown file. HTML previews get a workspace raw-file base URL so ordinary relative links can resolve inside the workspace.

## Codex Workflow

Typical workflow:

1. Codex reads existing Markdown notes and source files.
2. Codex updates or creates `graph.yaml`.
3. The app renders the graph and previews node files.
4. Codex can use the `sidecar-thinking` skill to create a review session or ask the app for a second opinion.

The graph should remain small enough to inspect directly. Long summaries, quotations, evidence, and draft text belong in Markdown files, not in `graph.yaml`.

## Skills

Skills live in `skills/`:

```txt
skills/
  research-graph-sop/
    SKILL.md
  scholar-mode/
    SKILL.md
  sidecar-thinking/
    SKILL.md
  writing-explanatory-reports/
    SKILL.md
```

`research-graph-sop` keeps graph YAML disciplined. `sidecar-thinking` is for using the local app, API, CLI, and graph workflow. `writing-explanatory-reports` supports concise Markdown/HTML reports. `scholar-mode` is for research reasoning.

```bash
research-sidecar install-skills
```

The install command copies bundled skills into the current workspace, not into the Codex user-level skill directory. When the Sidecar app scans a workspace, it discovers `SKILL.md` files and can load relevant skills into model context.

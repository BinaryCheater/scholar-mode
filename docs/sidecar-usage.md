# Thinking Sidecar Usage Guide

## Purpose

Thinking Sidecar is a local research companion for Codex. It keeps three concerns separate:

- Research content lives in your workspace as Markdown or HTML.
- Research structure lives in a graph manifest, usually `research/graph.yaml`.
- App state and private configuration live in `.side/`.

The app can be embedded inside a research repo or installed elsewhere and pointed at a repo.

## Installation Shapes

There are two intended ways to use Sidecar.

### Home Install, Pointed At A Workspace

Use this when you want to install the Sidecar app once under your home directory and use it with many research repositories.

```txt
~/Applications/thinking-sidecar/
  sidecar/

~/Research/project-a/
  .side/
  research/
    graph.yaml
```

Initialize any workspace:

```bash
cd ~/Applications/thinking-sidecar/sidecar
npm run codex:install -- --workspace ~/Research/project-a
```

Run the app for that workspace:

```bash
SIDECAR_WORKSPACE_ROOT=~/Research/project-a npm run dev
```

This keeps the app code out of the research repo while storing `.side/`, skills, graph, sessions, and config in the research workspace.

### Workspace-Local Install

Use this when the Sidecar app itself should live inside the research repo.

```txt
my-research-repo/
  sidecar/
  research/
    graph.yaml
    rq.main.md
  .side/
```

Run:

```bash
cd sidecar
npm install
npm run codex:install -- --workspace ..
npm run dev
```

The default workspace root is the parent of `sidecar`, so this layout works without `SIDECAR_WORKSPACE_ROOT`.

In both modes, graph paths, file previews, tools, session state, and `.side/config.json` apply to the workspace root, not necessarily to the app install directory.

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
    "allowedWriteExtensions": [".md", ".markdown", ".html", ".htm"]
  }
}
```

Keep `.side/` out of git because it may contain API keys and private session history.

## Workspace Install Command

`codex:install` initializes a target workspace:

```bash
npm run codex:install -- --workspace /path/to/workspace
```

It creates:

- `.side/config.json`
- `.side/sessions/index.json`
- `.gitignore` entry for `.side/`
- `skills/scholar-mode`
- `skills/sidecar-thinking`
- starter `research/graph.yaml` and `research/rq.main.md`, unless disabled

Options:

- `--graph notes/maps/graph.yaml`: choose the graph manifest path.
- `--no-graph`: skip starter graph creation.
- `--no-skills`: skip copying bundled skills.
- `--force`: overwrite install-managed graph and skill files.

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

Override it with either:

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

- Workspace-relative: `research/rq.main.md`
- Manifest-relative with `./`: `./rq.main.md`
- Manifest-relative with `../`: `../sources/paper.md`
- Manifest-relative bare file: `rq.main.md`

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
  scholar-mode/
    SKILL.md
  sidecar-thinking/
    SKILL.md
```

`scholar-mode` is for research reasoning. `sidecar-thinking` is for using the local app, API, CLI, and graph workflow.

To install them globally for Codex:

```bash
mkdir -p ~/.codex/skills
cp -R skills/scholar-mode ~/.codex/skills/
cp -R skills/sidecar-thinking ~/.codex/skills/
```

When the Sidecar app scans a workspace, it also discovers `SKILL.md` files and can load relevant skills into model context.

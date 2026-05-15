# Research Sidecar

English | [中文](README.zh.md)

Research Sidecar is a local web app and npm CLI for graph-backed research work. It is designed to run beside Codex: Codex can create or update research notes, while Research Sidecar gives you a readable graph, document preview, and explicit review surface for judging the work.

The important rule is simple: **the directory where you run `research-sidecar` is the workspace**. The app reads and writes only inside that workspace, and stores private local state under `.side/`.

## Why It Exists

Research work often starts from vague questions and evolves through experiments, reports, partial conclusions, and revisions. A linear folder of Markdown files becomes hard to inspect. Research Sidecar separates the problem into three layers:

- `graph.yaml`: the structural map of questions, methods, claims, evidence, tasks, and outputs.
- Markdown/HTML files: the detailed reasoning, experiment reports, tables, formulas, and drafts.
- `.side/`: local private app state, selected graph, sessions, and provider config.

This gives Codex a concrete structure to maintain while giving the human reader a compact interface for understanding what happened.

## Install

Global install:

```bash
npm install -g @binarycheater/research-sidecar
cd ~/Research/project-a
research-sidecar
```

Project-local install:

```bash
cd ~/Research/project-a
npm install -D @binarycheater/research-sidecar
npx research-sidecar
```

Open:

```txt
http://localhost:4317
```

## CLI Commands

Start the app for the current directory:

```bash
research-sidecar
```

Start with an explicit graph for this run:

```bash
research-sidecar --graph dingyi/synthetic/graph.yaml
```

Initialize workspace state:

```bash
research-sidecar init --graph research/graph.yaml
```

Install bundled skills into the workspace:

```bash
research-sidecar install-skills
```

Useful options:

- `--workspace /path/to/workspace`: override the current directory as workspace.
- `--graph path/to/graph.yaml`: set the graph manifest path inside the workspace.
- `--port 4317`: choose the HTTP port.
- `--force`: overwrite install-managed starter graph or skill files for `init` / `install-skills`.
- `--no-graph`: initialize `.side/` without creating a starter graph.
- `--no-skills`: initialize `.side/` without copying bundled skills.

## Workspace Config

Workspace config lives at:

```txt
<workspace>/.side/config.json
```

Example:

```json
{
  "defaultModel": "deepseek-v4-pro",
  "openaiBaseURL": "https://api.deepseek.com",
  "apiMode": "chat",
  "graph": {
    "manifestPath": "dingyi/synthetic/graph.yaml"
  },
  "tools": {
    "allowedWriteExtensions": [".md", ".markdown", ".html", ".htm", ".yaml", ".yml"]
  }
}
```

The UI can update `graph.manifestPath`: choose a graph in the Graph panel and click **Save graph**. This writes the selected graph to `.side/config.json`.

Keep `.side/` out of git. It can contain API keys and private session history.

## Graph Discovery And Link Rules

The app searches the whole workspace for graph candidates:

- `graph.yaml`
- `graph.yml`
- `*.graph.yaml`
- `*.graph.yml`

It ignores dependency/build folders such as `node_modules`, `dist`, `dist-server`, `.git`, and `.side`.

If a workspace contains more than one graph, choose the current one in the UI. The selected graph is persisted in `.side/config.json`.

Inside a graph, file links are relative to the graph file's directory by default:

```yaml
nodes:
  - id: rq.main
    title: Main question
    type: question
    file: ./rq.main.md

  - id: evidence.stage1
    title: Stage 1 report
    type: evidence
    file: reports/stage1.md
```

If the graph is at `dingyi/synthetic/graph.yaml`, those links resolve to:

```txt
dingyi/synthetic/rq.main.md
dingyi/synthetic/reports/stage1.md
```

Use a leading `/` for a workspace-root-relative link:

```yaml
file: /shared/background.md
```

Returned paths are normalized to workspace-relative paths so the UI, API, and tools use one stable form.

## Markdown, HTML, And LaTeX

Markdown previews support:

- GitHub-flavored Markdown
- tables
- fenced code blocks with readable colors
- inline math like `$x_i + y_i$`
- display math like:

```md
$$
\sum_i x_i
$$
```

HTML previews are sandboxed through workspace raw-file routes so relative links can resolve inside the workspace.

## Workspace Skills

Research Sidecar works best when workspace skills are installed:

```bash
research-sidecar install-skills
```

This copies bundled skills into:

```txt
<workspace>/skills/
```

Existing skill directories are skipped by default. Use `--force` when you intentionally want to overwrite install-managed skills.

The UI also has an **Install skills** button in the Graph sidebar. After installation, the app discovers `SKILL.md` files and can load relevant instructions into review context.

## Provider Configuration

Environment variables:

- `OPENAI_API_KEY`: required for model calls.
- `OPENAI_BASE_URL`: optional OpenAI-compatible endpoint, for example `https://api.deepseek.com`.
- `SIDECAR_DEFAULT_MODEL`: defaults to `gpt-5.5`.
- `SIDECAR_GRAPH_MANIFEST`: graph manifest path inside the workspace; overrides config for the run.
- `SIDECAR_WORKSPACE_ROOT`: workspace root; the CLI normally sets this from the current directory.
- `PORT`: defaults to `4317`.

Official OpenAI endpoints use the Responses API. OpenAI-compatible non-OpenAI endpoints use Chat Completions.

Example:

```bash
OPENAI_BASE_URL=https://api.deepseek.com \
SIDECAR_DEFAULT_MODEL=deepseek-v4-pro \
research-sidecar
```

## Development

Use these commands when editing this source tree:

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

The development helper CLI is still available:

```bash
npm run codex:install -- --workspace /path/to/workspace
npm run codex:call -- --title "Review" --context "Codex summary..." --file research/graph.yaml
npm run codex:ask -- --title "Review" --context "Codex summary..." --question "What is weak?"
```

## Packaging

Before publishing or testing a local tarball:

```bash
npm pack --dry-run
```

The `prepack` script builds the client and server, then copies bundled skills into the package. The package includes:

- `bin/research-sidecar.mjs`
- `dist/client`
- `dist-server`
- `skills`
- CLI helper scripts
- README files


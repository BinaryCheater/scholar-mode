# Research Sidecar Workspace

English | [中文](README.zh.md)

This repository contains **Research Sidecar**, a local web app and CLI for graph-backed research work, plus the workspace skills that make the workflow useful with Codex.

Research Sidecar is meant for a common research pattern: you have evolving notes, experiment reports, claims, evidence, and open questions, but you need a small structure that makes the state understandable. The structure lives in `graph.yaml`; the detailed reasoning lives in Markdown or HTML files; private app state lives in `.side/`.

## What It Does

- Renders a research graph from one or more `graph.yaml` files in a workspace.
- Lets you choose which graph is active and saves that choice to `.side/config.json`.
- Opens Markdown, HTML, and text documents linked from graph nodes.
- Supports inline and block LaTeX in Markdown previews.
- Provides a chat/review surface where the model can inspect constrained workspace files.
- Installs workspace skills into `<workspace>/skills` so Codex and the sidecar share the same research workflow instructions.
- Packages as an npm CLI: run it globally or locally from the directory you want to treat as the workspace.

## Repository Layout

```txt
sidecar/              npm package, web UI, server, CLI, tests
skills/               bundled workspace skills copied by `research-sidecar install-skills`
docs/                 usage guide and API reference
.side/                local app state; ignored by git
```

## Mental Model

The workspace is the directory where you run `research-sidecar`.

```txt
my-research-workspace/
  .side/
    config.json       local selected graph, model settings, sessions
  skills/
    research-graph-sop/
    scholar-mode/
    sidecar-thinking/
    writing-explanatory-reports/
  dingyi/
    synthetic/
      graph.yaml
      rq.main.md
      reports/
```

Graph files can live anywhere under the workspace. The UI searches the workspace for graph manifests such as `graph.yaml`, `graph.yml`, and `*.graph.yaml`. If several graphs exist, choose one in the UI and click **Save graph**; the choice is written to `.side/config.json`.

Inside a graph, linked files are relative to the graph file by default:

```yaml
file: ./rq.main.md
file: reports/stage1.md
```

Use a leading slash only when you explicitly mean “from the workspace root”:

```yaml
file: /shared/background.md
```

## Install And Run

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

Then open:

```txt
http://localhost:4317
```

Initialize a workspace:

```bash
research-sidecar init --graph research/graph.yaml
```

Install bundled skills into the workspace:

```bash
research-sidecar install-skills
```

## Working With This Source Repo

For app development:

```bash
cd sidecar
npm install
npm run dev
```

For production build validation:

```bash
npm test
npm run typecheck
npm run pack:sidecar
```

`npm run pack:sidecar` verifies that the npm package contains the CLI, compiled server, built client, and all bundled skills.

Publish the npm package from the repository root with:

```bash
npm run publish:sidecar
```

This publishes the `sidecar/` workspace package, not the private repository wrapper.

## Documentation

- [Sidecar package README](sidecar/README.md)
- [Usage guide](docs/sidecar-usage.md)
- [API reference](docs/api.md)

# Thinking Sidecar Research Workspace

This repository contains a local research sidecar app plus Codex skills for research work.

Core docs:

- [Usage guide](docs/sidecar-usage.md)
- [API reference](docs/api.md)
- [Sidecar app README](sidecar/README.md)

Important directories:

```txt
sidecar/              local web app
research/             demo research graph and node files
skills/               installable Codex skills
docs/                 project documentation
.side/                local app state, ignored by git
```

The recommended model is manifest-first:

```txt
research/
  graph.yaml          structure, relationships, UI hints
  *.md / *.html       research content
```

Two supported install shapes:

1. Install the app under your home directory and point it at any workspace:

```bash
cd ~/Applications/thinking-sidecar/sidecar
npm install
npm run codex:install -- --workspace ~/Research/project-a
SIDECAR_WORKSPACE_ROOT=~/Research/project-a npm run dev
```

2. Put the app inside the workspace itself:

```bash
cd sidecar
npm install
npm run codex:install -- --workspace ..
npm run dev
```

Open `http://localhost:4317`.

Install skills globally for Codex:

```bash
mkdir -p ~/.codex/skills
cp -R skills/scholar-mode ~/.codex/skills/
cp -R skills/sidecar-thinking ~/.codex/skills/
```

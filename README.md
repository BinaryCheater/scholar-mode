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

Run the app:

```bash
cd sidecar
npm install
npm run dev
```

Open `http://localhost:4317`.

For a separately installed app, point it at any research repo:

```bash
SIDECAR_WORKSPACE_ROOT=/path/to/research-repo npm run dev
```

Install skills globally for Codex:

```bash
mkdir -p ~/.codex/skills
cp -R skills/scholar-mode ~/.codex/skills/
cp -R skills/sidecar-thinking ~/.codex/skills/
```

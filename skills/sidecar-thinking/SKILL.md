---
name: sidecar-thinking
description: Use when Codex should call the local Research Sidecar app, create or inspect a Sidecar session, hand off explicit context, maintain a research graph, or use the Sidecar API/CLI for a second-opinion review.
---

# Sidecar Thinking

Use this skill to connect Codex with the local Research Sidecar app. The app is a workspace-aware web UI with chat sessions, a manifest-backed research graph, Markdown/HTML previews, and restricted workspace tools.

## Start Or Find The App

If the server is not already running, start it from the workspace root:

```bash
research-sidecar
```

Default URL: `http://localhost:4317`.

The directory where `research-sidecar` is launched becomes the workspace root. The workspace config lives at `.side/config.json`.

## Default Handoff

Prefer staging a session for the user:

```bash
cd sidecar
npm run codex:call -- --title "Review" --context "Codex summary..." --file research/graph.yaml --question "What is the weakest assumption?"
```

Use automatic ask mode only when the user explicitly wants Codex to relay the answer:

```bash
cd sidecar
npm run codex:ask -- --title "Review" --context "Codex summary..." --question "What should Codex do next?"
```

## Research Graph

The graph is manifest-first:

- `graph.yaml` is the authority for nodes, edges, UI defaults, and file pointers.
- Markdown and HTML files hold node content.
- Markdown frontmatter can supply local metadata, but `graph.yaml` wins on conflicts.
- Graph file links are relative to the graph manifest directory by default. Use a leading `/` for an explicit workspace-root-relative link.

Default manifest path: `research/graph.yaml`. Override with `SIDECAR_GRAPH_MANIFEST` or `.side/config.json` at `graph.manifestPath`. The UI can discover graph files across the workspace and save the selected graph to `.side/config.json`.

## API Quick Reference

- `GET /api/config`
- `PATCH /api/config`
- `GET /api/graphs`
- `GET /api/workspace`
- `POST /api/workspace/skills/install`
- `GET /api/workspace/file?path=<workspace-relative-path>`
- `GET /api/workspace/raw?path=<workspace-relative-path>`
- `GET /api/research-graph`
- `GET /api/sessions`
- `POST /api/sessions`
- `GET /api/sessions/:id`
- `PATCH /api/sessions/:id`
- `POST /api/sessions/:id/files`
- `POST /api/sessions/:id/messages`
- `POST /api/sessions/:id/stream`

All workspace paths are constrained to the configured workspace root.

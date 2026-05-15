---
name: sidecar-thinking
description: Use when Codex should call the local Research Sidecar app, create or inspect a Sidecar session, hand off explicit context, maintain a research graph, or use the Sidecar API/CLI for a second-opinion review.
---

# Sidecar Thinking

Use this skill to hand off explicit context from Codex to the local Research Sidecar. The sidecar should judge only what is in the context packet; do not imply it has Codex's hidden state.

The app can be embedded inside a research repo or installed separately. If it is installed separately, run it with `SIDECAR_WORKSPACE_ROOT=/path/to/research-repo`.

Default to calling the sidecar and returning a session URL so the user can ask or continue in the web UI. Only use the fully automatic ask mode when the user explicitly wants Codex to send the question and relay the answer back.

## Workflow

1. Make sure the sidecar server is running:
   `cd sidecar && npm run dev`
2. Create a concise context packet:
   - current user question
   - relevant files or diffs
   - current plan or experiment state
   - constraints and uncertainties
   - what judgment you want from the sidecar
3. Call the sidecar:
   `cd sidecar && npm run codex:call -- --title "Review" --context "..." --file SKILL.md --question "What is the weakest assumption?"`
4. Tell the user the sidecar URL, session id, and suggested next question.

`--question` in call mode adds a manual user message to the session without running the model. This is useful when Codex wants to stage the exact question while leaving the user in control of when to run or revise it.

## Optional Automatic Ask

If the user asks Codex to send the question and return the sidecar answer, use:

`cd sidecar && npm run codex:ask -- --title "Review" --context "..." --file SKILL.md --question "What is the weakest assumption?"`

Ask mode creates the same session and then streams the sidecar answer back to stdout. Treat it as a convenience path, not the default workflow.

The web UI supports workspace tools when the auto-selected API route is Chat Completions. Keep tools enabled when the sidecar should be able to list files, read workspace-relative files, inspect git diff, or load full workspace skill instructions itself. Use the CLI handoff files only for context that should remain stable and cache-friendly.

Workspace skills are discovered from `SKILL.md` frontmatter first. Strong matches are loaded into the sidecar context automatically; weaker candidates remain visible and can be loaded with the `load_skill` tool.

## Research Graph

The graph is manifest-first:

- `graph.yaml` owns nodes, edges, root, UI defaults, and file pointers.
- Markdown and HTML files own content.
- Default manifest path is `research/graph.yaml`.
- Override with `SIDECAR_GRAPH_MANIFEST` or `.side/config.json` at `graph.manifestPath`.
- Node file links are relative to the graph manifest directory by default. Use a leading `/` for explicit workspace-root-relative links.

Useful API endpoints:

- `GET /api/research-graph`
- `GET /api/workspace/file?path=<path>`
- `GET /api/workspace/raw?path=<path>`
- `POST /api/sessions`
- `POST /api/sessions/:id/stream`

## Context Discipline

Prefer smaller, auditable packets over broad repository dumps. Attach only files that matter. If the sidecar needs more context, ask Codex for specific missing files or summaries.

## Default Ask

Ask the sidecar to identify:

- the core claim
- load-bearing assumptions
- rival explanations
- weakest link
- evidence that would change the judgment
- the most defensible next move
- precise follow-up questions for Codex

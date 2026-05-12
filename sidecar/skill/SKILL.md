---
name: sidecar-thinking
description: Use when the user asks Codex to get an independent, explicit-context second opinion from the local Thinking Sidecar, challenge reasoning, review assumptions, generate rival hypotheses, or hand off files/context to a separate deep-thinking web agent.
---

# Sidecar Thinking

Use this skill to hand off explicit context from Codex to the local Thinking Sidecar. The sidecar should judge only what is in the context packet; do not imply it has Codex's hidden state.

## Workflow

1. Make sure the sidecar server is running:
   `cd sidecar && npm run dev`
2. Create a concise context packet:
   - current user question
   - relevant files or diffs
   - current plan or experiment state
   - constraints and uncertainties
   - what judgment you want from the sidecar
3. Create a session:
   `cd sidecar && npm run codex:session -- --title "Review" --context "..." --file SKILL.md`
4. Tell the user the sidecar URL and session purpose.

The web UI supports workspace tools when the auto-selected API route is Chat Completions. Keep tools enabled when the sidecar should be able to list files, read workspace-relative files, or inspect git diff itself. Use the CLI handoff files only for context that should remain stable and cache-friendly.

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

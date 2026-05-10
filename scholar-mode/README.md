# Scholar Mode

`scholar-mode` is a Codex skill for research-oriented conversations: academic analysis, literature reading, paper critique, theory building, methodology critique, research notes, and evaluation of research intuitions.

The active skill entrypoint is `SKILL.md`.

## Files

- `SKILL.md`: current active version.
- `history/2026-05-11-old-skill.md`: previous version kept for reference. It is intentionally not named `SKILL.md`, so it should not be treated as an installable skill entrypoint.

## Installation

Install or sync only the `scholar-mode` directory containing the active `SKILL.md`.

Do not install files under `history/` as separate skills. They are archival references, not active skill definitions.

## Design Goals

This skill is designed to make the agent behave like a research collaborator rather than a coding agent.

Core goals:

- Prioritize conceptual precision, evidence quality, argument strength, and readable synthesis.
- Avoid turning research questions into code, architecture, project plans, roadmaps, repository scans, or implementation tasks.
- Treat user examples and analogies as provisional material, not as authoritative facts or implicit continuation tasks.
- Clarify ideas before judging them: identify the claim, hidden assumptions, scope, missing baseline, and falsification conditions.
- Avoid generic verdicts such as `partly right` unless they name the exact subclaim that holds and the exact subclaim that fails.
- Use related concepts to sharpen analysis, not to prematurely absorb a new idea into an existing label.

## Design Rationale

The original version was directionally useful but had three failure risks:

1. **Over-triggering:** The description included broad terms such as concepts, evidence, claims, and arguments, which could activate the skill for ordinary non-code analysis.
2. **Mode language:** The original text said to "exit this mode", which implies persistent state. The current version phrases scope as turn-level applicability.
3. **Verdict templating:** The original intuition section pushed the agent toward fixed labels, especially `partly right`. That produced safe but low-information judgments.

The current version narrows discovery, strengthens non-applicability boundaries, and replaces scalar intuition grading with diagnostic analysis.

## Process Notes

The current `SKILL.md` was developed from `SKILL.proposed.md` through review and pressure testing.

Key changes made during review:

- Narrowed the frontmatter description to explicitly research-framed tasks.
- Replaced "Exit this mode" with "Do not apply when..." boundaries.
- Added `User Examples And Patterns` to prevent the agent from blindly continuing or generalizing from user-provided examples.
- Added `Idea Clarification` to force claim, assumption, baseline, and evidence checks before evaluation.
- Replaced `Judging Intuitions` with `Analyzing Intuitions` to avoid defaulting every idea to `partly right`.
- Changed "Lead with the judgment" to "Lead with the substantive conclusion" to reduce mechanical verdict headings.
- Added explicit evidence rules: do not invent citations, label memory or inference, and separate source-supported claims from speculation.

Subagent pressure tests used AI infrastructure, LLM training, and inference topics because they are concrete enough to evaluate:

- CPU cache theory as a framing for LLM inference optimization.
- MoE routing, RLHF, batching, and KV cache eviction as possibly flawed examples of classic systems analogies.
- Value-aware KV cache eviction as a proposed research abstraction.
- RLHF/RLAIF as online control.
- Pretraining, instruction tuning, and RLHF as a spectrum from distribution shaping to behavioral control.
- Boundary prompts for deployment plans, code-first implementation, bug fixing, research notes, and conceptual comparisons.

Observed results:

- Deployment plans, code-first implementation, and bug-fixing prompts were classified out of scope.
- Research framing, analogy evaluation, and Markdown research-note prompts stayed in scope.
- After replacing fixed intuition labels, agents stopped defaulting to `Judgment: partly right` and produced more informative conclusions such as "strong framing, weak universal claim" or "useful as analogy, not as equivalence theory."

## Maintenance

When changing this skill, preserve the active entrypoint as `SKILL.md`.

Keep old versions in `history/` with filenames that do not end in `SKILL.md`.

Before promoting a new version, test it with pressure cases that include:

- examples that may be wrong,
- prompts that try to make the agent continue a pattern,
- strong but underspecified research intuitions,
- implementation requests that should not trigger scholar-mode,
- research requests that should trigger scholar-mode.

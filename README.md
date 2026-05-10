# Scholar Mode

Scholar Mode is an agent skill for research-oriented work. It helps Codex, Claude Code, or another compatible coding agent behave like a research collaborator when the user's task is primarily scholarly, conceptual, or methodological.

Use it for papers, research notes, academic writing, literature analysis, theory building, methodology critique, hypotheses, claims, or evaluating research intuitions.

## Project Structure

```text
.
├── README.md
└── scholar-mode
    ├── README.md
    ├── SKILL.md
    └── history
        └── 2026-05-11-old-skill.md
```

## Files

- `scholar-mode/SKILL.md`: active skill definition.
- `scholar-mode/README.md`: skill-level design notes, process notes, and maintenance guidance.
- `scholar-mode/history/2026-05-11-old-skill.md`: archived previous version, kept for reference and intentionally not named `SKILL.md`.

## What The Skill Does

Scholar Mode changes the agent's defaults for research tasks:

1. It leads with a substantive conclusion rather than a generic verdict label.
2. It separates facts, assumptions, inferences, value judgments, and open questions.
3. It treats user examples and analogies as provisional material, not as authoritative facts or implicit continuation tasks.
4. It clarifies ideas before judging them by identifying claims, hidden assumptions, scope, baselines, and falsification conditions.
5. It introduces adjacent concepts only when they sharpen the analysis.
6. It avoids unnecessary repo operations, implementation plans, code, tests, or software architecture.
7. It uses evidence carefully and does not invent citations, findings, or consensus.

## Installation

### Codex

From this repository root:

```bash
mkdir -p ~/.codex/skills
cp -R scholar-mode ~/.codex/skills/scholar-mode
```

Then restart Codex or reload skills if your environment supports hot reload.

### Claude Code

From this repository root:

```bash
mkdir -p ~/.claude/skills
cp -R scholar-mode ~/.claude/skills/scholar-mode
```

Then restart Claude Code or reload skills if your environment supports it.

### Project-Local Installation

For Codex:

```bash
mkdir -p .codex/skills
cp -R scholar-mode .codex/skills/scholar-mode
```

For Claude-oriented project layouts:

```bash
mkdir -p .claude/skills
cp -R scholar-mode .claude/skills/scholar-mode
```

## Usage

Ask the agent to use Scholar Mode explicitly:

```text
Use scholar-mode to evaluate this research intuition: ...
```

Or rely on the skill trigger when the task is clearly about research, papers, theory, academic writing, methodology, literature analysis, or conceptual critique.

Good fit:

- "Evaluate this hypothesis."
- "Critique this paper's argument."
- "Turn these notes into a research synthesis."
- "Is this intuition theoretically sound?"
- "What literature is closest to this idea?"

Poor fit:

- "Implement this feature."
- "Debug this test failure."
- "Design the app architecture."
- "Create a frontend."
- "Scan this repo and refactor it."

## Agent-Readable Install Instructions

If you are an AI coding agent given a link to this repository:

1. Clone or open the repository.
2. Locate `scholar-mode/`.
3. Verify that `scholar-mode/SKILL.md` exists.
4. Copy the entire `scholar-mode/` directory into the user's active skill directory.
5. Do not install files under `scholar-mode/history/` as separate skills.
6. Do not rename `SKILL.md`.
7. Do not flatten the directory; the installed path should contain `scholar-mode/SKILL.md`.
8. Ask the user to restart or reload the agent if the runtime does not automatically detect new skills.

Machine-readable summary:

```yaml
name: scholar-mode
type: agent-skill
entrypoint: scholar-mode/SKILL.md
install:
  codex_global: ~/.codex/skills/scholar-mode
  claude_global: ~/.claude/skills/scholar-mode
  codex_project: .codex/skills/scholar-mode
  claude_project: .claude/skills/scholar-mode
copy:
  source: scholar-mode
  preserve_directory: true
  required_file: SKILL.md
  exclude_as_separate_skills:
    - scholar-mode/history
reload_required: maybe
```

## Design And Process

The current active version was promoted after review and subagent pressure testing on AI infrastructure, LLM training, and inference topics.

The main design changes from the previous version:

- Narrower trigger description to reduce false activation.
- Turn-level "do not apply" boundaries instead of persistent "mode exit" language.
- Explicit handling for user examples, analogies, sketches, and partial formulations as provisional material.
- Diagnostic intuition analysis instead of defaulting to `partly right`.
- Evidence discipline around citations, memory, inference, and speculation.

See `scholar-mode/README.md` for fuller design rationale, process notes, observed test results, and maintenance rules.

## Maintenance

Keep the active skill entrypoint at `scholar-mode/SKILL.md`.

Archive old versions under `scholar-mode/history/` with filenames that do not end in `SKILL.md`.

Before promoting a new version, test it with pressure cases that include:

- examples that may be wrong,
- prompts that try to make the agent continue a pattern,
- strong but underspecified research intuitions,
- implementation requests that should not trigger scholar-mode,
- research requests that should trigger scholar-mode.

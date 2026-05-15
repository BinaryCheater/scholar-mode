---
name: research-graph-sop
description: Use when working in a research repository with graph.yaml, Markdown research notes, hypotheses, evidence, experiments, literature sources, or when Codex is asked to inspect, create, update, or maintain a lightweight research graph.
---

# Research Graph SOP

Use the graph as a small, inspectable map of the research state. Put structure and relationships in `graph.yaml`; put reasoning, evidence details, quotes, experiment notes, and drafts in Markdown files.

Core principle: **thin graph, thick notes, active agent**. The graph should reduce cognitive load, not become a database the researcher has to maintain.

## First Move

If `graph.yaml` exists, read it before proposing structure changes. Then read only the linked Markdown/source files needed to understand the active question, claims, evidence, methods, and tasks.

If no graph exists, inspect nearby research notes, source files, experiment notes, and task files. Build the smallest useful graph that lets a reader answer:

- What is being investigated?
- What is currently believed or hypothesized?
- Why believe, doubt, or test it?
- What should happen next?

## Three Entry Points

### Explore Current Research

Use this when opening an existing research repo or refreshing context.

1. Identify the root question or active hypothesis.
2. List active claims, rival explanations, methods, evidence, sources, and next tasks.
3. Detect gaps: unsupported claims, missing rivals, unclear concepts, weak methods, stale tasks.
4. Update the graph only when the update improves navigation or analysis.

### Start From A Hypothesis

Use this when the user gives a hypothesis before a graph exists or before the project is well framed.

Create a minimal validation graph:

- a `claim` node for the hypothesis
- a `question` node it answers
- one or more rival `claim` nodes when plausible
- `concept` nodes only for necessary definitions or boundaries
- `method`, `evidence`, `source`, or `task` nodes only when they need tracking

Do not force every prediction, assumption, or falsifier into the graph. Put local details in the claim or method note unless they need separate links.

### Maintain During Research

Use this after experiments, readings, observations, or analysis updates.

1. Add or update the relevant Markdown note first when there is substantive content.
2. Link evidence to the exact claim it bears on.
3. Use `supports` only for genuine support, `contradicts` for negative evidence or rival pressure, and `depends_on` for assumptions.
4. If evidence changes the research direction, revise the question, boundary, method, or task instead of forcing the old hypothesis to survive.

## Minimal Graph Vocabulary

Prefer the existing Sidecar vocabulary:

| Node type | Use for |
| --- | --- |
| `question` | research questions and decomposed subquestions |
| `claim` | hypotheses, mechanism claims, rival explanations |
| `concept` | definitions, variables, scope, boundary conditions |
| `method` | experiments, operationalization, identification strategy |
| `evidence` | observations, results, patterns, counterexamples |
| `source` | papers, datasets, documents, external materials |
| `task` | next research action |
| `output` | draft conclusions, reports, paper sections |

| Edge kind | Use for |
| --- | --- |
| `decomposes` | breaks a question into subquestions |
| `answers` | a claim answers a question |
| `operationalizes` | a method makes a claim observable |
| `supports` | evidence/source supports a claim |
| `contradicts` | evidence/source/rival weakens a claim |
| `depends_on` | a claim or method relies on a premise |
| `cites` | a node uses a source |
| `leads_to` | a result creates a task or next step |

## YAML Contract

When creating or editing `graph.yaml`, keep it valid, boring YAML. Use two-space indentation, arrays with `-`, no tabs, and quote strings only when they contain characters that could confuse YAML (`:`, `#`, `{}`, `[]`, leading `*`, or multiline text).

Top-level shape:

```yaml
root: rq.main

ui:
  layout: LR
  expanded: [rq.main]

nodes:
  - id: rq.main
    title: Core research question
    type: question
    summary: One sentence is enough when no note exists yet.
    status: active
    tags: [framing]

edges:
  - from: rq.main
    to: claim.001
    kind: answers
```

Required:

- `root`: id of an existing node.
- `nodes`: array of node objects.
- each node: `id`, `title`, `type`.
- `edges`: array, empty is fine.
- each edge: `from`, `to`, `kind`; both ids must exist in `nodes`.

Optional node fields:

- `summary`: use for short, one-sentence nodes that do not need a document yet.
- `file`: one linked Markdown/HTML/text document.
- `files`: multiple linked documents. Use either strings or `{ path, title }` objects.
- `status`: `active`, `draft`, `blocked`, or `done`.
- `tags`: array of short labels.

Valid document-link patterns:

```yaml
nodes:
  - id: claim.short
    title: Short claim
    type: claim
    summary: This node is intentionally just one sentence for now.

  - id: evidence.single
    title: Single note
    type: evidence
    file: ./evidence.md

  - id: source.bundle
    title: Source bundle
    type: source
    files:
      - ./paper.md
      - path: ./appendix.html
        title: Appendix preview
```

Do not force every node to link to a document. Add `file` or `files` only when the longer note exists or when creating the link improves navigation. Missing linked files are allowed while drafting, but they should be intentional and called out in the change report.

## Agent Discipline

Act primarily as an active research assistant: propose subquestions, hypotheses, rival explanations, operationalizations, and next tasks.

Also apply two constraints:

- **Reviewer:** attack weak claims, hidden assumptions, unclear concepts, non-falsifiable hypotheses, and methods that build in their conclusion.
- **Gatekeeper:** do not present a claim as settled unless it has relevant evidence and plausible rival explanations have been considered.

New agent-created nodes should usually be `status: draft`. Use `active` when the researcher is actually pursuing the node, `blocked` when progress depends on missing material, and `done` only for completed tasks or stable source nodes.

## Keep It Lightweight

Add a graph node only when the item needs to be navigated, connected, reused, challenged, or tracked over time.

Avoid:

- duplicating long Markdown content in `summary`
- making every sentence a node
- adding schema fields the current repo does not already use
- treating the graph as proof by itself
- hiding uncertainty behind tidy structure

Good graph changes make the current research easier to inspect in under a minute.

## Change Report

When updating the graph, summarize:

- nodes added, changed, or removed
- important edges added or changed
- Markdown notes created or updated
- remaining methodological gaps or next tasks

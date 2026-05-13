# Thinking Sidecar API

Base URL: `http://localhost:4317`.

All request and response bodies are JSON unless noted. Workspace paths are always relative to `SIDECAR_WORKSPACE_ROOT` and cannot escape that root.

## Config

### `GET /api/config`

Returns public app configuration.

```json
{
  "workspaceRoot": "/path/to/repo",
  "defaultModel": "gpt-5.5",
  "openaiBaseURL": null,
  "apiMode": "responses",
  "hasOpenAIKey": true
}
```

## Workspace

### `GET /api/workspace`

Returns discovered instruction files and workspace skills.

### `GET /api/workspace/file?path=<path>`

Returns a text snapshot for preview or session attachment.

```json
{
  "id": "uuid",
  "path": "research/rq.main.md",
  "content": "# Main",
  "bytes": 6,
  "format": "markdown",
  "mimeType": "text/markdown",
  "addedAt": "2026-05-13T00:00:00.000Z"
}
```

`format` is `markdown`, `html`, or `text`.

### `GET /api/workspace/raw?path=<path>`

Returns raw file content with the detected content type. Used by Markdown and HTML previews for linked local files.

## Research Graph

### `GET /api/research-graph`

Loads the configured graph manifest.

```json
{
  "rootId": "rq.main",
  "sourcePath": "research/graph.yaml",
  "nodes": [
    {
      "id": "rq.main",
      "title": "Core research question",
      "type": "question",
      "file": "research/rq.main.md",
      "fileExists": true,
      "status": "active",
      "tags": ["framing"]
    }
  ],
  "edges": [
    {
      "id": "edge.main.theory",
      "from": "rq.main",
      "to": "rq.theory",
      "kind": "decomposes"
    }
  ],
  "warnings": [],
  "ui": {
    "expanded": ["rq.main"],
    "layout": "LR"
  }
}
```

The manifest path defaults to `research/graph.yaml`. Configure it with `SIDECAR_GRAPH_MANIFEST` or `.side/config.json` at `graph.manifestPath`.

## Sessions

### `GET /api/sessions`

Returns session summaries from `.side/sessions/index.json`.

### `POST /api/sessions`

Creates a session.

Request:

```json
{
  "title": "New review",
  "model": "gpt-5.5"
}
```

### `GET /api/sessions/:id`

Returns the full session JSON from `.side/sessions/<id>.json`.

### `PATCH /api/sessions/:id`

Updates title, manual context, review prompt, model, or API mode.

### `POST /api/sessions/:id/files`

Attaches a workspace file snapshot.

Request:

```json
{
  "path": "research/rq.main.md"
}
```

### `DELETE /api/sessions/:id/files/:fileId`

Removes an attached file snapshot from the session.

### `POST /api/sessions/:id/messages`

Adds a manual user message without calling the model.

### `POST /api/sessions/:id/messages/:messageId/edit`

Edits a user message and truncates later messages.

### `POST /api/sessions/:id/stream`

Streams a model response as server-sent events.

Request:

```json
{
  "message": "What is the weakest assumption?",
  "model": "gpt-5.5",
  "manualContext": "Current Codex summary...",
  "reviewPrompt": "Review protocol...",
  "enableTools": true,
  "includeInstructionFiles": false
}
```

Event types:

- `delta`: assistant text chunk
- `tool_call`: workspace tool call
- `tool_result`: workspace tool result
- `skills`: discovered and loaded workspace skills
- `done`: stream completed
- `error`: stream failed

## Workspace Tools

When Chat Completions mode is active and tools are enabled, the model can call:

- `list_workspace_files`
- `read_workspace_file`
- `read_workspace_files`
- `write_workspace_file`
- `get_git_diff`
- `load_skill`

`write_workspace_file` is restricted by `.side/config.json` at `tools.allowedWriteExtensions`. Defaults: `.md`, `.markdown`, `.html`, `.htm`. Common code extensions are rejected even if requested by mistake.

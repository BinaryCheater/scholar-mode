# Changelog

All notable changes to this repository should be documented here.

This project follows a practical form of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions map to the `sidecar/package.json` package version when released.

## [Unreleased]

No unreleased changes.

## [0.1.2] - 2026-05-16

### Added

- Added a standalone workspace document viewer at `/viewer?path=...` for opening Markdown, HTML, and text files outside the graph sidebar.
- Added node detail actions in the graph view: preview, browser open, expand/collapse, branch expand, and focus.
- Added a node right-click shortcut menu for the same graph actions.
- Added focus subgraph mode with a nearby default and an optional antecedent-chain toggle.
- Added binary raw-file serving for workspace assets so Markdown images can render correctly.
- Added repository-level `AGENTS.md` with architecture and change-discipline constraints.

### Changed

- Replaced small graph node `+/-` controls with click-to-detail interaction and explicit action controls.
- Changed graph node click behavior to expand/collapse one layer while moving node actions into a fixed-size hover card.
- Updated Markdown link handling so local document links route to the standalone viewer while local images route to raw workspace assets.
- Changed graph "open file" actions to ask the local Sidecar server to open the original workspace file with the system default app, avoiding browser `file://` blocking.
- Split large client files into smaller responsibility-focused modules:
  - `sidecar/src/client/api.ts`
  - `sidecar/src/client/chat/`
  - `sidecar/src/client/graph/`
  - `sidecar/src/client/shell/`
  - `sidecar/src/client/viewer/`

### Fixed

- Fixed local Markdown image rendering for workspace-relative assets.
- Fixed local Markdown links with `?query` or `#hash` suffixes being folded into the encoded file path.
- Removed duplicate graph node popups caused by browser `title` tooltips plus the old in-node hover tooltip.
- Fixed graph node action popups scaling with the graph canvas or being hidden behind other nodes.

## [0.1.1] - 2026-05-16

### Changed

- Prepared the Research Sidecar `0.1.1` package release.

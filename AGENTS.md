# Repository Instructions

These instructions apply to the whole repository.

## Product Constraints

- Research Sidecar stays local-first: the directory where `research-sidecar` runs is the workspace, and app state stays under `.side/`.
- Keep the graph thin and navigational. Detailed reasoning belongs in Markdown/HTML files, not duplicated into `graph.yaml` summaries.
- Prefer simple, discoverable interactions. Core actions should be visible in the UI; right-click menus may exist only as shortcuts.
- Avoid overdesign. Add configuration only when a real workflow needs it; prefer one clear default plus one obvious escape hatch.

## Architecture

- Avoid god components and mixed responsibilities.
- Keep React containers focused on state orchestration. Put reusable UI into small components under `sidecar/src/client/<area>/`.
- Keep pure graph logic in `sidecar/src/lib/`. UI files should call graph helpers rather than reimplement traversal, layout, or link rules.
- Keep API access and shared client types centralized in `sidecar/src/client/api.ts`.
- Keep file and raw asset handling on the server side explicit about text vs binary data.

## Change Discipline

- Preserve existing behavior during structural refactors; verify with tests before adding new behavior.
- Add or update tests when changing graph visibility, file resolution, Markdown rendering, or workspace path handling.
- Do not silently widen file-system access. Workspace APIs must continue rejecting paths outside the workspace.
- Keep changes scoped. Do not introduce routing, state-management, styling, or build-system frameworks unless the current feature clearly requires them.

## Release Notes

- Run package dry-runs from the package directory: use `(cd sidecar && npm pack --dry-run)`.
- Do not use `npm --prefix sidecar pack --dry-run`; npm can resolve package metadata from the current directory for `pack` and fail with `Invalid package, must have name and version`.

## Verification

Before considering a change ready, run:

```bash
npm --prefix sidecar test -- --run
npm --prefix sidecar run typecheck
npm --prefix sidecar run build
```

For UI changes, also start the app and smoke-test both the graph view and standalone document viewer:

```bash
npm --prefix sidecar run dev
```

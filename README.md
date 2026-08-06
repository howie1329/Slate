# Slate

Slate is a local-first macOS planner for deciding what work realistically fits into today. Tasks have an estimated duration, the user sets a daily capacity limit, and Slate makes the tradeoffs visible without becoming a calendar or time-blocking tool.

## Current state

The repository contains a working local planning foundation:

- Tauri 2 macOS host with a menu-bar popover and full application window.
- `/today`, `/backlog`, and `/settings` routes using the shared workspace shell.
- SQLite-backed tasks, task ordering, daily capacity, and non-sensitive preferences.
- Native task creation, editing, completion, deletion, and date scheduling.
- Pointer and keyboard task ordering within active Today and Backlog groups.
- Today capacity and over-capacity state.
- Configurable global quick capture with a dedicated compact capture window and revision-safe Undo.
- macOS Keychain storage for provider API keys.
- Settings-based provider and fixed model selection for AI features.
- Shared local state between the popover and full window through native change events and TanStack Query invalidation.
- Light and dark themes and compact task-detail editing above the persistent footer.

Slate 1.1.0 is the current release candidate. New users get a short, skippable onboarding flow that explains capacity, Backlog, Today, and the task-detail workflow. Global quick capture opens a dedicated compact window from a configurable macOS shortcut and creates title-only Backlog tasks with bounded, revision-safe Undo. AI Assist and Plan My Day are reviewable production flows: provider requests cross the native Keychain boundary through the packaged Node sidecar, Assist creates tasks only after review, and Plan My Day moves selected Backlog tasks to Today only after atomic native acceptance. The planned release is distributed directly as an ad-hoc-signed Apple Silicon DMG for macOS 13.5 or later. Because it is not notarized, users must explicitly approve its first launch in macOS Privacy & Security.

The product direction and staged expansion plan live in [the product brief](docs/product-brief.md) and [the roadmap](docs/roadmap.md).

## Product shape

Slate is designed around a compact menu-bar popover that can perform the essential daily work:

- **Today:** committed tasks, remaining capacity, over-capacity state, and completed work.
- **Backlog:** captured work grouped by estimate and date state.
- **Settings:** daily capacity, AI provider/model configuration, provider-specific Keychain credentials, and planning instruction through one explicit Save action.
- **Persistent footer:** quick capture, Save, context-sensitive AI Assist or Plan My Day, and Settings access.

The full window provides more room for the same workflow. It is not an unlock gate for essential planning behavior.

## Development

```bash
npm install
npm --prefix sidecar ci
npm run build:sidecar
npm run dev:desktop
```

`npm run dev:desktop` starts Vite on port 1420 and launches the native Slate tray app. The popover opens from the macOS menu bar; the full app is available through Open Full App.
The sidecar is an independently locked package, so install and build it once before desktop development; `npm run ensure:sidecar` then rejects a missing or stale binary.

### Native icon assets

The canonical full-bleed app-icon source is `src-tauri/assets/slate-icon-source.png`. The transparent-corner variant is kept at `src-tauri/assets/slate-icon-transparent.png`; the menu-bar icon remains a separate monochrome template glyph in the native tray controller.

Regenerate the committed macOS bundle outputs after changing the app mark:

```bash
npm run tauri -- icon -o src-tauri/icons/slate src-tauri/assets/slate-icon-source.png
```

Keep the four macOS files referenced by `src-tauri/tauri.conf.json`: `32x32.png`, `128x128.png`, `128x128@2x.png`, and `icon.icns`.

## Validation and release builds

```bash
npm run build
npm --prefix sidecar ci
npm --prefix sidecar test
npm run build:sidecar
npm run tauri -- build
```

The production application and DMG are generated under `src-tauri/target/release/bundle/`.

## Stack

- Tauri 2
- React 19 and TypeScript
- Vite
- TanStack Router with file-based routes
- Tailwind CSS 4 via the Vite plugin
- SQLite through a native Rust `rusqlite` repository with bundled SQLite
- macOS Keychain access through the Tauri layer
- TanStack Query for renderer caching and cross-window invalidation
- Native Tauri provider boundary with a packaged Node sidecar using JavaScript AI SDKs

## Project structure

```text
src/
  routes/             File-based TanStack Router routes and workspace views
  components/         Workspace, task, and footer interactions
  lib/                Renderer/native planner boundary and query hooks
  styles.css          Global Tailwind entry point and visual tokens
src-tauri/
  assets/             Canonical native app-icon sources
  icons/slate/        Generated macOS bundle icons
  src/                Native persistence, credentials, window, and tray behavior
docs/
  product-brief.md    Product definition and 1.0 contract
  roadmap.md          Directional roadmap and expansion stages
  plans/              Implementation plans
```

## Product principles

- Duration is the primary planning unit; Slate does not model energy, priorities, or calendar time blocks in the core loop.
- Backlog contains captured but uncommitted work. Today contains deliberate commitments.
- Manual capture and task management remain usable without an AI key or network connection.
- AI suggestions are reviewable and require confirmation before changing tasks or plans.
- Unfinished work is never silently rolled into another day.
- Over-capacity plans remain possible but are made visibly explicit.
- Local SQLite is the source of truth; native commands are the boundary for privileged operations.
- Future integrations, sync, mobile, Spaces, and local agent access are separate expansions that must earn their complexity.

# Slate

Slate is a local-first macOS planner for deciding what work realistically fits into today. Tasks have an estimated duration, the user sets a daily capacity limit, and Slate makes the tradeoffs visible without turning planning into calendar time-blocking.

The current repository contains the visual workspace prototype and native macOS menu-bar shell. The task workflow is still backed by mock data; SQLite persistence, Keychain storage, and AI actions are planned MVP work.

The target product is designed around a compact menu-bar popover that can do the same work as the full app:

- **Today**: the commitment plan, capacity meter, completion state, and overflow handling.
- **Log**: tasks that need estimates, have no date, are scheduled for upcoming dates, are overdue, or are completed.
- **Settings**: daily capacity, AI provider/model/key, and the persistent planning instruction.
- **Persistent footer**: quick capture, AI-assisted capture, Plan My Day, and AI availability.

The target MVP is intentionally small: local SQLite persistence, secure macOS Keychain storage for BYOK credentials, menu-bar access, and two optional AI actions using Vercel AI SDK v7 with Vercel Gateway or OpenRouter.

## Stack

- Tauri 2
- React 19 and TypeScript
- Vite
- TanStack Router with file-based routes
- Tailwind CSS 4 via the Vite plugin
- SQLite through a Tauri-compatible SQL integration (planned)
- macOS Keychain access through the Tauri layer (planned)
- Vercel AI SDK v7 with Vercel Gateway and OpenRouter (planned)

## Development

```bash
npm install
npm run dev:desktop
```

`npm run dev:desktop` starts Vite on port 1420 and launches the native Slate tray app. The popover opens from the menu-bar icon; the full app is available through Open Full App.

## Validation and release builds

```bash
npm run build
npm run tauri -- build
```

The production application and DMG are generated under `src-tauri/target/release/bundle/`.

## Project structure

```text
src/
  routes/             File-based TanStack Router routes and workspace views
  router.tsx          Router configuration
  styles.css          Global Tailwind entry point and visual tokens
src-tauri/            Native macOS host, tray/popover behavior, and window commands
docs/
  product-brief.md    Product definition, MVP boundary, and final direction
  plans/               Implementation plans
```

The current prototype contains mock-backed `/today` and `/inbox` routes. The `/inbox` route currently presents the backlog-style task view; the target MVP replaces it with Log, adds Settings and a functional persistent command footer, and keeps the same GUI available in both the menu-bar popover and the full app.

## Current status

Implemented:

- Compact/full workspace shell with light and dark themes.
- macOS menu-bar tray icon and compact popover.
- Popover dismissal on focus loss and Open Full App behavior.
- Mock Today and backlog task views with local, in-memory completion toggles.

Planned MVP work:

- Real task capture, editing, scheduling, deletion, and persistence.
- SQLite-backed tasks, ordering, and preferences.
- Settings and macOS Keychain credential storage.
- Drag-and-drop ordering and complete capacity/over-capacity behavior.
- AI Assist, Plan My Day, and reviewable AI result states.

## Product principles

- Duration is the primary planning unit; the MVP does not model energy, priorities, or calendar time blocks.
- AI is optional. Manual capture, editing, scheduling, completion, and persistence work without a key or network connection.
- AI suggestions are always reviewable and require confirmation before changing tasks or plans.
- Manual task order is a soft planning signal: it gives the user influence without pretending to be an absolute priority system.
- Over-capacity plans are allowed but made visibly explicit; Slate helps users find a way out instead of fighting them.
- Future integrations such as Convex, Clerk, Composio, Gmail, and GitHub are version 2+ concerns.

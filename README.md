# Slate

Slate is a local-first macOS planner for deciding what work realistically fits into today. Tasks have an estimated duration, the user sets a daily capacity limit, and Slate makes the tradeoffs visible without turning planning into calendar time-blocking.

The current repository contains the visual workspace, native macOS menu-bar shell, and a local persistence foundation. Tasks and non-sensitive preferences are stored in SQLite, provider-specific API keys are stored in macOS Keychain, and the popover and full window refresh from the same local source of truth.

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
- SQLite through a native Rust `rusqlite` repository with bundled SQLite
- macOS Keychain access through the Tauri layer
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

The current `/today`, `/inbox`, and `/settings` routes read from the native SQLite repository. The `/inbox` route remains the backlog-style task view while the product continues toward the full Log workflow. The same persisted state is available in both the menu-bar popover and full app.

## Current status

Implemented:

- Compact/full workspace shell with light and dark themes.
- macOS menu-bar tray icon and compact popover.
- Popover dismissal on focus loss and Open Full App behavior.
- SQLite-backed tasks, scoped ordering, and non-sensitive preferences.
- Provider-specific API key storage in macOS Keychain.
- TanStack Query cache invalidation across the popover and full app after native mutations.
- Persistent capture, completion toggles, settings, and theme selection.

Planned MVP work:

- Task editing, scheduling, deletion, drag-and-drop ordering, and complete capacity/over-capacity behavior.
- AI Assist, Plan My Day, and reviewable AI result states.

## Product principles

- Duration is the primary planning unit; the MVP does not model energy, priorities, or calendar time blocks.
- AI is optional. Manual capture, editing, scheduling, completion, and persistence work without a key or network connection.
- AI suggestions are always reviewable and require confirmation before changing tasks or plans.
- Manual task order is a soft planning signal: it gives the user influence without pretending to be an absolute priority system.
- Over-capacity plans are allowed but made visibly explicit; Slate helps users find a way out instead of fighting them.
- Future integrations such as Convex, Clerk, Composio, Gmail, and GitHub are version 2+ concerns.

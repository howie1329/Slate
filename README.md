# Slate

Slate is a local-first macOS planner for deciding what work realistically fits into today. Tasks have an estimated duration, the user sets a daily capacity limit, and Slate makes the tradeoffs visible without turning planning into calendar time-blocking.

The product is designed around a compact menu-bar popover that can do the same work as the full app:

- **Today**: the current commitment plan, capacity meter, completion state, and overflow handling.
- **Log**: tasks that need estimates, have no date, are scheduled for upcoming dates, are overdue, or are completed.
- **Settings**: daily capacity, AI provider/model/key, and the persistent planning instruction.
- **Persistent footer**: quick capture, AI-assisted capture, Plan My Day, Replan My Day, and AI availability.

The MVP is intentionally small but complete: local SQLite persistence, secure macOS Keychain storage for BYOK credentials, menu-bar access, and three optional AI actions using Vercel AI SDK v7 with Vercel Gateway or OpenRouter.

## Stack

- Tauri 2
- React 19 and TypeScript
- Vite
- TanStack Router with file-based routes
- Tailwind CSS 4 via the Vite plugin
- SQLite through a Tauri-compatible SQL integration (planned)
- Vercel AI SDK v7 with Vercel Gateway and OpenRouter (planned)

## Development

```bash
npm install
npm run tauri dev
```

`npm run tauri dev` starts Vite on port 1420 and opens the native Slate window.

## Validation and release builds

```bash
npm run build
npm run tauri build
```

The production application and DMG are generated under `src-tauri/target/release/bundle/`.

## Project structure

```text
src/
  routes/             File-based TanStack Router routes and workspace views
  router.tsx          Router configuration
  styles.css          Global Tailwind entry point and visual tokens
src-tauri/            Native macOS host, tray/popover behavior, Keychain, and SQL bridge
docs/
  product-brief.md    Product definition, MVP boundary, and final direction
  plans/               Implementation plans
```

The current scaffold contains placeholder `/today` and `/inbox` routes. The target MVP replaces the placeholder Inbox concept with Log, adds Settings and a persistent command footer, and keeps the same GUI available in both the menu-bar popover and the full app.

## Product principles

- Duration is the primary planning unit; the MVP does not model energy, priorities, or calendar time blocks.
- AI is optional. Manual capture, editing, scheduling, completion, and persistence work without a key or network connection.
- AI suggestions are always reviewable and require confirmation before changing tasks or plans.
- Over-capacity plans are allowed but made visibly explicit; Slate helps users find a way out instead of fighting them.
- Future integrations such as Convex, Clerk, Composio, Gmail, and GitHub are version 2+ concerns.

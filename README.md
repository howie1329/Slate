# Slate

Slate is a local-first macOS task planner built around a daily commitment budget.

## Stack

- Tauri 2
- React 19 and TypeScript
- Vite
- TanStack Router with file-based routes

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
  routes/             File-based TanStack Router routes
  router.tsx          Router configuration
  styles.css          Initial compact-window visual foundation
src-tauri/            Native macOS application configuration
```

The current shell includes `/today` and `/inbox`. Task-domain logic, local persistence, menu-bar behavior, and AI are intentionally deferred until the deterministic task workflow is implemented.

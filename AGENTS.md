<!-- agentkit:start agents -->
# Slate agent guide

Slate is a local-first macOS planner for deciding what work realistically fits into today. The current product has the compact desktop shell, Today/Backlog/Settings workspace, SQLite persistence, task lifecycle operations, daily capacity state, and native Keychain storage. AI Assist and Plan My Day are planned 1.0 work and are not currently shipped.

## Source of truth

Read the relevant companion guidance before making changes:

- `DESIGN.md` for UI, interaction, layout, motion, and visual tokens.
- `CODE-QUALITY.md` for maintainability and implementation boundaries.
- `CHANGE-EXPLANATION.md` when handing work off.
- `docs/product-brief.md` for the current product contract.
- `docs/roadmap.md` for staged future direction.
- `docs/plans/` for implementation-specific plans.

`AGENTS.md` is the repository guidance source of truth. The Cursor and Claude adapter files point here and should remain thin.

## Project map

- `src/routes/`: file-based TanStack Router routes and page UI.
- `src/routes/__root.tsx`: shared Slate shell, navigation, and footer placement.
- `src/components/`: task, workspace, settings, and UI interactions.
- `src/lib/`: renderer/native planner boundary, query hooks, task grouping, and window behavior.
- `src/router.tsx`: router setup; `src/routeTree.gen.ts` is generated and must not be hand-edited.
- `src/styles.css`: Tailwind entry point and global design tokens.
- `src-tauri/src/`: native persistence, credentials, window, and tray behavior.
- `src-tauri/tauri.conf.json`: native window and bundle configuration.
- `docs/`: product documentation and implementation plans.

## Commands

Use npm with the committed `package-lock.json`.

| Purpose | Command |
| --- | --- |
| Run the web dev server | `npm run dev` |
| Run the desktop app | `npm run dev:desktop` |
| Build the web application and type-check | `npm run build` |
| Preview the web build | `npm run preview` |
| Run a Tauri subcommand | `npm run tauri -- <subcommand>` |

For a native release bundle, use `npm run tauri -- build`. The package currently has no dedicated test script; do not document one as a standard project command until it is added to `package.json`.

## Working rules

- Keep the task workflow deterministic and local-first unless the work explicitly expands that scope.
- Backlog contains captured but uncommitted work; Today contains deliberate commitments.
- Preserve the compact menu-bar popover. Essential daily behavior must remain usable at the configured minimum window size.
- Keep native behavior, persistence, credentials, and permissions scoped to `src-tauri/`.
- Treat SQLite as the local source of truth and use the existing native command boundary for privileged operations.
- Keep API keys in macOS Keychain. Never put secrets in planner snapshots, renderer state, SQLite, logs, or change events.
- AI and integrations must propose changes for review; they must not silently alter commitments.
- Add routes as files in `src/routes/`; never hand-edit generated router output.
- Prefer small, explicit components and domain functions over broad abstractions.
- Preserve user content outside AgentKit-managed blocks in guidance files.

## Before finishing

1. Read the relevant product, design, quality, or implementation guidance for the change.
2. Run the applicable real command from the table above when the change warrants validation.
3. Confirm route changes did not require edits to generated router output.
4. Check that desktop-specific changes remain usable in the compact popover and full window.
5. Review native permissions and persistence boundaries when changing `src-tauri/`.
6. Summarize user-visible behavior, changed files, deferred work, and validation performed.
<!-- agentkit:end agents -->

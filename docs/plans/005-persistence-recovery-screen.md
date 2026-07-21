# Persistence recovery screen

**Status:** Implemented on 2026-07-21.

## Objective

Let a running Slate window recover from a temporarily unavailable local SQLite database without requiring the user to quit and reopen the app. This can occur when a Mac wakes while Slate is already open.

## User experience

When the planner snapshot cannot be read, Slate replaces the normal shell with a compact recovery screen:

- Heading: “Slate needs to reconnect.”
- Copy explains that the Mac may still be waking and that Slate can reconnect without reopening.
- A **Refresh connection** action is the only primary action.
- While the reconnect attempt is in progress, the action is disabled and reads “Reconnecting…”.
- If the retry fails, Slate keeps the recovery screen visible and explains that the database is still unavailable, so the user can try again shortly.

The screen deliberately does not expose raw SQLite error strings. It uses the existing Slate semantic colors and compact-window-safe layout.

## Implementation

The native persistence layer already exposes `retry_persistence`:

1. It recreates the SQLite repository using Slate’s app-data directory.
2. It replaces the stored repository result only after the new initialization attempt finishes.
3. On success, it emits the existing `planner://changed` event.

`src/routes/__root.tsx` calls this command from the recovery action, then explicitly refetches the `plannerState` query. A successful refetch restores the normal shell. A failed command or refetch leaves the recovery screen active with retry feedback.

## Scope

Included:

- Planner snapshot read failures, including a failed focus-triggered refresh after the app regains focus.
- Reopening the existing local SQLite connection and reloading the in-memory planner snapshot.
- Visible pending and retry-failed states.

Not included:

- Database repair, reset, migration rollback, backup, or export flows.
- Cloud recovery or replacement storage.
- Retrying failed validation or ordinary task-action errors as database failures.
- Changes to the SQLite schema, stored data, or Tauri capabilities.

## Verification

- `npm run build` passes after the recovery screen implementation.
- Manual desktop verification should simulate an unavailable database or a wake/resume failure, then confirm that **Refresh connection** returns to the active route once SQLite is available.

# Implementation plan: SQLite persistence

## Objective

Replace Slate's mock task and settings state with a local, restart-safe SQLite database owned by the Tauri/Rust process. The popover and full app must read the same persisted data, while React uses TanStack Query only as a per-window cache and mutation layer.

## Decisions

| Decision | Choice |
| --- | --- |
| Branch | `feat/sqlite-persistence` from a clean worktree |
| Database | One bundled-SQLite `slate.sqlite` file in Tauri's app-data directory |
| Native access | Rust repository with typed Tauri commands; React never sends SQL |
| React cache | One TanStack Query `plannerState` snapshot per window |
| Window synchronization | Native `planner://changed` event invalidates each window's query after a committed mutation |
| Migrations | Numbered SQL embedded in the Rust binary and tracked with `PRAGMA user_version` |
| Task status | Derived from `completedAt`, `scheduledDate`, and `estimateMinutes`; never persisted separately |
| Task ordering | Persisted in a scoped `task_orders` table rather than one task `sortOrder` value |
| Preferences | Singleton SQLite settings row, including theme |
| Secrets | One macOS Keychain item per AI provider; no API key in SQLite or event payloads |
| Deletes | Hard delete with cascading order deletion; no trash or undo |
| AI plans | Reviewed assignments apply in one transaction or not at all |

## Storage model

### `tasks`

- `id`: native UUID primary key.
- `title`: required non-empty text.
- `estimate_minutes`: nullable positive integer.
- `scheduled_date`: nullable local `YYYY-MM-DD` calendar date.
- `created_at`: UTC ISO timestamp.
- `completed_at`: nullable UTC ISO timestamp.

The view derives states in this order: completed, needs estimate, unscheduled, today, overdue, or upcoming. Completion retains the scheduled date, so completed work remains visible for its day and in Log history.

### `task_orders`

Manual ordering is independent of task content. A row records `scope`, `task_id`, and `position`.

- `today:YYYY-MM-DD`
- `log:needs-estimate`
- `log:unscheduled`
- `log:upcoming`
- `log:overdue`

Completed tasks have no manual order. When no order row exists, the UI falls back to creation time and task ID. Old scope positions remain when a task moves, so returning it to a former collection can restore its prior position.

### `settings`

One row stores daily capacity (default 240), planning instruction (default blank), AI provider/model, and light/dark theme. The mock planning instruction is not seeded as user data.

## Native and frontend contract

The Rust layer exposes typed commands for loading the planner snapshot, task create/update/completion/date/delete/reorder operations, settings updates, atomic planner-plan application, and Keychain credential operations.

The snapshot contains tasks, order IDs by scope, settings, selected-provider Keychain availability, and the native local date. Input is validated in both React for fast feedback and Rust as the persistence authority.

Every successful mutation commits its SQLite transaction before emitting `planner://changed` with a process-local revision. The initiating query invalidates on mutation success; both webviews subscribe to the event and invalidate their own query. The popover also refetches on focus.

TanStack Query is not the source of truth and does not synchronize webviews by itself. Each Tauri window owns a distinct QueryClient; the native event is the bridge between those caches.

## Error behavior

- Database initialization, migration, read, and write failures are visible to the user; Slate does not silently fall back to unsaved state.
- Failed mutations leave the previous query data intact and show an actionable error.
- Multi-task AI plan acceptance is atomic. A bad assignment rolls back the full batch.
- API keys are passed only to the Keychain adapter and never appear in SQLite, planner snapshots, logs, or change events.

## Verification

- Rust repository tests cover migration/defaults, validation, completion, scoped ordering, hard deletion, and atomic rollback.
- `npm run build` type-checks and bundles the React application.
- `cargo test --manifest-path src-tauri/Cargo.toml` validates native persistence.
- Manual desktop verification confirms restart persistence, popover/full-window sync, focus refresh, settings/theme persistence, and Keychain-backed credential status.

## Out of scope

No export, backup UI, cloud sync, accounts, history/audit table, undo/trash, AI execution, or migration of existing mock data is included. Unsaved composer drafts and AI review UI remain transient.

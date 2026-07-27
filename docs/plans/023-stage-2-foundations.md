# Plan 023: Stage 2 planning foundations

> **Executor instructions:** Implement this plan as one coordinated foundation package. Preserve the existing local-first daily workflow and run the validation gates before considering the work complete.

## Status

- **Priority:** P1 after Slate 1.0 validation
- **Effort:** L
- **Risk:** HIGH — SQLite migrations and every task mutation boundary are affected
- **Category:** persistence / domain integrity / settings
- **Planned at:** 2026-07-27

## Objective

Add the smallest durable foundation needed for Stage 2 recovery and later calibration:

1. Append-only Planner Events.
2. Persisted task revisions and stale-write protection.
3. A reviewed atomic change-set contract, with Plan My Day as its first consumer.
4. Global or recurring weekday capacity configuration.
5. Date-scoped Anchor Commitments.

Released tasks and one-off calendar-date capacity overrides are intentionally excluded. Returning a task to Backlog remains the deliberate way to remove it from active planning.

## Product decisions

- `planner_events` is the single history ledger. Task and day history are derived by filtering the same table.
- `local_date` means the local calendar date when the action was accepted. `occurred_at` stores the exact UTC timestamp.
- Existing global capacity remains the default mode.
- Weekly mode stores independent Monday–Sunday values and preserves them when the user switches back to global mode.
- Global capacity remains a positive whole number. Weekly values may be zero to represent non-working days.
- Anchors are limited to two active Today tasks per date.
- Anchor management lives in task detail; Today rows show a quiet non-interactive indicator.
- Stale validation applies to all existing-task writes, including manual edits, completion, scheduling, deletion, ordering, AI acceptance, and reviewed change sets.
- A dirty task-detail draft is preserved and blocked when another window changes the task. The user must explicitly review the latest state.
- Plan My Day is refactored to use the shared change-set acceptance path.
- No history UI or public event-query command ships in this plan.

## Data and API changes

### SQLite migration

Add migration 3 in `src-tauri/src/persistence.rs`:

- Add `tasks.revision INTEGER NOT NULL DEFAULT 1`.
- Add nullable `tasks.anchor_date`.
- Add `settings.capacity_mode` with `global` and `weekly` values.
- Add seven weekday capacity columns to `settings`.
- Seed every weekday value from the existing `daily_capacity_minutes` value.
- Create `planner_events` with:
  - `id`
  - nullable `task_id`
  - `local_date`
  - `occurred_at`
  - `kind`
  - `source`
  - `operation_id`
  - nullable `before_json`
  - nullable `after_json`
- Index events by task/date and operation ID.
- Do not foreign-key event task IDs so deleted-task history remains queryable.
- Add an idempotent `history-started` event for each task created before the ledger existed.

### Renderer contracts

Extend `src/lib/planner.ts` with:

```ts
type CapacityMode = "global" | "weekly";
type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";
```

Add `revision` and `anchorDate` to `Task`, weekly capacity fields and mode to `Settings`, and `effectiveCapacityMinutes` to `PlannerSnapshot`.

Keep `dailyCapacityMinutes` as the persisted global value to avoid an unnecessary broad rename.

Add `expectedRevision` to every existing-task mutation input. Add a validated source to task creation and Settings saves so accepted events identify manual, onboarding, AI Assist, or Plan My Day changes.

## Implementation changes

### Planner Events

- Generate event IDs and operation IDs natively.
- Read before-state, validate, mutate, increment revisions, and write event rows in one SQLite transaction.
- Store only changed, non-secret fields in before/after JSON.
- Use explicit event kinds for creation, updates, commits, Backlog returns, completion, reopening, ordering, Anchors, deletion, capacity settings, and history boundaries.
- Use current sources `manual`, `onboarding`, `ai-assist`, and `plan-my-day`; leave the column extensible for future quick capture and recovery.
- Do not record API keys, prompts, model output, dismissed proposals, or full planner snapshots.

### Revisions and stale writes

- Increment task revisions for every accepted existing-task mutation.
- Validate expected revisions inside the mutation transaction and return a stable stale-state error without writing anything when they differ.
- Reordering sends expected revisions for every task in the scope, validates the authoritative scope membership, writes the order, and increments affected revisions.
- Keep `planner://changed` as a refresh notification only; it is not the concurrency guard.
- For task detail, refresh clean drafts normally. Preserve dirty drafts when a newer revision arrives, mark them stale, disable Save, and provide `Review latest`.
- Roll back optimistic UI and refresh on stale completion or reorder failures.

### Reviewed atomic change sets

- Remove the unused legacy `apply_planner_plan` command and renderer hook.
- Add a strict reviewed-change-set contract containing source, expected task revisions, expected effective capacity, expected Today state/order, ordered operations, reasons, and before/after totals.
- Keep proposals transient until acceptance.
- Validate every revision, capacity value, task eligibility, Anchor constraint, and resulting order before writing.
- Apply all task changes, order changes, revisions, and Planner Events in one transaction; any conflict causes zero writes.
- Refactor Plan My Day to use this shared acceptance path while preserving its additive behavior and existing commitments.

### Global and weekly capacity

Update the Daily capacity group in `src/routes/settings.tsx`:

- Add a compact `Same every day` / `By weekday` selector.
- Show the existing single input in global mode.
- Show seven compact Monday–Sunday inputs in weekly mode.
- Preserve both global and weekly values across mode changes.
- Allow zero for weekly values.
- Keep the existing single Settings draft and Save changes transaction.
- Keep onboarding on global mode.

Compute effective capacity from the current local date in the native layer. Use it for the Planner snapshot, Today header/progress, capacity calculations, and Plan My Day context. A zero-capacity day is valid and produces a no-capacity planning result.

Write one `capacity-settings-updated` event when mode or capacity values change. Never include credential data.

### Anchors

- Permit an Anchor only for incomplete, estimated tasks scheduled for today.
- Enforce a maximum of two active Anchors for a date in native validation.
- Add an `Anchor for today` toggle to the task-detail draft for eligible Today tasks.
- Show a quiet Anchor indicator on Today rows.
- Clear the Anchor when a task is completed, returned to Backlog, or scheduled for another date.
- Do not restore an Anchor when a task is reopened or rescheduled.
- Include Anchor state in task revisions, event payloads, and change-set validation.
- Preserve Anchors in Plan My Day and require explicit unlock behavior in future recovery change sets.

### Documentation

Update `docs/roadmap.md` and `docs/daily-resilience.md` to replace one-off date overrides with recurring weekday capacity, remove Released as a Stage 2 state, and document the final Planner Events, revision, change-set, and Anchor contracts.

## Test and acceptance plan

### Native persistence tests

- Fresh databases default to global mode and 240 minutes for every weekday.
- Existing v2 databases preserve settings and tasks through migration.
- Weekly values seed from the old global value.
- Existing tasks receive exactly one history boundary.
- Global and weekday effective-capacity calculations work, including zero.
- Invalid capacity modes, negative weekly values, invalid Anchor dates, and excessive Anchors are rejected.

### Event tests

- Each accepted mutation writes the correct kind, source, action date, operation ID, and changed fields.
- Multi-task acceptance shares one operation ID.
- Failed transactions write no events.
- Deleted-task history remains queryable by task ID.
- Event payloads never contain credentials or AI request data.

### Revision and change-set tests

- Stale edit, completion, scheduling, deletion, Anchor, reorder, and Plan My Day acceptance perform no writes.
- Successful writes increment revisions exactly once per affected task.
- Reordering validates current scope membership and rolls back atomically.
- One stale task, changed capacity, changed Today order, or invalid Anchor rejects the entire change set.
- Valid Plan My Day acceptance changes every selected task and writes matching events atomically.

### Renderer and manual verification

- Settings draft equality preserves capacity mode and all seven weekday values.
- Weekly Settings mode remains usable at the 360 × 520 minimum.
- Dirty task drafts survive cross-window refresh and expose the stale/review flow.
- Anchor controls are keyboard accessible and visibly indicated without relying on color alone.
- Run `cargo test --manifest-path src-tauri/Cargo.toml` and `npm run build`.


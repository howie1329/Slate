# Plan 018: Complete the task lifecycle

> **Executor instructions**: Follow this plan step by step. Run the verification commands and manual acceptance checks before moving to the next step. If a STOP condition occurs, stop and report rather than expanding the scope.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug / workflow completion
- **Planned at**: commit `fc76d44`, 2026-07-24

## Objective

Finish the manual task loop promised by the product contract:

1. Capture work in Backlog.
2. Schedule and commit work to Today.
3. Complete it without losing the record.
4. Edit it, deliberately return it to Backlog, or delete it.

This plan addresses two gaps:

- Completed tasks whose scheduled date is not today currently receive no renderer scope and disappear from Backlog.
- The task-detail date editor can assign a date but cannot clearly clear one and return the task to Backlog.

The fix must keep completed work scheduled for today in Today’s Done history, while making completed work outside today discoverable in Backlog.

## Product and design constraints

- Backlog remains the route and user-facing label; do not introduce a new Log route or navigation item.
- Today contains deliberate commitments and completed history for the current date only.
- Completed tasks do not count toward active capacity and are not automatically rescheduled.
- A completed task outside today belongs in a display-only **Completed** Backlog group, regardless of whether its retained date is null, past, or future.
- Completed ordering is history, not a user-managed task order. Keep completed tasks out of `task_orders` and do not add a persisted `log:completed` order scope.
- “Return to Backlog” clears only the draft scheduled date until the existing Save action is confirmed. It must not silently write or delete the task.
- Use the existing Button, Popover, Calendar, task-row, motion, and semantic focus patterns. Use design tokens from `src/styles.css`; do not add decorative color, shadows, or a new control system.
- The compact popover remains the primary surface and must work at the configured 360 × 520 minimum size.
- No AI, account, network, permission, or native capability changes are part of this fix.

## Current state

- `src/lib/task-groups.ts:18` returns `null` for every completed task, so completed tasks cannot be classified for Backlog.
- `src/routes/backlog.tsx:34-39` renders only Needs estimate, Unscheduled, Overdue / needs reschedule, and Upcoming groups. Its visibility check also filters out every completed task.
- `src/routes/today.tsx` deliberately keeps completed tasks in a separate Done group by reading all tasks scheduled for today.
- `src/components/task-detail-panel.tsx:275-301` lets the Calendar choose a date, but its guarded `onSelect` handler has no clear-date action.
- `src-tauri/src/persistence.rs` already accepts `scheduledDate: null` through `update_task`, validates it, persists it, and moves an active task into `log:unscheduled`. No native API or migration is required.
- The repository has no renderer test script. Native persistence tests run with Cargo, and the application build is the renderer/type-check gate.

## Scope

### In scope

- `src/lib/task-groups.ts`
  - Add a display scope for completed tasks outside Today.
  - Preserve Today as the display scope for completed tasks scheduled today.
  - Add deterministic newest-completed-first ordering for the Completed history group.
- `src/routes/backlog.tsx`
  - Render a Completed group.
  - Include completed tasks outside Today in visibility and empty-state calculations.
  - Keep existing active-group ordering and completion/restore behavior.
- `src/routes/today.tsx`
  - Ensure the active To do list filters `completedAt === null` explicitly after scope classification is expanded.
  - Preserve the current Done list and capacity behavior.
- `src/components/task-detail-panel.tsx`
  - Add an explicit Return to Backlog action inside the date popover when a task has a scheduled date.
  - Clear the local draft date and leave the existing Save mutation as the confirmation boundary.
- `src-tauri/src/persistence.rs`
  - Add a focused regression test for updating a dated active task to a null scheduled date and verifying its persisted unscheduled scope/order.

### Out of scope

- SQLite schema or migration changes.
- New Tauri commands, query hooks, events, or permission changes.
- Changing the meaning of `completedAt`, deleting completion history, or adding undo/trash.
- Persisting a completed-task order or adding drag-and-drop to Completed.
- Changing Today capacity math, AI eligibility, Plan My Day, routing, or generated `src/routeTree.gen.ts`.
- Adding a new renderer test framework or package script solely for this fix.

## Intended behavior

| Task state | Today | Backlog |
|---|---|---|
| Active, scheduled today | To do | Not shown |
| Completed, scheduled today | Done | Not shown |
| Active, no date / past date / future date / no estimate | Not shown | Existing active group |
| Completed, no date / past date / future date | Not shown | Completed |

Restoring a Completed task uses its retained scheduled date: it returns to Today when that date is today, otherwise to Unscheduled, Overdue, or Upcoming. Clearing a date from any dated task and saving it makes the task unscheduled; if it is completed, it remains in Completed history with no date.

## Commands and expected gates

| Purpose | Command | Expected result |
|---|---|---|
| Native persistence regression | `cargo test --manifest-path src-tauri/Cargo.toml` | All native tests pass. |
| Renderer build and type-check | `npm run build` | Vite build and TypeScript exit 0. |
| Diff hygiene | `git diff --check` | No output and exit 0. |

There is no committed root test script; do not add or document one as a standard command for this change.

## Steps

### Step 1: Extend renderer task classification without changing persistence scopes

In `src/lib/task-groups.ts`:

1. Rename `ActiveTaskScope` to a broader task display-scope type if needed, or extend the existing type with `"log:completed"`.
2. Update `scopeForTask` so the completed branch runs first:
   - completed and scheduled for `today` → `today:${today}`;
   - completed with any other date, including `null` → `log:completed`.
3. Leave the active branches unchanged: Needs estimate, Today, Unscheduled, Overdue, and Upcoming.
4. Add a small `orderCompletedTasks` helper that sorts by `completedAt` descending, with deterministic `createdAt` and `id` fallbacks. Do not route this group through `orderByScope`.

The Today route must then filter `completedAt === null` when constructing `activeTasks`; otherwise a completed task dated today would be classified into the Today scope and rendered in both To do and Done. The shared header/capacity consumers should continue to filter active tasks or rely on `calculateCapacityState` skipping completed work.

**Verify**: inspect every `scopeForTask` call with `rg -n "scopeForTask|ActiveTaskScope|TaskScope" src`; confirm Today’s active list has an explicit incomplete-task filter and no native scope validator is being expanded.

### Step 2: Add Completed to Backlog and preserve empty-state behavior

In `src/routes/backlog.tsx`:

1. Add `['Completed', 'log:completed']` after the active groups.
2. Remove the `completedAt === null` restriction from the overall Backlog visibility calculation, relying on the display scope to keep completed Today history in Today and completed work outside Today in Backlog.
3. For the Completed group, use `orderCompletedTasks`; keep `orderTasks` for all active groups so existing persisted ordering remains unchanged.
4. Keep the existing `toggleTask` mutation. Completing an active task should animate it into Completed; restoring a completed task should animate it back into the active scope determined by its retained date.
5. Ensure the empty state appears only when no active Backlog task and no completed-outside-Today task is visible. A Completed-only Backlog is not empty.

Do not add `log:completed` to native `validate_scope`, `move_task_to_scope_start`, or the persisted order model. The renderer scope is for display grouping only; completed tasks remain unorderable history as documented in the persistence plan.

**Verify**: inspect the rendered group list and filters; confirm a completed task scheduled today is not duplicated in Backlog, while a completed task with a null, past, or future date is shown under Completed.

### Step 3: Make returning to Backlog an explicit date-editor action

In `src/components/task-detail-panel.tsx`:

1. Keep the existing Calendar for assigning or changing a date.
2. When `scheduledDate !== null`, render a clearly labelled, keyboard-operable `Button` inside the PopoverContent with the user-facing label **Return to Backlog**.
3. On activation, call `setScheduledDate(null)` only. Do not call `updateTask` from the popover and do not close the task-detail panel automatically.
4. Preserve the existing dirty-state and Save behavior: the date trigger should show `Set date`, the Save button should enable, and the existing `updateTask` mutation should persist `scheduledDate: null`.
5. Ensure the action has visible focus, readable text at compact width, and does not depend on color alone. Use a quiet separator or stacked layout if needed so the Calendar and action remain legible in the popover.

The existing native `update_task` path already validates a null date, persists it, and moves an active dated task to the start of `log:unscheduled`. It should be reused rather than adding a special “return” command.

**Verify**: inspect the panel state flow for dated, undated, completed, and unsaved tasks; confirm clearing a date can be abandoned by dismissing the panel before Save and is only persisted after Save.

### Step 4: Add a native regression test for the existing null-date update path

In the existing test module in `src-tauri/src/persistence.rs`, add a focused test using `TestDatabase`:

1. Create an estimated task.
2. Update it to the current local date and confirm it enters the Today order scope.
3. Update the same task with `scheduled_date: None`.
4. Assert the stored task has `scheduled_date == None` and the snapshot places it at the start of `log:unscheduled`.

This protects the renderer’s new Return to Backlog action against accidental changes to the existing persistence contract. Do not add a migration or alter the command payload.

**Verify**: run `cargo test --manifest-path src-tauri/Cargo.toml` and confirm the new regression passes with the existing completion, ordering, deletion, and planner tests.

### Step 5: Run build and manual lifecycle acceptance

Run `npm run build`, then `git diff --check`. Perform desktop acceptance in both the compact popover and full window, including keyboard interaction and reduced-motion-safe state changes where practical.

Manual matrix:

- Complete an unscheduled task → it remains in Backlog under Completed.
- Complete an overdue and a future-dated task → both remain under Completed, not Overdue or Upcoming.
- Complete a task scheduled today → it remains only in Today / Done.
- Restore each Completed case → it returns to Today, Unscheduled, Overdue, or Upcoming according to its retained date.
- Open a dated active task, choose Return to Backlog, dismiss without saving → the original date remains.
- Choose Return to Backlog and Save → the task appears under Unscheduled and survives reopening.
- Clear the date on a completed Today task and Save → it moves from Today / Done to Backlog / Completed.
- Complete or restore the only item in a group → the group exit animation and Backlog empty state remain correct.
- Use the date popover and Return to Backlog action at 360 × 520 → no essential control is clipped or unreachable.

## Done criteria

- [ ] Completed tasks outside Today are visible in a Backlog Completed group.
- [ ] Completed Today tasks remain visible only in Today / Done and do not count toward active capacity.
- [ ] Completed ordering is deterministic and does not create persisted task-order state.
- [ ] Completing and restoring tasks moves them between groups without losing the retained scheduled date.
- [ ] A dated task exposes an explicit Return to Backlog action.
- [ ] Return to Backlog is draft-only until the existing Save action succeeds.
- [ ] Saving a cleared date persists `scheduledDate: null` and places active tasks in Unscheduled.
- [ ] Native persistence regression tests pass.
- [ ] `npm run build` exits 0.
- [ ] `git diff --check` produces no output.
- [ ] No generated router output or unrelated native capability is changed.
- [ ] Manual compact-popover and full-window acceptance passes.

## STOP conditions

Stop and report instead of improvising if:

- `update_task` no longer accepts a null scheduled date or no longer moves active tasks into `log:unscheduled`.
- The current product contract changes the meaning of completed Today history or Backlog terminology.
- A `log:completed` scope would be persisted or require changing native ordering validation; reassess the model before proceeding.
- The new classification causes completed Today tasks to appear in both Today and Backlog, or causes them to enter active capacity totals.
- The Return to Backlog action cannot fit or remain keyboard-operable in the minimum popover without changing the task-detail interaction model.
- The change appears to require a database migration, new route, new dependency, or AI behavior.

## Deferred work

- End-of-day review and explicit “keep, reduce, release, or return” choices remain roadmap Stage 2 work.
- Completed history search, archival, bulk actions, undo/trash, analytics, and cross-device sync remain out of scope.

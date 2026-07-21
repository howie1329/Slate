# Implementation plan: Today capacity state and overflow-task indicator

> **Assumption:** “red water” means a red visual treatment, specifically a red border/accent around the task that causes Today to exceed capacity.

## Objective

Make Today’s capacity state immediately legible. Show remaining minutes while the plan is within capacity; show the numerical overage once the plan exceeds capacity; and visually identify the active task that causes the running total to cross the capacity limit.

## Current state

- `src/routes/today.tsx` derives active Today tasks and sums their estimates at lines 21–35.
- The summary currently displays committed minutes as `{committedMinutes} / {capacityMinutes} min`.
- The progress bar clamps its visual width at 100%, so an over-capacity state is not visually distinct.
- `src/lib/task-groups.ts` already provides the ordered task list used by Today.
- The MVP brief requires Today to show remaining capacity, over-capacity state, and the offending task; completed tasks must not count toward active capacity.

## Desired behavior

For a 240-minute capacity:

- 180 committed minutes shows `60 min remaining`.
- 240 committed minutes shows `0 min remaining` with no warning state.
- 285 committed minutes shows `45 min over capacity`.

When over capacity, the progress bar uses the destructive/red semantic token and the active task that first pushes the cumulative ordered total above capacity receives the red border/accent. Completed tasks never receive this treatment.

Title-only tasks remain in Needs estimate and do not count toward Today capacity or become the overflow task.

## Scope

In scope:

- `src/routes/today.tsx`
- `src/lib/task-groups.ts`
- A small shared capacity-state helper if needed.
- Existing semantic destructive styling tokens only.

Out of scope:

- SQLite schema or persistence changes.
- AI planning.
- Drag-and-drop ordering.
- Log redesign.
- Return-to-Log behavior.
- Capacity settings.

## Implementation steps

### 1. Add deterministic capacity calculations

Add a small helper in `src/lib/task-groups.ts` or another focused planner utility. It should calculate:

- `committedMinutes`
- `remainingMinutes`
- `overageMinutes`
- `isOverCapacity`
- `overflowTaskId`

Calculate the overflow task by walking active Today tasks in their current display order and returning the first task whose cumulative estimate exceeds capacity. Only tasks with positive estimates participate in this calculation.

If the current grouping behavior allows an unestimated task scheduled for today to enter Today, correct the derived grouping so the missing-estimate state takes precedence and remains in Log.

### 2. Update Today’s summary

In `src/routes/today.tsx`, replace the current committed-minute label with:

- `{remainingMinutes} min remaining` when within capacity.
- `{overageMinutes} min over capacity` when over capacity.

Keep committed and capacity values in the progress bar’s accessible description so the total remains available to assistive technology.

### 3. Update progress-bar semantics and styling

- Keep the progress fill capped at 100% visually.
- Use the existing primary token while within capacity.
- Use the existing destructive token when over capacity.
- Add `aria-valuetext` describing the actual state, such as `45 minutes over capacity`.
- Preserve reduced-motion behavior.

### 4. Highlight the overflow task

When a task ID matches `overflowTaskId`, add a red border or accent to its existing task row/button. The treatment must:

- Apply only to active tasks.
- Not alter task data or persistence.
- Work in light and dark themes.
- Remain usable in the compact 360×520 viewport.
- Preserve existing focus-visible styling.

## Verification

Run:

```bash
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

Manual checks:

1. With 180 committed minutes and 240 capacity, Today shows `60 min remaining`.
2. At exactly 240 minutes, Today shows `0 min remaining` and no red state.
3. At 285 minutes, Today shows `45 min over capacity`, the meter is red, and the overflow-causing active task has the red treatment.
4. Completing the highlighted task recalculates capacity and removes or moves the warning state.
5. A title-only task remains in Needs estimate and does not affect capacity.
6. Completed tasks do not count toward capacity and never receive the overflow treatment.
7. Verify both light and dark themes at 440×640 and 360×520.

## Done criteria

- [ ] Today shows remaining minutes under capacity.
- [ ] Today shows numerical overage above capacity.
- [ ] The progress bar visually distinguishes over-capacity state.
- [ ] The task that crosses the capacity threshold receives the red treatment.
- [ ] Completed and unestimated tasks are excluded from overflow calculation.
- [ ] `npm run build` passes.
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` passes.
- [ ] No persistence, AI, Log, or drag-and-drop behavior changes are introduced.

## Planned at

Commit `8865b6c`, 2026-07-21.

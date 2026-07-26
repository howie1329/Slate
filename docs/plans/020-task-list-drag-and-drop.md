# Plan 020: Add task-list drag-and-drop ordering with dnd-kit

> **Executor instructions**: Follow this plan step by step. Run the baseline and verification commands at the stated gates. If a STOP condition occurs, stop and report rather than broadening the feature.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MEDIUM
- **Depends on**: existing `reorder_tasks` Tauri command and scoped `task_orders` persistence
- **Category**: feature / task workflow
- **Planned at**: commit `7fd30ac`, 2026-07-25
- **Implementation status**: implementation and release acceptance complete for Slate 1.0.0

## Objective

Finish the task-ordering interaction promised by Slate's product contract:

1. Reorder active Today tasks with a pointer or keyboard.
2. Reorder active Backlog tasks inside their current display group.
3. Persist the complete order for the affected scope through the existing local SQLite boundary.
4. Keep checkbox, selection, completion, capacity, Motion, compact-popover, and reduced-motion behavior intact.

Use the established dnd-kit packages rather than the newer pre-1.0 `@dnd-kit/react` API:

- `@dnd-kit/core@6.3.1`
- `@dnd-kit/sortable@10.0.0`
- `@dnd-kit/modifiers@9.0.0`
- `@dnd-kit/utilities@3.2.2`

These versions support the existing React 19 application and provide the sortable, keyboard, accessibility, transform, and vertical-axis primitives needed without imposing a new component system.

## Product and design constraints

- Today contains deliberate commitments; Backlog contains uncommitted work.
- Reordering changes priority within the task's current derived scope. It must not schedule, unschedule, complete, restore, or otherwise move a task between semantic groups.
- Active Today tasks and the four active Backlog groups are reorderable:
  - `today:${today}`
  - `log:needs-estimate`
  - `log:unscheduled`
  - `log:overdue`
  - `log:upcoming`
- Today / Done and Backlog / Completed are history views and remain unorderable.
- Dragging must not be the only interaction. The same handle must support dnd-kit's keyboard movement flow with screen-reader instructions and announcements.
- Preserve semantic `<ul>` / `<li>` task lists, labelled groups, visible focus, readable contrast, and standard button behavior.
- Use existing semantic color tokens. A dragged row may use the existing `muted`, `ring`, `border`, and `primary` roles; do not add a decorative shadow, new accent, or floating-card treatment.
- Keep the feature usable at the 360 × 520 minimum popover size and in the full window.
- Respect macOS Reduced Motion. dnd-kit should provide only direct manipulation feedback during an active drag; existing Motion behavior remains responsible for confirmed task lifecycle changes.
- SQLite remains authoritative. No renderer-only order may be treated as durable until the native write succeeds.
- No route, generated router, AI, credential, network, Tauri permission, or database migration changes are part of this feature.

## Current state

- `src/components/task-group.tsx` renders reusable semantic task groups and owns the existing `AnimatePresence` boundary.
- `src/components/task-row.tsx` renders each row as `motion.li`; its checkbox and edit button already have distinct interaction responsibilities.
- `src/routes/today.tsx` derives and orders the active Today list with `orderTasks`.
- `src/routes/backlog.tsx` derives five independent groups. The four active groups use `orderTasks`; Completed uses history ordering.
- `src/lib/task-groups.ts` defines the display scopes and resolves persisted positions from `orderByScope`.
- `src/lib/planner.ts` already exposes `reorderTasks({ scope, taskIds })`.
- `src/lib/planner-query.tsx` already exposes `useReorderTasks`, but it currently performs only a write followed by query invalidation.
- `src-tauri/src/persistence.rs` validates supported scopes and writes the supplied order transactionally to `task_orders`.
- Native persistence coverage already proves that scoped ordering survives snapshot reads and that tasks entering a scope are inserted at its start.
- The repository has no renderer test command. Do not add a test framework solely for this feature.

## Scope

### In scope

- Create a dedicated feature branch before implementation.
- Install the four dnd-kit packages listed above with npm and commit the resulting `package-lock.json`.
- Add pointer and keyboard sortable behavior to active task groups.
- Add a dedicated, labelled drag handle without changing checkbox or edit-button activation.
- Restrict movement to the vertical axis and the current task group.
- Add optimistic query-cache ordering, rollback on failure, canonical refetch after settlement, and user-visible failure feedback.
- Preserve task selection and keyboard focus after a successful reorder.
- Preserve existing task lifecycle and Motion behavior.
- Validate persistence, compact layout, reduced motion, pointer behavior, keyboard behavior, scrolling, and restart durability.

### Out of scope

- Dragging between Today and Backlog.
- Dragging between Backlog groups.
- Reordering completed tasks.
- Multi-select dragging, external drag-in capture, board lanes, scheduling previews, undo history, or cross-device synchronization.
- A custom drag preview or `DragOverlay` unless direct-row dragging proves unusable during manual acceptance.
- Changes to task classification, capacity calculation, route structure, SQLite schema, native permissions, or AI planning.
- Migrating to the pre-1.0 `@dnd-kit/react` package during this feature.
- Adding a renderer test runner or broad drag-and-drop abstraction for future board work.

## Intended behavior

| Surface | Pointer | Keyboard | Persistence |
| --- | --- | --- | --- |
| Today / To do | Drag by the dedicated handle within the list | Focus handle, start drag, move with arrow keys, drop or cancel | Save full `today:${today}` ID order |
| Today / Done | No drag handle | No reorder action | No persisted completed order |
| Active Backlog group | Drag by the dedicated handle within that group | Same keyboard flow, confined to the group | Save full active group ID order |
| Backlog / Completed | No drag handle | No reorder action | Keep newest-completed-first history order |

A successful drop updates the visible order immediately, persists the complete ordered ID list for one scope, then reconciles with the authoritative snapshot. A failed write restores the previous visible order and shows a concise error toast.

Canceling a drag with Escape or dropping outside a valid target performs no write. A no-op drop on the original position performs no write.

## Architecture decisions

### One sortable context per group

Give each reorderable `TaskGroup` its own `DndContext` and `SortableContext` using `verticalListSortingStrategy`. This naturally prevents cross-group drops and keeps scope ownership explicit.

Do not place one broad drag context around the Today or Backlog route. Cross-group movement changes task meaning and would require scheduled-date or estimate mutations that are outside this feature.

### Routes own persistence intent

Keep route components responsible for selecting the native scope and invoking the mutation:

- `TodayWorkspace` passes `todayScope` and an active reorder callback to To do.
- `BacklogWorkspace` passes each active group's existing scope and the same reorder callback.
- Done and Completed omit reorder props.

`TaskGroup` may own dnd-kit event mechanics, but it should report the complete reordered ID list through a small explicit callback such as:

```ts
onReorderTasks?: (taskIds: string[]) => void;
```

This keeps native domain payload construction out of the presentational component.

### Optimistic ordering belongs in the query hook

Specialize `useReorderTasks` instead of adding local order state to every group:

1. Cancel an in-flight planner-state refetch.
2. Snapshot the previous `PlannerSnapshot`.
3. Optimistically replace only `orderByScope[input.scope]`.
4. Restore the previous snapshot on error.
5. Invalidate the planner-state query after success or failure so SQLite wins.

Disable additional reorder attempts while the mutation is pending. This avoids overlapping full-order writes and makes failure rollback deterministic.

### Separate dnd-kit and Motion transform ownership

dnd-kit and Motion both use CSS transforms. They must not write `transform` on the same DOM element.

Refactor the row boundary so:

- an outer semantic `<li>` receives dnd-kit's ref, transform, and transition;
- an inner `motion.div` retains entry, exit, selection, lifecycle, and layout animation behavior;
- the drag handle receives `setActivatorNodeRef`, listeners, and accessibility attributes;
- plain non-sortable rows continue through the same visual `TaskRow` implementation without calling sortable hooks.

Prefer a small `SortableTaskRow` wrapper over conditional hook calls. Do not build a generic drag framework.

### Direct manipulation feedback

Use:

- `closestCenter` collision detection;
- `restrictToVerticalAxis`;
- a small pointer activation distance to prevent accidental activation;
- `arrayMove` to calculate the next complete order;
- a quiet dragged-row state using existing tokens;
- the list's normal sortable displacement as the drop-position preview.

Do not add bounce, overshoot, a decorative floating card, or a custom overlay unless manual testing demonstrates a concrete clipping or scrolling problem.

## Official dnd-kit references

Read these before implementation and use the established-package examples:

- [Installation](https://dndkit.com/legacy/introduction/installation) — established package setup.
- [Sortable overview](https://dndkit.com/legacy/presets/sortable/overview) — `DndContext`, sensors, collision detection, and sorting strategy.
- [SortableContext](https://dndkit.com/legacy/presets/sortable/sortable-context) — ordered item IDs and vertical list strategy.
- [useSortable](https://dndkit.com/legacy/presets/sortable/use-sortable) — sortable refs, transforms, transitions, and dedicated activator nodes.
- [Keyboard sensor](https://dndkit.com/legacy/api-documentation/sensors/keyboard) — keyboard activation and sortable coordinate getter.
- [Accessibility](https://dndkit.com/legacy/guides/accessibility) — instructions, announcements, and focus requirements.
- [Modifiers](https://dndkit.com/legacy/api-documentation/modifiers) — vertical-axis and container restrictions.
- [Current migration guide](https://dndkit.com/react/guides/migration) — documents the separate newer `@dnd-kit/react` API; do not mix the two API generations.

Relevant Slate guidance:

- `AGENTS.md`
- `DESIGN.md`
- `CODE-QUALITY.md`
- `docs/product-brief.md`
- `docs/roadmap.md`
- `docs/animation-brief.md`
- `docs/plans/001-mvp-daily-planning-loop.md`
- `docs/plans/018-complete-task-lifecycle.md`

## Commands and expected gates

| Purpose | Command | Expected result |
| --- | --- | --- |
| Confirm clean starting point | `git status --short` | No unrelated changes; this plan file may be the only pending change |
| Create feature branch | `git switch -c feat/task-list-drag-and-drop` | New branch created from the intended integration base |
| Baseline renderer gate | `npm run build` | Vite build and TypeScript exit 0 before implementation |
| Install dependencies | `npm install @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0 @dnd-kit/modifiers@9.0.0 @dnd-kit/utilities@3.2.2` | `package.json` and `package-lock.json` contain only the intended additions |
| Native regression suite | `cargo test --manifest-path src-tauri/Cargo.toml` | Existing persistence tests pass |
| Final renderer gate | `npm run build` | Vite build and TypeScript exit 0 |
| Diff hygiene | `git diff --check` | No output and exit 0 |

## Implementation steps

### Step 1: Create the feature branch and establish a clean baseline

1. Confirm the intended integration base with `git branch --show-current`.
2. Run `git status --short`.
3. If the worktree contains changes other than this plan file, stop and resolve ownership before continuing. The uncommitted `docs/plans/020-task-list-drag-and-drop.md` file may move onto the new feature branch with the implementation. Do not discard, reset, or absorb unrelated work into this feature.
4. Create the branch:

   ```sh
   git switch -c feat/task-list-drag-and-drop
   ```

5. Run `npm run build`.
6. If the baseline build fails, stop and record the pre-existing failure before changing dependencies or source.

**Verify**: `git branch --show-current` prints `feat/task-list-drag-and-drop`, the worktree contains no unrelated pre-existing changes, and the baseline renderer build passes.

### Step 2: Install only the selected dnd-kit packages

Run:

```sh
npm install @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0 @dnd-kit/modifiers@9.0.0 @dnd-kit/utilities@3.2.2
```

Inspect `package.json` and `package-lock.json`:

- Confirm the four packages are runtime dependencies.
- Confirm npm did not replace React, Motion, TanStack, Tauri, or unrelated packages.
- Do not install `@dnd-kit/react`, `react-dnd`, `react-beautiful-dnd`, `@hello-pangea/dnd`, or React Aria components.

**Verify**: run `npm run build` immediately after installation so peer-dependency or TypeScript incompatibilities are caught before UI changes.

### Step 3: Make the reorder mutation optimistic and reversible

In `src/lib/planner-query.tsx`, replace the generic `usePlannerMutation` implementation used by `useReorderTasks` with a focused mutation:

1. Cancel planner-state refetches before applying the optimistic result.
2. Capture the previous `PlannerSnapshot`.
3. Update only the submitted scope in `orderByScope`.
4. Preserve every other snapshot field and scope order.
5. Restore the previous snapshot when the native call rejects.
6. Invalidate `plannerStateQueryKey` in `onSettled`.
7. Return enough mutation state for routes to disable reorder handles and show failure feedback.

Do not alter the native payload, create a second renderer source of truth, or optimistically change task dates, completion, capacity settings, or task data. Capacity-derived row state may recalculate naturally from the optimistic Today order.

**Verify**: inspect the cache updater for immutable snapshot updates and confirm a failure restores the exact prior `orderByScope`.

### Step 4: Add a focused sortable task-group boundary

In `src/components/task-group.tsx`, add optional reorder props with a small API:

- a stable `scope` or `reorderScope` identifier;
- `onReorderTasks(taskIds)`;
- a disabled or pending flag.

When reorder is enabled:

1. Create memoized pointer and keyboard sensors.
2. Configure `KeyboardSensor` with `sortableKeyboardCoordinates`.
3. Use `closestCenter` collision detection.
4. Apply `restrictToVerticalAxis`; add a parent-bound restriction only if compact-window testing proves it improves behavior without blocking auto-scroll.
5. Render a `SortableContext` whose `items` exactly match `tasks.map(task => task.id)` in visible order.
6. Use `verticalListSortingStrategy`.
7. On drag end:
   - ignore canceled, missing-target, pending, and same-position results;
   - compute the next full ID order with `arrayMove`;
   - invoke `onReorderTasks` once.
8. On drag cancel, perform no mutation.

When reorder props are absent, preserve the current plain list path for Done and Completed.

Do not allow a task ID from outside the current `tasks` array to enter the payload.

**Verify**: Today and each active Backlog group produce an independent context and complete scope-local order; Done and Completed do not create a sortable context.

### Step 5: Add the dedicated sortable row and preserve Motion

Refactor `src/components/task-row.tsx` and, if useful, add one focused component such as `src/components/sortable-task-row.tsx`.

Requirements:

1. Keep one semantic `<li>` per task.
2. Put dnd-kit's transform and transition on the outer `<li>`.
3. Keep Motion layout, entry, exit, and lifecycle variants on a nested element so transform ownership does not overlap.
4. Pass `setActivatorNodeRef`, listeners, and attributes only to a dedicated button handle.
5. Keep the checkbox responsible only for completion.
6. Keep the title/body button responsible only for task selection and editing.
7. Label the handle with the task title and current position, for example: `Reorder Write release notes, position 2 of 5`.
8. Expose a visible focus ring and reveal the quiet handle on row hover or handle focus. Do not rely on color alone.
9. Disable the handle while a reorder write is pending.
10. Preserve focus on the handle after keyboard movement and after the canonical snapshot returns.
11. Use existing design tokens for dragging, drop eligibility, focus, and disabled states.

Do not make the entire row draggable. That would conflict with selection, text interaction, checkbox activation, and discoverable keyboard behavior.

**Verify**: click, double-click, keyboard activation, checkbox toggling, and task-detail selection behave as before when no drag is started.

### Step 6: Wire Today and Backlog to their existing scopes

In `src/routes/today.tsx`:

1. Create one `useReorderTasks` mutation.
2. Pass `todayScope` and a reorder callback only to To do.
3. Submit `{ scope: todayScope, taskIds }`.
4. Leave Done unorderable.
5. Show a concise `sonner` error toast on failure.

In `src/routes/backlog.tsx`:

1. Create one `useReorderTasks` mutation for the route.
2. Enable reordering for every group except `log:completed`.
3. Submit the group's existing scope with its complete visible active-task order.
4. Leave Completed unorderable.
5. Show the same failure treatment.

Use clear shared error copy such as `Could not save task order.` and include the native message only when it is safe and actionable, following existing toast patterns.

Do not change `scopeForTask`, `orderTasks`, `orderCompletedTasks`, or the native scope list as part of normal implementation.

**Verify**: inspect every `TaskGroup` call. Only active groups receive reorder props, and each callback submits the scope already used to derive that group's visible order.

### Step 7: Complete keyboard and screen-reader behavior

Configure dnd-kit's accessibility options using task titles rather than opaque IDs:

- Announce when a task is picked up.
- Announce its new one-based position while moving.
- Announce the final position when dropped.
- Announce cancellation without implying a write occurred.
- Provide concise keyboard instructions: focus the reorder handle, press Space or Enter to start, use arrow keys to move, press Space or Enter to drop, and Escape to cancel.

Keep announcements scope-local and include the item count where useful. Do not announce every renderer refresh.

Keyboard movement must use the same `onDragEnd` persistence path as pointer movement. Do not implement a second reorder algorithm or a hidden keyboard-only order.

**Verify**: keyboard focus remains visible throughout pickup, movement, drop, and cancellation; a screen reader hears task titles and positions rather than UUIDs.

### Step 8: Run automated gates and manual acceptance

Run:

```sh
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
git diff --check
```

Then run the desktop app and complete the manual matrix in both the compact popover and full window.

#### Pointer acceptance

- Drag the first Today task to the middle and last positions.
- Drag the last Today task to the first position.
- Reorder tasks independently in Needs estimate, Unscheduled, Overdue, and Upcoming.
- Attempt to drag outside the current list; confirm no cross-group move or write occurs.
- Confirm Done and Completed rows have no drag handle.
- Confirm the list auto-scrolls predictably when a group extends beyond the compact viewport.
- Confirm checkbox and task-detail interactions still work without accidental drags.
- Restart the app and confirm every successful order survives.

#### Keyboard and accessibility acceptance

- Tab to a handle and confirm its visible focus state and useful accessible name.
- Start a drag, move the task up and down, and drop it.
- Start another drag and press Escape; confirm the original order remains and no save occurs.
- Confirm focus returns to or remains on the moved handle.
- Confirm announcements contain the task title, position, list size, drop result, and cancellation result.
- Confirm keyboard movement cannot enter another task group.

#### State, error, and motion acceptance

- Reorder Today across the capacity boundary and confirm the overflow marker follows the new order immediately.
- Reorder the currently selected task and confirm the detail panel remains associated with the same task ID.
- Complete, restore, create, edit, and delete tasks after adding sortable wrappers; confirm existing Motion behavior remains calm and correct.
- Enable macOS Reduced Motion and confirm no decorative spatial animation is introduced beyond direct pointer tracking.
- Simulate or force one reorder failure if practical; confirm the previous order is restored, a toast appears, and a later retry can succeed.
- Confirm no double write occurs from a same-position drop or canceled drag.
- Confirm handles are disabled while a reorder write is pending.

## Done criteria

- [x] Implementation begins on `feat/task-list-drag-and-drop`.
- [x] Only the four selected dnd-kit packages are added.
- [x] Active Today tasks can be reordered by pointer and keyboard.
- [x] Every active Backlog group can be reordered independently by pointer and keyboard.
- [x] Done and Completed remain unorderable.
- [x] Dragging cannot schedule, unschedule, complete, restore, or cross task groups.
- [x] Reorder handles have visible focus, useful accessible names, instructions, and position announcements.
- [x] Checkbox and task-detail interactions do not initiate dragging.
- [x] Optimistic ordering updates immediately and rolls back on native failure.
- [x] Successful ordering persists through SQLite and survives app restart.
- [x] Today overflow state follows the reordered list.
- [x] dnd-kit transforms and Motion transforms are applied to separate DOM elements.
- [x] Existing create, edit, complete, restore, delete, selection, and animation behavior remains intact.
- [x] The compact popover remains usable at 360 × 520, including long-list scrolling.
- [x] `cargo test --manifest-path src-tauri/Cargo.toml` passes.
- [x] `npm run build` exits 0.
- [x] `git diff --check` produces no output.
- [x] No route tree, migration, native permission, AI, or unrelated product behavior changes are introduced.

## STOP conditions

Stop and report instead of improvising if:

- The intended base branch has uncommitted work that does not belong to this feature.
- The selected package versions fail React 19 installation or baseline type-checking.
- The established dnd-kit packages require a migration to `@dnd-kit/react` to function.
- dnd-kit and Motion cannot be separated onto distinct DOM transform owners without breaking task lifecycle animations.
- Keyboard sorting cannot retain a visible, predictable focus target.
- A valid active-group reorder requires changing a task's derived scope or scheduled date.
- The existing native reorder command no longer persists a complete scope order transactionally.
- The feature appears to require a SQLite migration, new native permission, generated route edit, cross-group semantic mutation, or new renderer test framework.
- Compact-popover acceptance cannot support both a usable drag handle and existing checkbox/edit controls without changing the task-row interaction model.

## Deferred work

- Cross-group and Today/Backlog movement with explicit capacity and scheduling previews.
- Move-up / move-down menu commands beyond dnd-kit's keyboard drag interaction.
- Multi-select dragging.
- Undo history and cross-window stale-write protection.
- External text, link, or file drag-in capture.
- Board-lane drag-and-drop and migration to the newer dnd-kit API after it reaches a stable release and the list feature is proven.

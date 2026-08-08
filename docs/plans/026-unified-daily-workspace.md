# Plan 026: Unified Daily workspace

## Status

**Status:** complete

**Priority:** P1 product workflow / renderer architecture

**Effort:** L

**Risk:** HIGH — route removal, derived task classification, capacity semantics, native persistence, and compact-popover UI change together

## Problem Statement

Slate currently presents Today and Backlog as separate routes. When a task is captured from Today without an estimate, the task is classified into Backlog and disappears from the current view. The user has no immediate spatial confirmation of where the task went and must navigate to another route to verify it.

The separate routes also duplicate task classification, ordering, capacity, empty-state, and selection logic. That duplication makes the current behavior difficult to evolve safely, especially now that Slate permits an explicitly committed but unsized Today task.

## Solution

Replace the separate Today and Backlog planner routes with one canonical Daily workspace at `/`. The workspace shows two semantic sections in one continuous surface:

- **Today** — visible and visually dominant; contains incomplete work scheduled for the current local day, including unsized commitments.
- **Backlog** — captured work not currently committed to Today; it appears as one flat, collapsible list and carries quiet row metadata such as Needs estimate, Overdue, Upcoming, or Unscheduled. Completed non-Today work remains quiet at the bottom of this list.

New captures from the Daily workspace save to the persisted Backlog by default. A user explicitly moves a task into Today through task-detail actions; movement preserves the task's estimate and changes only its scheduled date. An unsized task may be deliberately moved into Today, where it remains visibly marked Needs estimate and contributes no guessed minutes to capacity.

The workspace is rendered from one derived Daily workspace model built from the authoritative planner snapshot. Native persistence remains the authority for task mutations, revision checks, ordering, and SQLite durability. The first slice improves the unified sections and explicit movement path; cross-section drag-and-drop, a draggable inspector, and slash-command capture remain later work.

## User Stories

1. As a person capturing work, I want a new task typed in the Daily workspace to land in Backlog by default, so that capture does not silently become a commitment.
2. As a person capturing work, I want to see the new task appear in Backlog immediately after saving, so that the task never feels lost.
3. As a person planning the day, I want Today and Backlog visible in one continuous workspace, so that I do not need to translate between separate routes.
4. As a person planning the day, I want Today to remain visible and dominant in the compact popover, so that I can understand my active commitments at a glance.
5. As a person with many captured tasks, I want Backlog to collapse without affecting Today, so that the daily decision remains focused.
6. As a person reviewing history, I want completed Today work to remain at the bottom of Today without a separate Done section, so that completed work does not compete with active planning.
7. As a person choosing work, I want to explicitly commit an estimated Backlog task to Today, so that the task's time cost becomes part of my plan.
8. As a person choosing work whose duration is unknown, I want to explicitly commit an unsized Backlog task to Today, so that uncertainty does not prevent me from making a deliberate commitment.
9. As a person with an unsized Today task, I want the task to say Needs estimate, so that I know the commitment has no known duration yet.
10. As a person with an unsized Today task, I want capacity to show known remaining minutes and the presence of unsized work separately, so that the remaining-minute value does not falsely imply that the day is safe.
11. As a person returning work to Backlog, I want Return to Backlog to clear the Today date while preserving the task's estimate, so that releasing a commitment does not erase useful planning information.
12. As a person editing a task, I want to enter or change an estimate from the existing task-detail interaction, so that sizing work does not require leaving the Daily workspace.
13. As a person with overdue or future work, I want those date states shown as quiet Backlog metadata, so that I can understand why a task needs attention without navigating through multiple top-level sections.
14. As a person with an unsized overdue or future task, I want Needs estimate and the date state to appear together, so that one piece of metadata does not hide another important condition.
15. As a person completing work, I want completion to remain independent from whether the task has an estimate, so that I can mark an unsized commitment Done when the work is finished.
16. As a person using the compact popover, I want the normal capture, selection, editing, completion, and movement workflow to remain usable at the configured minimum size, so that the redesign does not require the full application window.
17. As a keyboard user, I want explicit movement actions to be focusable and operable without dragging, so that committing or releasing work is accessible and predictable.
18. As a keyboard user, I want section collapse, task selection, task editing, completion, and movement to retain visible focus, so that I can understand where the next action will occur.
19. As a person using reduced motion, I want task creation, movement, completion, and section changes to remain understandable without spatial animation, so that motion preferences do not remove important feedback.
20. As a person working across the popover and full application window, I want accepted task changes to refresh consistently through the existing planner-change boundary, so that both surfaces show the same local state.
21. As a person whose task changed in another window, I want stale edits or movements rejected without partial writes, so that my newer local data is not silently overwritten.
22. As a person restarting Slate, I want section placement, estimates, dates, completion state, and capacity-derived values restored from SQLite, so that the Daily workspace remains trustworthy.
23. As a maintainer, I want one Daily workspace derivation seam, so that task classification and capacity presentation are not duplicated across route components.
24. As a maintainer, I want obsolete Today and Backlog route logic removed after migration, so that future changes do not have to preserve dead screens.
25. As a maintainer, I want shared Shadescene components and existing dependency choices preserved, so that cleanup removes stale feature code without damaging the shared UI foundation.

## Implementation Decisions

### Surface and routing

- The canonical planner route is `/` and renders the Daily workspace.
- `/settings` remains a separate route and continues to render Settings.
- The old Today and Backlog route modules are removed entirely. They are not retained as redirect-only aliases and do not contain duplicate compatibility views.
- Generated route output is regenerated through the normal router workflow; it is not hand-edited.
- The menu-bar popover remains the primary surface. The full application window shares the Daily workspace behavior for this slice but does not become a separate Planning workspace or board.

### Domain model

- Today and Backlog remain semantic sections, not persistent task statuses. Completion is a row state, not a top-level section.
- Commitment state is derived from task facts: completion, scheduled date, and estimate.
- An incomplete task scheduled for the current local day belongs to Today even when its estimate is null.
- A noncompleted task with a date in the past or future remains in Backlog and exposes its date state as metadata. An unsized task may expose Needs estimate at the same time.
- A task without a scheduled date remains in Backlog. A newly captured task is unscheduled and unestimated by default.
- Unfinished tasks retain their original date after the day passes. Slate never silently reschedules them.
- Completed Today tasks remain at the bottom of Today. Completed non-Today tasks remain at the bottom of the flat Backlog list.
- No persistent `backlog`, `today`, `done`, or generic kanban status field is added.

### Renderer read model

- Add one pure Daily workspace selector at the highest useful renderer seam. It accepts the authoritative planner snapshot and returns Today, flat Backlog, row metadata, ordering, and capacity presentation data.
- React route and section components render that derived model rather than independently filtering tasks through repeated scope rules.
- The selector exposes composable metadata, including Needs estimate, Overdue, Upcoming, Unscheduled, and duration where applicable.
- Capacity presentation includes known committed minutes, known remaining minutes, over-capacity state for sized work, and an explicit unsized-commitment count.
- The selector does not persist state or replace native validation. Optimistic renderer state may be used only through the existing query mutation patterns and must reconcile with the native snapshot.
- Existing task selection, task motion, task row, task detail, and UI primitives should be reused where they remain compatible. Shared Shadescene components are not removed as part of cleanup.

### Capture and movement

- Daily capture always creates a manual Backlog task with no estimate and no scheduled date, regardless of where the composer is visually located.
- The first slice uses explicit task-detail actions rather than cross-section drag-and-drop.
- Commit to Today sets the current local date and preserves the existing estimate, including a null estimate.
- Return to Backlog clears the scheduled date and preserves the existing estimate.
- Native persistence validates and applies movement through the existing stale-safe task mutation boundary.
- Completion remains independent from estimate presence and continues through the existing task lifecycle boundary.
- Movement is not implemented as a renderer-only status change.

### Native persistence

- The existing native repository/Tauri command boundary remains the write authority.
- Native classification and ordering logic must agree with the renderer selector for unsized Today tasks.
- Moving an unsized task into Today must update its scheduled date, scope membership, order, revision, and planner-change notification atomically where the existing contract requires those changes.
- Stale expected revisions reject the entire mutation with no partial writes.
- SQLite remains the local source of truth. No new migration is required solely to represent Daily workspace sections.
- Existing Planner Event, Keychain, cross-window invalidation, and permission boundaries remain unchanged.

### Cleanup

- Remove obsolete Today and Backlog route logic, route-specific derivation, unused imports, obsolete tests, and outdated documentation made incorrect by the unified workspace.
- Remove dead feature-specific helpers only when no remaining caller or documented contract needs them.
- Do not remove shared Shadescene components merely because this slice does not use each one.
- Do not alter dependency versions or remove dependencies as part of this slice.
- Update generated route output through the normal generation process.
- Update product, roadmap, domain, ADR, and plan documentation so the accepted unsized-commitment and Daily workspace contracts do not remain contradicted elsewhere.

## Testing Decisions

Tests should verify externally observable planning behavior and persistence outcomes rather than the internal shape of React components. A good test should express what a user can see or what durable local state exists after an accepted action.

### Renderer seam

- Test the pure Daily workspace selector with representative task combinations:
  - estimated Today work
  - unsized Today commitments
  - unscheduled Backlog work
  - overdue and future work
  - completed work
  - mixed metadata such as overdue plus Needs estimate
  - ordering and empty sections
  - known capacity plus unsized commitment counts
- Preserve the repository's existing small Node test style for pure renderer/domain helpers. Do not introduce a new renderer test framework solely for this slice.
- Verify that section and metadata derivation has one authoritative renderer path rather than route-specific duplicate filters.

### Native persistence seam

- Extend the existing Rust repository/persistence tests at the native mutation boundary.
- Verify that a new Daily capture is persisted unscheduled and unestimated in Backlog.
- Verify that an estimated task can be committed to Today and later returned to Backlog without losing its estimate.
- Verify that an unestimated task can be committed to Today, appears in the Today scope, remains excluded from known-minute capacity, and is excluded from AI planning eligibility.
- Verify that an unsized Today task can be edited, completed, and returned to Backlog with the expected revisions and events.
- Verify that stale movement or edit attempts perform no partial writes.
- Verify that task placement and ordering survive snapshot reads and restart.

### Manual UI verification

- Verify the Daily workspace at the compact popover minimum size and in the full application window.
- Verify Today remains visible and dominant when Backlog contains many tasks.
- Verify Backlog collapse does not obscure capacity or the capture control, and completed Today tasks remain visible at the bottom of Today.
- Verify capture feedback, explicit movement feedback, selection, task detail editing, completion, focus states, reduced motion, light theme, dark theme, empty states, over-capacity state, and persistence failure recovery.
- Verify that no navigation control or stale route-specific UI remains for Today or Backlog.
- Verify that the Settings route remains reachable and behaves as before.
- Run the existing renderer build, native test suite, and diff hygiene checks at implementation gates.

### Prior art

- Reuse existing task lifecycle, ordering, stale-write, event, settings, onboarding, quick-capture, and persistence test patterns.
- Preserve the existing native repository tests as the primary durable-state regression suite.
- Extend existing pure helper tests rather than adding broad component snapshots or a new UI testing framework.

## Out of Scope

- Cross-section pointer drag-and-drop or a shared drag overlay.
- A draggable, resizable, or multi-snap-point task inspector.
- A right-side full-window inspector.
- Inline slash-command parsing, metadata chips, and command menus.
- A new persistent task status, kanban board, custom columns, projects, tags, subtasks, dependencies, or priorities.
- A full-window Planning workspace or board redesign.
- Generic Undo history for every movement. Existing quick-capture Undo remains unchanged; movement reversal may be designed separately.
- AI-generated unsized commitments. Plan My Day continues to consider only eligible estimated Backlog tasks, and accepted AI changes remain reviewable.
- Calendar grids, time-of-day scheduling, automatic rollover, notifications, scoring, streaks, analytics, sync, mobile, integrations, or external context capture.
- Removing shared Shadescene components.
- Dependency upgrades, dependency removal, or introducing a new renderer test framework.

## Further Notes

- This plan implements the first narrow promise of the redesign: a task should never disappear without showing where it went.
- The accepted domain decisions are recorded in the project glossary and ADRs: the Daily workspace is derived from the existing task model, and unsized commitments may be explicitly placed in Today.
- The exact visual treatment of section headers, metadata, collapse affordances, and task-detail presentation remains subject to compact-popover design validation, but it must preserve the semantic hierarchy and interaction contracts in this spec.
- Future drag-and-drop and full-window Planning workspace work must reuse the Daily workspace selector and native mutation semantics rather than introducing a parallel status model.
- This feature was delivered through Plans 027–030. Future work should preserve the Daily selector and native mutation boundaries rather than reopening the removed route model.

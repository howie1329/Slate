## Problem Statement

Slate currently separates Today and Backlog into different routes and screens. That breaks spatial continuity during ordinary planning. In particular, when a user captures an unestimated task from Today, the task is classified into Backlog and disappears from the current screen. The user must navigate elsewhere to understand where the task went.

The split also makes movement between commitment states feel like navigation rather than planning. Users cannot see a task travel from uncommitted work into Today, preview the capacity cost before committing it, or reverse the move locally without losing context.

The problem is most acute in Slate's compact macOS menu-bar popover, where the product must answer quickly:

- What is committed today?
- What work is still uncommitted?
- What happened to the task I just changed?
- What will this commitment cost?

## Solution

Replace the separate Today/Backlog workspace experience with one continuous, derived planning workspace containing three top-level sections:

- **Today** — active commitments and completed work from today, visually dominant.
- **Backlog** — captured but uncommitted work, with quiet metadata for estimate, date, overdue, and attention states.
- **Done** — completed history, collapsed or visually secondary by default.

The workspace preserves Slate's existing product model:

- Backlog contains uncommitted work.
- Today contains deliberate commitments.
- Tasks without estimates cannot enter Today.
- Capacity remains expressed in understandable minutes.
- Slate never silently rolls unfinished work forward.
- SQLite and the existing native planner boundary remain authoritative.
- AI remains reviewable and never commits changes autonomously.

The first release is a unified list workspace, not a generic kanban board. It should make state changes visible while preserving the compact popover as the fastest path for deciding what fits today.

## User Stories

1. As a person capturing work from Today, I want a new task to appear immediately in the section where it actually belongs, so that I do not wonder whether Slate lost it.

2. As a person capturing an unestimated task from Today, I want to see that it was captured into Backlog because it is not yet commit-ready, so that the product's rules are understandable.

3. As a returning Slate user, I want to see Today and Backlog in one workspace, so that I can shape my day without switching between routes.

4. As a daily planner, I want Today to remain the most visually prominent section, so that I can understand my commitments before browsing captured work.

5. As a compact-popover user, I want capacity and remaining minutes to remain visible while I scroll through the workspace, so that I can make planning decisions without losing the budget context.

6. As a user with a long Backlog, I want Backlog to be collapsible and visually quieter than Today, so that captured work does not overwhelm the daily decision.

7. As a user with completed work, I want Done to be collapsed by default and countable, so that history is available without competing with active planning.

8. As a user moving work into Today, I want to preview the capacity impact before committing the move, so that I can see the before-and-after cost of the decision.

9. As a user moving an estimated Backlog task into Today, I want the task to visibly transition into Today after the drop is accepted, so that the interface confirms the commitment.

10. As a user moving a task from Today back to Backlog, I want the task to visibly leave Today and appear in Backlog, so that returning work feels deliberate and reversible.

11. As a user trying to move an unestimated task into Today, I want Slate to focus me on adding an estimate before the move can commit, so that an incomplete task cannot silently become a commitment.

12. As a user who intentionally accepts an over-capacity plan, I want Slate to warn me without silently blocking the move, so that I retain control over my commitments.

13. As a user reordering Today tasks, I want to reorder them within Today without changing their dates or completion state, so that ordering remains a separate planning decision.

14. As a user reordering Backlog tasks, I want to reorder tasks within their existing derived Backlog groups, so that my capture order and attention remain meaningful.

15. As a user moving work across sections, I want the movement to be persisted through the same native command boundary as other task changes, so that the visible workspace and durable SQLite state cannot drift.

16. As a user who changes a task in another window while a move is pending, I want Slate to reject or reconcile stale movement safely, so that a stale gesture cannot overwrite newer task state.

17. As a user who moves a task by mistake, I want a brief local Undo action, so that I can recover without reopening the inspector or navigating to another screen.

18. As a keyboard user, I want an equivalent command or focused control for every drag action, so that planning does not depend on pointer dragging.

19. As a screen-reader user, I want task movement to announce the source section, destination section, position, and capacity result, so that I can understand the same state transition as a pointer user.

20. As a user who clicks a task row, I want clicking to select and open task details reliably, so that drag behavior does not interfere with ordinary editing.

21. As a user completing a task, I want the task to move to Done through the existing completion action, so that completion remains distinct from planning movement.

22. As a user restoring completed work, I want the task to return to the correct derived active section based on its estimate and date, so that restore behavior remains consistent with the product model.

23. As a user editing a selected task, I want the inspector to remain connected to the workspace, so that editing does not replace the list or lose my planning position.

24. As a compact-popover user, I want a bounded task inspector with compact and expanded states, so that I can edit task details without the inspector consuming the entire workspace.

25. As a full-window user, I want the same task detail and movement semantics to work with more room, so that the full application is an expanded planning surface rather than a separate product.

26. As a power user, I want to type a date or estimate command in the composer, so that common capture-and-plan actions require fewer clicks.

27. As a power user, I want recognized composer commands to appear as clear tokens or chips, so that I know Slate parsed them before saving.

28. As a user typing an unknown slash command, I want the text to remain literal, so that Slate never silently changes task content.

29. As a user entering conflicting or incomplete commands, I want an inline explanation and a predictable result, so that capture behavior is explicit rather than guess-based.

30. As a user entering `/today` without an estimate, I want Slate to explain that an estimate is required before commitment, so that the command cannot create an unpriced Today commitment.

31. As a user entering `/tomorrow`, I want the task to be dated for tomorrow but remain uncommitted, so that future scheduling does not accidentally consume today's capacity.

32. As a user entering `/backlog`, I want the task to remain unscheduled and uncommitted, so that the command has a clear destination meaning.

33. As a user completing a move, capture, restore, or delete action, I want the row to move first and related capacity or summary indicators to update immediately afterward, so that the object causing the change remains easy to follow.

34. As a user with reduced-motion enabled, I want state feedback without layout choreography, so that the workspace remains understandable and comfortable.

35. As a user with no tasks, I want the empty workspace to explain the capture-to-commit flow, so that the unified surface teaches itself.

36. As a user with no Backlog tasks but an open Today, I want the Backlog section to remain understandable without unnecessary empty-state noise, so that the workspace stays calm.

37. As a user with overdue or future-dated work, I want those states to remain visible as quiet metadata or attention cues inside Backlog, so that the unified workspace does not recreate a wall of equally prominent groups.

38. As a user with persistence failure, I want Slate to explain whether the move failed or became stale and leave the task in a recoverable state, so that the workspace never implies a change that was not saved.

39. As a user reopening Slate after a restart, I want section placement, ordering, dates, estimates, and completion state to match SQLite, so that the unified workspace is durable.

40. As a user switching between the popover and full window, I want both surfaces to reflect the same planner snapshot, so that I can move between contexts without contradictory task state.

## Implementation Decisions

- The unified workspace will be a derived view over the existing task model. It will derive Today, Backlog, and Done from completion, estimate, scheduled date, and the existing scope/order selectors.

- No persistent `section`, kanban-status, or generic `In Progress` field will be introduced for the first release. A new schema field is only justified if real use proves the current commitment model cannot express the need.

- The normal shell will stop presenting Today and Backlog as the primary segmented navigation choice. Existing route entry points should remain safe through redirects or compatibility handling while the workspace becomes the single planning surface. Generated route output must remain generated and must not be hand-edited.

- Today will be first and visually dominant. In the compact popover, the capacity summary remains sticky or persistently visible, Today remains open for the normal daily loop, Backlog can be collapsed, and Done is collapsed or visually secondary by default.

- Backlog will not reproduce all current groups as equally prominent top-level sections. Needs estimate, unscheduled, overdue, upcoming, and similar states will be represented through quiet row metadata, grouping only when needed for a concrete attention decision.

- Done will be a history section. Completed rows will not be draggable as planning items. Completion and restore continue through the existing lifecycle actions.

- Cross-section movement will reuse the existing native task mutation boundary:
  - Backlog to Today sets the current local Today date after estimate validation.
  - Today to Backlog removes the Today date and returns the task to uncommitted work.
  - A movement must include expected revision/state information and must be rejected without partial writes when stale.
  - The canonical planner snapshot remains the source of truth after the mutation.

- Dragging will preview destination and capacity but will not write persistence during the gesture. The write occurs only after an intentional drop or equivalent keyboard/menu action.

- A capacity preview will show the current Today budget, the task's added or removed minutes, and the resulting remaining or over-capacity value before committing a move. Preview state is renderer-local and transient.

- Moving an unestimated task toward Today will not commit it. The workspace will open or focus the task inspector's estimate control and explain the missing estimate. The user must supply a valid positive whole-minute estimate before the Today move can be accepted.

- User-initiated over-capacity movement is allowed after clear warning. Slate will not silently move, delete, or reschedule other commitments to make room.

- The first unified-workspace slice will use a revealed drag affordance rather than making the entire row draggable. A subtle handle may appear on row hover and handle focus; the entire row remains reserved for selection, checkbox behavior, and text interaction. Keyboard and explicit inspector actions remain available.

- Drag-and-drop should be implemented with one workspace-level drag context capable of recognizing section destinations, rather than independent contexts that make cross-section movement impossible. Existing scoped ordering remains explicit when the destination is an orderable group.

- Every cross-section movement will expose a brief local Undo action. Undo will use a revision-safe inverse mutation and will do nothing if the task changed after the original move.

- The current task detail interaction will evolve into a compact/expanded inspector. Freeform draggable snap points and a full-window right-side inspector are deferred until the compact behavior proves that more interaction space is needed.

- The composer parser will be a small pure domain helper. It will recognize `/today`, `/tomorrow`, `/backlog`, and positive whole-minute `/<number>m` commands. It will remove only recognized commands from the saved title, preserve unknown slash text, and return explicit parse metadata for validation and chip rendering.

- Composer command semantics are deterministic:
  - `/today` requests a Today commitment and requires a positive estimate.
  - `/tomorrow` schedules tomorrow without committing to Today.
  - `/backlog` removes scheduling and keeps the task uncommitted.
  - `/<number>m` supplies the estimate.
  - Conflicting recognized commands are shown as an inline validation error rather than resolved by hidden precedence.

- Motion will prioritize object continuity. The task row should appear to move between sections when the destination is visible; if the destination is offscreen, the workspace should provide local confirmation and reveal the resulting section rather than animating a misleading long-distance transition. Capacity and summary values update after the row settles. Reduced Motion removes choreography but retains section placement and status feedback.

- Selection, task detail state, query invalidation, cross-window refresh, and AI review dismissal must remain coordinated through the existing providers and planner query boundary.

- AI Assist and Plan My Day remain reviewable. The unified workspace must not allow AI results to move tasks or commit Today changes without explicit acceptance.

- Native permissions, Keychain handling, API-key boundaries, and sidecar behavior are unchanged.

- The full-window surface may later expose a board/list toggle, toolbar, horizon views, batch actions, and a right-side inspector under the existing Stage 3 workspace direction. Those are not prerequisites for this unified list slice.

## Testing Decisions

- The highest test seam is the workspace state transition: start from a planner snapshot, derive section membership and order, perform one user-visible move or capture action, cross the existing native mutation boundary, and assert the refreshed snapshot and visible section outcome. Tests should validate external behavior and durable state, not React component structure or implementation-specific event plumbing.

- Domain selectors for section membership, section counts, quiet metadata, destination validation, and capacity preview should have focused deterministic tests. These are pure helpers and should be tested with empty, typical, over-capacity, overdue, future, completed, and unestimated task sets.

- The composer parser should have focused deterministic tests for recognized commands, unknown slash text, duplicate commands, conflicting commands, malformed estimates, title cleanup, whitespace, and command-only input.

- Native persistence tests should cover cross-section movement, expected-revision rejection, over-capacity acceptance/warning data, atomicity, order placement at the destination, restore behavior, and no partial write on stale or invalid proposals.

- Mutation and Undo behavior should be tested at the planner boundary: a successful move updates the canonical snapshot, a failed move rolls back any optimistic state, and Undo reverses only an unchanged task.

- Accessibility behavior should be validated externally through keyboard interaction, visible focus, semantic section labels, drag announcements, non-drag alternatives, and reduced-motion behavior. Do not test dnd-kit internals.

- Desktop manual acceptance must cover the configured minimum popover size and full window, light and dark themes, empty sections, long Backlog content, long task titles, unestimated drops, over-capacity drops, failed persistence, stale mutation, keyboard movement, pointer movement, Undo, capture commands, completion/restore, and cross-window refresh.

- Existing test prior art is the repository's Node built-in test files for pure helpers and inline Rust persistence tests. Do not introduce a new renderer test framework solely for this redesign. The normal automated gates remain the existing build and native test commands.

## Out of Scope

- A generic kanban board or permanent custom lanes.
- A new persistent section/status field.
- `To Do / In Progress / Done` workflow semantics.
- Projects, nested projects, tags, subtasks, dependencies, assignees, WIP limits, or arbitrary task metadata.
- Calendar grids, time blocking, start/end times, timers, or automatic rollover.
- Silent rescheduling of unfinished work.
- Autonomous AI movement, background agents, chat history, or unreviewed commitment changes.
- Multi-select and batch planning actions in the initial unified-list slice.
- Full-window board/list parity, toolbar, search, horizon views, Needs Attention rail, Focus mode, and history inspection.
- Freeform draggable multi-snap inspector behavior in the initial slice.
- Whole-row drag activation in the initial slice.
- External integrations, sync, mobile, collaboration, or accounts.
- New Tauri permissions or unrelated native shell changes.
- Replacing SQLite as the local source of truth.
- Hand-editing generated router output.
- Recreating every current Backlog subgroup as a top-level section.

## Further Notes

- This spec is Priority 2 for the redesign direction and belongs after the Stage 2 capture and durable-planning foundations are trustworthy. It is the first concrete slice of the broader Stage 3 workspace direction.

- The implementation should proceed in vertical slices:
  1. Unified workspace shell and derived sections with visible capture placement.
  2. Explicit cross-section movement with capacity preview and native validation.
  3. Reordering, keyboard alternatives, local Undo, and failure recovery.
  4. Compact/expanded inspector refinement.
  5. Inline composer commands and chip feedback.
  6. Motion and reduced-motion polish.

- Each slice must preserve the normal daily loop in the compact popover. The full window may provide more room, but it must not become required for ordinary capture, commitment, completion, or return-to-Backlog actions.

- The implementation branch is `codex/unified-workspace-redesign`.

- The final acceptance question is simple: can a user understand what fits today and where a changed task went without navigating away from the planning surface?

- The chosen test seam is intentionally narrow: one authoritative workspace transition through the existing planner boundary. If implementation pressure suggests adding a second independent state model, stop and revisit this spec instead of broadening the architecture.

# 02 — Workspace task inspector

**What to build:** Keep task editing attached to the unified workspace through a bounded inspector. Selecting a task from any section opens compact task details without replacing the list; the user can expand the inspector when needed, edit title, estimate, and date, and use explicit task actions. The inspector must provide the estimate-entry path needed when an unestimated task is being considered for Today.

**Blocked by:** 01 — Unified workspace foundation

**Status:** complete

- [x] Selecting a task in Today, Backlog, or Done opens the inspector without navigating away or losing workspace position.
- [x] The inspector supports compact and expanded states through explicit controls and keyboard-operable actions.
- [x] The compact state remains bounded and usable at the configured minimum popover size.
- [x] Users can edit title, positive whole-minute estimate, scheduled date, completion, and return-to-Backlog behavior through the existing task mutation boundary.
- [x] The inspector clearly identifies when an unestimated task cannot enter Today and focuses the estimate control when requested by a move.
- [x] Dirty edits, stale revisions, persistence errors, Escape, outside dismissal, and successful save behavior remain understandable and recoverable.
- [x] The same task-detail semantics work in the compact popover and full window without adding rich notes, projects, or a second task model.
- [x] Existing checkbox and row-selection behavior remains distinct from inspector actions.

## Comments

- The task-selection API can request estimate focus without creating a second task state. Ticket 03 will use it when an unestimated task is moved toward Today.
- Validated with `npm run build`.

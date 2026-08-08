# 029 — Add explicit Daily workspace movement actions

**Parent:** Plan 026 — Unified Daily workspace

**What to build:** Give users clear, keyboard-accessible task-detail actions for committing work to Today and returning it to Backlog. The actions must use the existing native revision-safe mutation boundary and work for both sized and unsized tasks without introducing drag-and-drop or a new task status.

**Blocked by:**

- 027 — Build the canonical Daily workspace UI
- 028 — Make unsized Today commitments first-class

**Status:** complete

- [x] A selected Backlog task exposes an explicit Commit to Today action.
- [x] Commit to Today sets the current local date while preserving the task's estimate, including a null estimate.
- [x] A selected Today task exposes an explicit Return to Backlog action.
- [x] Return to Backlog clears the scheduled date while preserving the task's estimate and title.
- [x] Both actions work from the compact popover and full application window.
- [x] Both actions are keyboard-operable with visible focus and clear accessible names.
- [x] Accepted movement updates the Daily workspace, capacity, metadata, ordering, and selection without requiring route navigation.
- [x] Stale movement failures make no partial writes, refresh the planner state, and provide actionable local feedback.
- [x] The first slice does not add cross-section pointer dragging, drag overlays, or generic movement Undo history.
- [x] Renderer and native tests cover sized and unsized movement, preservation of task data, stale rejection, and refresh behavior.

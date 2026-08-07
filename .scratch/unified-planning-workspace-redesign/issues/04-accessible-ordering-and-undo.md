# 04 — Accessible ordering and Undo

**What to build:** Make active task ordering and recent commitment movement reversible and usable without relying on pointer dragging. Users can reorder active Today and Backlog tasks with a quiet revealed drag affordance or keyboard controls, while cross-section moves expose a short-lived revision-safe Undo action. Row selection, checkbox completion, and task editing must remain unaffected.

**Blocked by:** 03 — Capacity-aware cross-section movement

**Status:** ready-for-agent

- [ ] Active Today tasks and active Backlog groups can be reordered without changing dates, estimates, completion state, or semantic section membership.
- [ ] Completed Today and Done history rows are not presented as reorderable planning items.
- [ ] The drag affordance is revealed on row hover or handle focus and the entire row remains available for selection and text interaction.
- [ ] Keyboard users can start, move, drop, and cancel ordering through the same persistence path as pointer users.
- [ ] Screen-reader announcements identify task title, section, position, destination, completion, and cancellation without exposing opaque IDs.
- [ ] A successful cross-section move exposes a local Undo action that reverses only an unchanged task.
- [ ] Undo rejects or becomes unavailable when the task has changed after the original move.
- [ ] Reorder and Undo failures restore or retain the authoritative state and provide concise local feedback.
- [ ] Pointer, keyboard, checkbox, double-click, Escape, and task-detail selection interactions remain distinct.


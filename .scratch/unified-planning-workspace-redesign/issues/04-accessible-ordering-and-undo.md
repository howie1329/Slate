# 04 — Accessible ordering and Undo

**What to build:** Make active task ordering and recent commitment movement reversible and usable without relying on pointer dragging. Users can reorder active Today and Backlog tasks with a quiet revealed drag affordance or keyboard controls, while cross-section moves expose a short-lived revision-safe Undo action. Row selection, checkbox completion, and task editing must remain unaffected.

**Blocked by:** 03 — Capacity-aware cross-section movement

**Status:** complete

- [x] Active Today tasks and active Backlog groups can be reordered without changing dates, estimates, completion state, or semantic section membership.
- [x] Completed Today and Done history rows are not presented as reorderable planning items.
- [x] The drag affordance is revealed on row hover or handle focus and the entire row remains available for selection and text interaction.
- [x] Keyboard users can start, move, drop, and cancel ordering through the same persistence path as pointer users.
- [x] Screen-reader announcements identify task title, section, position, destination, completion, and cancellation without exposing opaque IDs.
- [x] A successful cross-section move exposes a local Undo action that reverses only an unchanged task.
- [x] Undo rejects or becomes unavailable when the task has changed after the original move.
- [x] Reorder and Undo failures restore or retain the authoritative state and provide concise local feedback.
- [x] Pointer, keyboard, checkbox, double-click, Escape, and task-detail selection interactions remain distinct.

## Comments

- Today and each derived Backlog group reorder through their existing native ordering scope. Cross-group drops are rejected without changing task membership or durable task fields.
- A successful move now returns its post-write revision. The shared workspace feedback uses that revision for an eight-second inverse `move_task` Undo, including moves that begin from the inspector.
- The local feedback region provides screen-reader completion/error announcements; custom drag announcements describe the source, destination, scoped position, and cancellation.
- Validated with `npm run build` and `cargo test` (52 passed; 1 Keychain integration test intentionally ignored).

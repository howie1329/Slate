# 06 — Continuity and reduced-motion polish

**What to build:** Integrate the unified workspace's state feedback so capture, movement, completion, restore, and Undo feel spatially continuous without making the interface theatrical. The changed row should settle before related capacity and summary indicators update; offscreen destinations should receive clear local confirmation; reduced motion should preserve feedback without choreography.

**Blocked by:** 04 — Accessible ordering and Undo; 05 — Inline command capture

**Status:** ready-for-agent

- [ ] Captured, moved, completed, restored, and undone rows visibly settle into their derived destination when that destination is visible.
- [ ] Capacity values and progress indicators update after the row transition rather than competing with it.
- [ ] Offscreen destinations provide local confirmation and reveal enough context to explain where the task landed.
- [ ] Routine success feedback is local to the changed section or row; global toasts remain reserved for failure or recovery.
- [ ] Related animations do not choreograph unrelated sections simultaneously.
- [ ] Reduced-motion preferences remove entrance, exit, and layout choreography while retaining placement, status, and error feedback.
- [ ] Long titles, long Backlog content, empty sections, over-capacity state, failed persistence, and stale movement remain visually legible.
- [ ] The final behavior is usable in the minimum popover, full window, light theme, and dark theme.
- [ ] Automated build, native persistence tests, and diff hygiene pass, and the end-to-end manual acceptance matrix covers the complete unified planning loop.


# 06 — Continuity and reduced-motion polish

**What to build:** Integrate the unified workspace's state feedback so capture, movement, completion, restore, and Undo feel spatially continuous without making the interface theatrical. The changed row should settle before related capacity and summary indicators update; offscreen destinations should receive clear local confirmation; reduced motion should preserve feedback without choreography.

**Blocked by:** 04 — Accessible ordering and Undo; 05 — Inline command capture

**Status:** implementation-complete; desktop visual acceptance pending

- [x] Captured, moved, completed, restored, and undone rows visibly settle into their derived destination when that destination is visible.
- [x] Capacity values and progress indicators update after the row transition rather than competing with it.
- [x] Offscreen destinations provide local confirmation and reveal enough context to explain where the task landed.
- [x] Routine success feedback is local to the changed section or row; global toasts remain reserved for failure or recovery.
- [x] Related animations do not choreograph unrelated sections simultaneously.
- [x] Reduced-motion preferences remove entrance, exit, and layout choreography while retaining placement, status, and error feedback.
- [x] Long titles, long Backlog content, empty sections, over-capacity state, failed persistence, and stale movement remain visually legible.
- [ ] The final behavior is usable in the minimum popover, full window, light theme, and dark theme.
- [ ] The end-to-end manual acceptance matrix covers the complete unified planning loop.

## Comments

- Task motion now affects only the source and destination sections. Header capacity and progress retain the prior snapshot until that local movement settles; `NumberFlow` and the progress rail then update together.
- Success and Undo messages render beneath the affected Today, Backlog, or Done heading. Offscreen destination sections are revealed instantly rather than simulating a long-distance row animation.
- Reduced Motion removes row entrance, exit, and layout movement while retaining section placement and inline status/error text. The app-wide Motion configuration already honors the user preference for other transient surfaces.
- Automated validation passed: `npm run build`, `node --test src/lib/*.test.mjs` (20 passing), `cargo test` (52 passing; 1 Keychain integration test intentionally ignored), and `git diff --check`.
- Desktop visual acceptance is pending. `npm run dev:desktop` could not launch a second instance because port 1420 is already in use; the existing user-owned server was left untouched.

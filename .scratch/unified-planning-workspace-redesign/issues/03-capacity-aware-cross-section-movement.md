# 03 — Capacity-aware cross-section movement

**What to build:** Let users deliberately move estimated work between Backlog and Today while seeing the commitment cost before the write. A Backlog-to-Today move sets the current local Today date; a Today-to-Backlog move removes that date. Pointer movement and explicit task actions must use the same native-authoritative, stale-safe mutation path.

**Blocked by:** 01 — Unified workspace foundation; 02 — Workspace task inspector

**Status:** complete

- [x] An estimated Backlog task can be moved into Today through a pointer drop or explicit task action.
- [x] A Today task can be returned to Backlog without silently rescheduling it to another day.
- [x] The movement preview shows the task's added or removed minutes and the resulting remaining or over-capacity value before commitment.
- [x] Preview state is transient; SQLite is not written until the user completes the move.
- [x] An unestimated task cannot be committed to Today; the move leaves durable state unchanged and routes the user to estimate entry.
- [x] Over-capacity movement presents a clear warning and allows an intentional user-confirmed overage without moving or deleting other commitments.
- [x] Native validation includes expected task state or revision and applies the movement atomically with no partial writes.
- [x] The refreshed planner snapshot places the row in its destination and updates capacity, ordering, and cross-window state consistently.
- [x] Invalid, stale, and persistence-failure outcomes leave the task recoverable and explain whether the move was rejected or failed.

## Comments

- Drag-and-drop and inspector actions use the same `move_task` command, which validates the current revision, rejects unestimated Today moves, updates ordering, and records the event in one SQLite transaction.
- The capacity preview is local UI state. Over-capacity moves require a second explicit confirmation and do not alter any existing commitment.
- Validated with `npm run build` and `cargo test` (51 passed; 1 Keychain integration test intentionally ignored).

# 03 — Capacity-aware cross-section movement

**What to build:** Let users deliberately move estimated work between Backlog and Today while seeing the commitment cost before the write. A Backlog-to-Today move sets the current local Today date; a Today-to-Backlog move removes that date. Pointer movement and explicit task actions must use the same native-authoritative, stale-safe mutation path.

**Blocked by:** 01 — Unified workspace foundation; 02 — Workspace task inspector

**Status:** ready-for-agent

- [ ] An estimated Backlog task can be moved into Today through a pointer drop or explicit task action.
- [ ] A Today task can be returned to Backlog without silently rescheduling it to another day.
- [ ] The movement preview shows the task's added or removed minutes and the resulting remaining or over-capacity value before commitment.
- [ ] Preview state is transient; SQLite is not written until the user completes the move.
- [ ] An unestimated task cannot be committed to Today; the move leaves durable state unchanged and routes the user to estimate entry.
- [ ] Over-capacity movement presents a clear warning and allows an intentional user-confirmed overage without moving or deleting other commitments.
- [ ] Native validation includes expected task state or revision and applies the movement atomically with no partial writes.
- [ ] The refreshed planner snapshot places the row in its destination and updates capacity, ordering, and cross-window state consistently.
- [ ] Invalid, stale, and persistence-failure outcomes leave the task recoverable and explain whether the move was rejected or failed.


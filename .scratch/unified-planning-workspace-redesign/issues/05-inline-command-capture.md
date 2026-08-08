# 05 — Inline command capture

**What to build:** Extend the composer with deterministic inline commands for common capture-and-plan actions. Recognized commands become visible feedback and are removed from the saved title; unknown slash text remains literal. Commands must create or update tasks through the existing planner boundary and visibly place them in the correct unified-workspace section.

**Blocked by:** 02 — Workspace task inspector; 03 — Capacity-aware cross-section movement

**Status:** complete

- [x] The composer recognizes /today, /tomorrow, /backlog, and positive whole-minute /<number>m commands.
- [x] Recognized commands are represented as quiet, visible tokens or chips while composing.
- [x] Recognized command text is removed from the saved title while unknown slash commands remain literal.
- [x] /today requires a positive estimate and gives the user a clear estimate-entry path when one is missing.
- [x] /tomorrow schedules the task for tomorrow without consuming Today capacity.
- [x] /backlog leaves the task unscheduled and uncommitted.
- [x] Conflicting, duplicate, malformed, and command-only input produces deterministic inline validation without silently choosing precedence.
- [x] Successful capture uses the existing native creation/mutation boundary and the row appears in its derived section.
- [x] Parser behavior is covered for whitespace, title cleanup, unknown commands, invalid estimates, and recognized-command combinations.

## Comments

- The pure parser exposes a cleaned title, schedule intent, estimate, visible command chips, and one deterministic validation message. Commands are whitespace-delimited and case-sensitive; unknown slash text stays literal.
- The footer maps valid commands to the existing `create_task` mutation: `/today` uses the snapshot's local Today date, `/tomorrow` advances that date by one local day, and `/backlog` clears any inherited date.
- Validated with `node --test src/lib/*.test.mjs` (20 passing), `npm run build`, and `git diff --check`.

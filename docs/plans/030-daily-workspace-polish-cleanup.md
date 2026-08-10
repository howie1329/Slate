# 030 — Polish the compact Daily workspace and finish cleanup

**Parent:** Plan 026 — Unified Daily workspace

**What to build:** Harden the completed Daily workspace for real compact-popover use. Add local feedback and restrained motion for capture, movement, completion, and section changes; verify all important states and accessibility behaviors; and remove stale feature code and documentation left behind by the route migration.

**Blocked by:** 029 — Add explicit Daily workspace movement actions

**Status:** complete

- [x] Task creation, movement, completion, and section changes provide local feedback without unrelated global toast choreography.
- [x] Today remains understandable and dominant when Backlog is large or expanded.
- [x] Backlog collapse behavior, inline completed history, empty states, over-capacity state, and unsized-commitment messaging are clear; there is no separate Done section.
- [x] Keyboard focus, screen-reader labels, reduced-motion behavior, light theme, dark theme, and minimum popover geometry are verified.
- [x] Persistence failure and stale-state recovery remain understandable and recoverable.
- [x] The full application window shares the same Daily workspace behavior without becoming a separate board or status system.
- [x] Obsolete route logic, unused imports, dead feature helpers, obsolete tests, and contradicted documentation are removed.
- [x] Shared Shadescene components remain available and dependency versions are unchanged.
- [x] Product, roadmap, domain, ADR, and plan documentation agree with the shipped behavior.
- [x] Native tests, renderer build, compact-popover geometry checks, and diff hygiene checks pass.

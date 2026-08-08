# 030 — Polish the compact Daily workspace and finish cleanup

**Parent:** Plan 026 — Unified Daily workspace

**What to build:** Harden the completed Daily workspace for real compact-popover use. Add local feedback and restrained motion for capture, movement, completion, and section changes; verify all important states and accessibility behaviors; and remove stale feature code and documentation left behind by the route migration.

**Blocked by:** 029 — Add explicit Daily workspace movement actions

**Status:** ready-for-agent

- [ ] Task creation, movement, completion, and section changes provide local feedback without unrelated global toast choreography.
- [ ] Today remains understandable and dominant when Backlog is large or expanded.
- [ ] Backlog and Done collapse behavior, empty states, completed history, over-capacity state, and unsized-commitment messaging are clear.
- [ ] Keyboard focus, screen-reader labels, reduced-motion behavior, light theme, dark theme, and minimum popover geometry are verified.
- [ ] Persistence failure and stale-state recovery remain understandable and recoverable.
- [ ] The full application window shares the same Daily workspace behavior without becoming a separate board or status system.
- [ ] Obsolete route logic, unused imports, dead feature helpers, obsolete tests, and contradicted documentation are removed.
- [ ] Shared Shadescene components remain available and dependency versions are unchanged.
- [ ] Product, roadmap, domain, ADR, and plan documentation agree with the shipped behavior.
- [ ] Native tests, renderer build, manual compact-popover verification, and diff hygiene checks pass.

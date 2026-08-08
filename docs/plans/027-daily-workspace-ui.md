# 027 — Build the canonical Daily workspace UI

**Parent:** Plan 026 — Unified Daily workspace

**What to build:** Replace the separate planner route UI with the real canonical Daily workspace at `/`, using the existing planner snapshot and a single renderer read model. The workspace should show Today, Backlog, and Done in one continuous surface, keep Today dominant, let Backlog and Done collapse, and keep the normal task workflow usable in the popover and full application window.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `/` renders the Daily workspace and `/settings` continues to render Settings.
- [ ] Today, Backlog, and Done are derived from one renderer selector rather than separate route-specific filters.
- [ ] Today is visible and visually dominant; Backlog can collapse; Done starts collapsed and remains quiet.
- [ ] The selector supports composable row metadata such as Needs estimate, Overdue, Upcoming, Unscheduled, and duration, including a fixture for an unsized task scheduled today.
- [ ] New capture from the Daily workspace persists as an unestimated, unscheduled Backlog task regardless of the workspace's visual context.
- [ ] Existing task selection, editing, completion, AI review, Settings access, and cross-window refresh continue to work.
- [ ] Old Today and Backlog navigation and route-specific screens are removed; no redirect aliases or duplicate compatibility views remain.
- [ ] Shared Shadescene components and dependency versions are preserved.
- [ ] Focused pure-selector tests cover Today, Backlog, Done, empty sections, ordering, and representative metadata.
- [ ] The renderer build and diff hygiene checks pass.

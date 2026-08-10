# 027 — Build the canonical Daily workspace UI

**Parent:** Plan 026 — Unified Daily workspace

**What to build:** Replace the separate planner route UI with the real canonical Daily workspace at `/`, using the existing planner snapshot and a single renderer read model. The workspace should show Today and Backlog in one continuous surface, keep Today dominant, render Backlog as one flat list with row metadata instead of category subsections, keep completed Today tasks at the bottom of Today, and keep the normal task workflow usable in the popover and full application window.

**Blocked by:** None — can start immediately.

**Status:** complete

- [x] `/` renders the Daily workspace and `/settings` continues to render Settings.
- [x] Today and Backlog are derived from one renderer selector rather than separate route-specific filters.
- [x] A slim top command row handles search/capture while a thin Settings utility strip remains at the bottom.
- [x] Today is visible and visually dominant; completed Today tasks remain at the bottom of Today.
- [x] Backlog appears beneath Today by default as one flat list with row metadata and can collapse locally.
- [x] The selector supports composable row metadata such as Needs estimate, Overdue, Upcoming, Unscheduled, and duration, including a fixture for an unsized task scheduled today.
- [x] New capture from the Daily workspace persists as an unestimated, unscheduled Backlog task regardless of the workspace's visual context.
- [x] Existing task selection, editing, completion, AI review, Settings access, and cross-window refresh continue to work.
- [x] Old Today and Backlog navigation and route-specific screens are removed; no redirect aliases or duplicate compatibility views remain.
- [x] Shared Shadescene components and dependency versions are preserved.
- [x] Focused pure-selector tests cover Today, flat Backlog, completed-at-bottom behavior, empty sections, ordering, and representative metadata.
- [x] The renderer build and diff hygiene checks pass.

---
status: accepted
---

# Keep the Daily workspace derived from the existing task model

The first redesign slice targets the compact popover's Daily workspace, not the future full-window Planning workspace, and derives Today, Backlog, and Done from the existing task facts rather than adding a persistent status field. The workspace is the canonical `/` route; the old `/today` and `/backlog` route modules are removed, while `/settings` remains a separate route. This preserves Slate's commitment semantics and keeps the popover's daily loop understandable; explicit movement can be added without creating a second state system, while richer full-window planning remains a later surface.

## Considered Options

- Add a permanent `backlog` / `today` status field and treat the new sections as board columns.
- Redesign the full-window Planning workspace first and make the popover a projection of it.
- Keep `/today` and `/backlog` as redirect-only compatibility routes.

## Consequences

- Section selectors and movement actions must continue to respect estimate, date, and completion rules.
- Renderer code should derive the Daily workspace from the authoritative planner snapshot and remove obsolete route-specific UI as the slice lands.
- Daily capture should save to the persisted Backlog by default; moving work into Today is an explicit action.
- The root route owns the Daily workspace; obsolete Today and Backlog route files are not retained as aliases.
- Future drag-and-drop and full-window planning must reuse these semantics rather than inventing a parallel status model.

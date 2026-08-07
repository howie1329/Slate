# 01 — Unified workspace foundation

**What to build:** Replace the separate Today and Backlog planning experience with one continuous workspace that derives Today, Backlog, and Done from the existing planner state. Today stays visually dominant with persistent capacity context, Backlog is quieter and collapsible, and Done is collapsed or secondary. A newly captured task must visibly appear in the section where Slate classifies it, including an unestimated task captured from Today.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The normal planner surface presents Today, Backlog, and Done as one continuous workspace without introducing a persistent section or kanban-status field.
- [ ] Today remains open and visually dominant in the compact popover, with capacity and remaining minutes available while the workspace scrolls.
- [ ] Backlog exposes useful estimate, date, overdue, and attention metadata without recreating every existing subgroup as an equally prominent top-level section.
- [ ] Done is collapsed or visually secondary by default and remains a history surface rather than a planning destination.
- [ ] Capturing a task from the workspace visibly places it in its derived section; an unestimated task is visibly shown in Backlog rather than disappearing.
- [ ] Empty, populated, long-content, and completed states remain understandable in the minimum popover and full window.
- [ ] Existing Today and Backlog route entry points safely resolve to the unified workspace without hand-editing generated router output.
- [ ] Section labels, focus order, and empty states remain accessible and use the existing Slate design tokens.


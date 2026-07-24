# Elevated improvements

> **Status:** Research-informed product direction
>
> **Updated:** 2026-07-24

This document builds on the [full-window planning workspace](full-window-planning-workspace.md) and identifies improvements that could make it feel like a distinctive Slate experience rather than a generic kanban board.

## Central recommendation

The board should be a decision engine, not just a visual task layout.

Kanban’s useful ideas are visualizing work, limiting work in progress, making policies explicit, managing flow, and creating feedback loops. Slate already has a better native constraint than an arbitrary card count: a daily budget expressed in understandable minutes. The workspace should use that capacity model to help a user pull realistic work into Today.

## 1. Make Today a pull system

Treat the initial lanes as a flow:

- **Capture:** Work that is new, vague, or unsized.
- **Ready:** Estimated, uncommitted work available for consideration.
- **Today:** Committed work in progress, bounded by daily capacity.
- **Done:** Completed history.

When a user selects or drags Ready work toward Today, show a planning preview before the write:

```text
Today       240 / 360 min
Selected     +75 min
After move  315 / 360 min
```

This gives the board a Slate-specific purpose: it makes the cost of pulling work into the day visible. It should warn about over-capacity without silently blocking a deliberate user decision.

## 2. Add a lightweight planning horizon

Place a restrained horizon switcher above the board:

```text
Today · Next 7 Days · Later · Review
```

This gives future work a clear home without turning the workspace into a calendar grid. Future-dated tasks can be reviewed by horizon, while overdue work remains an explicit recovery state rather than a normal rollover lane.

The value of this pattern is supported by Things’ separation of Today, Upcoming, Anytime, Someday, Inbox, and Logbook. Its Upcoming view also gives users a short future horizon to avoid concentrating too much work on one day. ([Things date-based lists](https://culturedcode.com/things/support/articles/4001304/))

## 3. Give Board and List equal status

The board should be for shaping and moving work. A list should be for scanning, sorting, and keyboard-heavy operation.

Both views should share:

- Selection state.
- Ordering.
- Filters.
- Task detail behavior.
- Batch actions.
- Capacity context.

The user should be able to switch views without feeling that they entered a different product. Linear is a useful reference: its board and list layouts share most functionality, support multi-selection and keyboard actions, and expose display options without duplicating the underlying work model. ([Linear board layout](https://linear.app/docs/board-layout))

## 4. Add a Spacebar peek inspector

Selecting a card and pressing Space should reveal a task preview without taking the user away from the board:

- Title and estimate.
- Current lane and date.
- Capacity impact.
- Why the task is currently surfaced.
- Quick edit, complete, return, and move actions.

Arrow keys should move through neighboring tasks while keeping the preview open. This preserves spatial context and makes the full window feel fast without requiring a modal for every edit. Linear’s Spacebar peek pattern is a strong reference for this interaction. ([Linear peek](https://linear.app/docs/peek))

## 5. Add a calm Needs attention rail

The full window should show decisions that need action, not a performance dashboard:

- Tasks needing estimates.
- Overdue commitments.
- Current over-capacity amount.
- Repeatedly deferred work.
- Pending AI proposals.
- Work that has been captured but is still unclear.

Each item should link directly to the relevant board selection or review action. The rail should disappear or collapse when there is nothing meaningful to resolve.

## 6. Make movement reversible and accessible

Drag-and-drop should feel safe, not magical. Provide:

- Clear lane highlighting while dragging.
- Capacity feedback before dropping into Today.
- Multi-select dragging.
- `⌘Z` undo after a move.
- Equivalent keyboard and menu actions.
- Visible failure feedback when a drop cannot be applied.

Apple’s macOS guidance recommends alternatives to drag-and-drop, multi-item dragging, clear destination feedback, and undoable operations. ([Apple drag and drop guidance](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop?changes=_3))

## 7. Add batch planning actions

Selecting several Ready tasks should expose a small action set:

- Fit into Today.
- Schedule for a future day.
- Estimate together.
- Return to Capture.
- Complete or release.

Actions that change commitments should show a preview before applying. For example, **Fit into Today** can select the best-fitting subset, show the total minutes, and let the user accept or adjust the proposal.

## 8. Add a temporary Focus mode without “In Progress”

Slate can support execution without adding a persistent generic status. A temporary Focus mode could show one or two selected Today tasks and hide the rest of the board until the user exits it.

This is intentionally not:

- A timer.
- A new task status.
- A productivity score.
- A background activity tracker.

It is simply a calmer way to act on an already-made commitment.

## 9. Use a native macOS toolbar

The full window should use a restrained top toolbar for:

- Current view or horizon.
- Board/list toggle.
- Search.
- Capacity summary.
- Focus mode.
- More actions.

The toolbar should not carry every possible command. Apple recommends using the spacious Mac window to reduce nested levels, support keyboard workflows, and keep toolbar items deliberate rather than overcrowded. ([Apple macOS design guidance](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos/), [Apple toolbar guidance](https://developer.apple.com/design/human-interface-guidelines/toolbars?changes=la))

Commands should remain available through the menu bar and keyboard even when the toolbar is hidden or narrowed.

## 10. Extend AI around realistic planning

The most valuable AI additions are decision aids:

- Clean up several rough captures.
- Suggest estimates for selected tasks.
- Explain why a proposed plan fits or exceeds capacity.
- Propose smaller versions of oversized work.
- Suggest which commitments to return when the day changes.

AI should never move cards autonomously. Every proposal should remain transient until accepted, and the review should show the exact commitment changes before writing them.

## Recommended release slices

### Workspace foundation

- Capacity-aware Ready → Today movement.
- Board/list parity.
- Spacebar peek inspector.
- Undoable keyboard- and pointer-based movement.
- Top toolbar with search and capacity context.

### Planning acceleration

- Needs attention rail.
- Multi-select and batch planning.
- Today / Next 7 Days / Later horizon.
- Full-window Plan My Day review.

### Distinctive polish

- Temporary Focus mode.
- Drag-in capture from selected text, links, or files.
- AI-based Make This Fit and plan explanations.
- Recent capture and recent completion review.

## Ideas to defer

Do not use this direction to justify:

- Custom columns.
- Persistent In Progress status.
- Arbitrary WIP card limits in place of capacity.
- Projects, subtasks, dependencies, tags, or assignees.
- Dense saved-view systems.
- Time tracking or calendar grids.
- Analytics dashboards.

The test is whether an idea makes commitment decisions clearer. If it mainly helps organize more metadata, it belongs outside the first workspace release.

## Success signals

The improvements are working when:

- Users can pull realistic work into Today faster than from the current Backlog view.
- Capacity cost is understood before commitment, not after the fact.
- Users can inspect and edit tasks without losing board context.
- Keyboard users can complete the core planning flow without relying on drag-and-drop.
- The full window is useful for planning sessions while the popover remains sufficient for ordinary daily use.
- Users describe the board as helping them make fewer, clearer commitments rather than as a project tracker.

## Research references

- [The Official Kanban Guide](https://kanban.university/wp-content/uploads/2023/04/The-Official-Kanban-Guide_A4.pdf)
- [Things: Today, Upcoming, Anytime, and Someday](https://culturedcode.com/things/support/articles/4001304/)
- [Linear: Board layout](https://linear.app/docs/board-layout)
- [Linear: Peek preview](https://linear.app/docs/peek)
- [Apple: Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos/)
- [Apple: Drag and drop](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop?changes=_3)
- [Apple: Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars?changes=la)

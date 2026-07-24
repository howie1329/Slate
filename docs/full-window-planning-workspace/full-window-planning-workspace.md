# Full-window planning workspace

> **Status:** Directional product definition
>
> **Updated:** 2026-07-24
>
> This document defines a possible desktop expansion for Slate after the local daily planner is trustworthy. It is a product direction, not an implementation plan or a commitment to every feature listed here.

## Direction

Slate should have two complementary surfaces:

- **Menu-bar popover:** Decide what fits today quickly.
- **Full application window:** Shape, review, and adapt the larger pool of work with more room and perspective.

The full application should become a visual planning workspace without changing Slate into a conventional project-management system. A board is the leading interaction model because it can make commitment state visible and make deliberate movement between Backlog and Today easier to understand.

The product idea is therefore not “add kanban to Slate.” It is:

> Give the user a calm, spacious surface for making commitments visible and realistic while keeping Today, capacity, and explicit choice at the center.

## Why this fits Slate

The current product already has the foundation for a commitment-based board:

- Tasks have a lifecycle from capture through completion.
- Backlog represents uncommitted work.
- Today represents deliberate commitments.
- Estimates make the cost of a commitment visible.
- Dates distinguish current commitments from unscheduled, future, and overdue work.
- The full window can provide more context without making the popover dense.

A visual workspace can improve three existing jobs:

1. See the shape of the available work.
2. Decide which work deserves space today.
3. Recover or reshape the plan when reality changes.

It should not create a second planning system with independent statuses, rules, or persistence semantics.

## Surface relationship

The popover remains the primary product surface. The normal daily loop must continue to work there:

- Capture a task.
- See Today’s capacity.
- Complete or edit a commitment.
- Open a reviewable AI action.

The full window is an expanded planning surface, not a replacement for the popover. It may expose more navigation, filters, batch actions, and review context, but it must use the same task data, capacity rules, native persistence boundaries, and confirmation behavior.

The full-window workspace should be available when the user intentionally opens the application. It should not make the compact popover behave like a miniature board.

## Initial board concept

The first board should be a derived view over the existing task model rather than a new status system.

### Primary lanes

- **Capture:** Newly captured or unsized work that is not ready to commit.
- **Ready:** Estimated, uncommitted work that could be considered for Today.
- **Today:** Active commitments dated for the current day.
- **Done:** Completed work, collapsed or visually secondary by default.

Future-dated work should remain available through a lightweight horizon view or date filter. Overdue work should remain an explicit state and recovery prompt, not become a permanent workflow lane that normalizes silent rollover.

The lane names can change through testing. Their meaning should remain grounded in commitment state, not generic project-management stages.

## Core interactions

### Moving work

Dragging a task between lanes should be a visible, deliberate state change:

- Capture → Ready requires a usable estimate.
- Ready → Today shows the change in remaining capacity before the move is committed.
- Today → Ready returns the commitment to uncommitted work and removes its Today date.
- Today → Done completes the task through the normal completion action.
- Done should not be treated as a planning destination for incomplete work.

A move initiated by the user may be applied after a clear drop action, including an over-capacity warning when appropriate. AI proposals and imported work must still remain reviewable before any write.

### Planning visibility

The workspace should keep these values close to the board:

- Today’s remaining minutes.
- Active committed minutes.
- Over-capacity amount when applicable.
- The number of unestimated tasks that cannot yet be planned.

Capacity is a decision aid, not a score or a board progress metric.

### Task detail

Selecting a card should open the existing compact task-detail interaction with more room for:

- Title and estimate editing.
- Date and commitment changes.
- Completion and return-to-Backlog actions.
- Lightweight context if later evidence supports it.

The first version should not require rich notes, subtasks, dependencies, or project records to make the board useful.

## Desktop feature set

The workspace can grow through several related capabilities, but they should be sequenced behind the core board.

### First release

- Commitment board with derived lanes.
- Drag-and-drop movement with capacity preview.
- Full-window Today, Backlog, and completed-work context.
- Keyboard navigation and visible focus states.
- Search and a small number of useful filters.
- Multi-select for safe batch actions such as estimate, date, complete, or return.
- Focus mode showing only active Today commitments.
- Full-window Plan My Day review with enough context to inspect proposed additions.
- A “Make This Fit” action that proposes a smaller or clearer version of oversized work and requires acceptance.

### Follow-up desktop affordances

- Today / Next / Later horizon review.
- Quick command menu for capture, navigation, and task actions.
- Dragging selected text, links, or files into Slate as reviewed capture candidates.
- Apple Shortcuts and Raycast capture after demand is established.
- Recent capture and recent completion views.
- Contextual end-of-day and disrupted-day review inside the full window.
- Calibration feedback that explains repeated planning misses without scoring productivity.

These are extensions of the same workspace, not reasons to add separate dashboards.

## AI role

AI should make the workspace easier to use while remaining subordinate to user decisions.

Useful directions include:

- Batch cleanup of rough captures.
- Estimate suggestions for several selected tasks.
- Smaller versions of oversized work.
- Explanations of why a proposed plan fits or exceeds capacity.
- Suggestions for what to return when the day no longer fits.

Every AI result remains transient until accepted. The workspace should not introduce chat history, background agents, autonomous board movement, or silent Today changes.

## Data and domain boundary

The initial workspace should reuse the existing task model and native command boundary. In particular:

- Board lanes are derived from task fields such as completion, estimate, and date.
- Dragging does not require a permanent kanban-status field in the first release.
- Capacity validation remains explicit and native-backed.
- SQLite remains the local source of truth.
- API keys remain in macOS Keychain and never enter board state, snapshots, logs, or change events.
- Cross-window invalidation continues to keep the popover and full window consistent.

A new persistent status field should be added only if real use shows that commitment state cannot express the user’s need. “In progress” should not be introduced merely because it is familiar from other kanban products.

## What this should not become

- A generic `To Do / In Progress / Done` project board.
- A system of custom columns and per-board workflows.
- A hierarchy of projects, subtasks, dependencies, tags, and assignees.
- A time-blocking or calendar grid.
- A dense analytics dashboard.
- An autonomous AI planner.
- A requirement that users open the full application for ordinary daily planning.

## Entry criteria

Begin this stage only after the Stage 1 1.0 and Stage 2 daily-resilience exit criteria are met. The following should also be true:

- Backlog and Today are understandable without the board.
- Capacity behavior is stable and trustworthy.
- Drag-and-drop can be made atomic and stale-safe at the native boundary.
- The full window and popover already share authoritative task state.
- Real use suggests that users need more visual planning context than the compact workflow provides.

## Exit criteria

The first workspace release is successful when:

- A user can understand the relationship between Capture, Ready, Today, and Done quickly.
- Moving work into Today makes its capacity cost clear before or at the moment of commitment.
- The board reduces planning friction without encouraging unnecessary task organization.
- The popover remains sufficient for the normal daily loop.
- Keyboard, pointer, reduced-motion, empty, overloaded, error, and persistence states are all usable.
- No board interaction silently rolls work forward or changes an existing commitment without an intentional user action.
- Users describe the full window as helping them shape realistic commitments, not as another project-management database.

## Roadmap placement

This direction belongs after **Stage 2 — Make the daily loop resilient** and before Spaces. The current roadmap names it **Stage 3 — Build the full-window planning workspace**. Spaces, calibration, outside context, and local agent access should follow the new stage unless evidence justifies a different order.

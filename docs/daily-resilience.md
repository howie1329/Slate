# Daily resilience

> **Status:** Directional product definition for Slate 1.1–1.x
>
> **Updated:** 2026-07-28

The 1.1 implementation begins with the focused global quick-capture slice described below. The rest of this document remains directional until the corresponding recovery flows are implemented.

## Purpose

Slate 1.0 establishes a trustworthy local capture-to-commit-to-completion loop. The 1.x resilience releases extend that loop in three ways:

1. Capture work without first opening Slate.
2. Resolve unfinished commitments without automatic rollover.
3. Adapt Today when the available capacity changes.

This is not a retrospective analytics system. Stage 2 records the accepted task and day changes that later Calibration needs, but its user-facing experiences remain operational and brief.

## Product promise

> When reality changes, Slate helps the user make a smaller, honest plan without losing control.

The menu-bar popover remains sufficient for the ordinary daily loop. Recovery appears only when invoked or when unfinished work clearly needs a decision; it does not become a permanent navigation destination.

## Release slices

### 1.1 — Capture anywhere

A configurable global shortcut opens a compact capture surface over the user’s current application.

The first release:

- Accepts a title and saves immediately to Backlog.
- Presents a two-line command bar at 520 × 100 with a 360 × 100 minimum: title/Add on the first row, destination/status and bounded recovery actions on the second.
- Does not require an estimate, date, AI provider, or network connection.
- Uses a dedicated compact capture window with focus-loss dismissal behavior.
- Confirms the destination and offers a short undo opportunity.
- Records `manual-quick-capture` as the source of the accepted task.
- Preserves an interrupted draft through focus loss and capture-window dismissal until it is explicitly discarded or captured.
- Uses the dedicated capture window and sends no task to Today: estimate and scheduled date remain empty.
- Limits Undo to the unchanged task revision and records `manual-quick-capture-undo` when it succeeds.

The first release does not silently attach selected text, clipboard contents, application names, URLs, or files, and it does not add AI cleanup, estimates, dates, tags, or a destination picker. Those inputs may be offered later as removable reviewed context after the basic shortcut proves useful.

User-authored quick capture creates a task directly. External integrations create candidates instead; those are separate trust levels and must not share an ambiguous persistence path.

### 1.2 — Close unfinished days

The unfinished-day review answers one question: what should happen to commitments that remain?

For each unfinished commitment, the user may:

- **Schedule** it for another explicitly selected date.
- **Return to Backlog** by clearing its date.
- **Reduce or clarify** it through ordinary task editing.
- **Release** it from active planning while retaining recoverable history.
- **Complete** it if the recorded state is wrong.
- **Leave unchanged** and exit the review.

Slate never preselects tomorrow. Dismissing or partially completing the review does not mutate the remaining decisions, and a partially completed review can resume from current SQLite state.

The surface may state factual current values such as the number of unfinished commitments and their planned minutes. It does not show completion percentages, scores, streaks, comparisons, or historical recommendations.

### 1.3 — Recover a changed day

**My Day Changed** begins with an explicit change to the day’s available capacity. The user may enter a new capacity or reduce/increase the current day by a number of minutes.

Slate then:

1. Preserves locked Anchor Commitments.
2. Shows which remaining commitments no longer fit.
3. Produces one transient proposed change set.
4. Explains each proposed keep or return decision.
5. Shows the resulting committed and remaining minutes.
6. Applies the entire accepted proposal atomically.

**Do Less** uses the same flow but begins with the amount of capacity the user wants to free. It does not delete work, infer energy, or automatically rewrite task scope. In 1.x, shrinking a task is a manual edit. AI-generated smaller versions belong to the later Make This Fit capability.

## Domain foundations

### Daily capacity

The existing settings value remains the user’s global daily capacity. Stage 2 adds an optional recurring weekday mode:

```text
effective capacity(date) = global capacity
  or the configured capacity for that date’s weekday
```

Capacity settings:

- Use either one global value or independent Monday–Sunday values.
- Preserve both global and weekday values when the mode changes.
- Allow zero weekday capacity for non-working days.
- Is validated with any proposal that depends on it.
- Is recorded as an accepted settings event.

Later calendar integrations may inform a reviewed capacity decision through the same review boundary. They never write it automatically.

### Anchor Commitments

An Anchor is a temporary protection for a task on one local date.

- Only active commitments for that date can be anchored.
- The product supports a small fixed maximum, initially one or two.
- Anchors are preserved by Plan My Day, My Day Changed, and Do Less unless the user unlocks them.
- Anchors expire with their date and do not become permanent task priority.
- An unfinished Anchor remains subject to the same explicit end-of-day decision as any other task.
- If Anchors alone exceed effective capacity, Slate explains the conflict and asks the user to unlock, edit, or deliberately keep the over-capacity plan.

Returning a task to Backlog is the deliberate way to remove it from active Today planning. A missing scheduled date is not a hidden secondary state: the task remains recoverable in Backlog, and permanent deletion remains a separate explicit destructive action.

### Accepted event history

The current task tables remain the source of truth. Slate does not become event-sourced.

An append-only event ledger records accepted changes needed for task inspection, recovery receipts, Calibration, and agent auditing. Each event includes:

- Event identifier.
- Task identifier when applicable.
- UTC occurrence timestamp.
- Relevant local calendar date.
- Event kind.
- Source.
- Operation identifier for changes accepted together.
- Structured before/after values required to explain the mutation.

Initial event kinds include:

- Task created.
- Title, estimate, or scheduled date changed.
- Committed to Today.
- Returned to Backlog.
- Completed or reopened.
- Anchored or unanchored.
- Returned to Backlog.
- Permanently deleted using a minimal non-secret tombstone.
- Global/weekday capacity settings changed.
- Recovery change set accepted.
- Day review closed, when the user explicitly closes it.

Sources distinguish at least:

- Manual popover or full-window action.
- Global quick capture.
- AI Assist.
- Plan My Day.
- My Day Changed or Do Less.
- Integration candidate acceptance.
- MCP capture or management.

Events never contain:

- API keys or integration credentials.
- Raw provider prompts or responses.
- Model reasoning.
- Dismissed or rejected transient proposals.
- Arbitrary full planner snapshots.

The event write occurs in the same SQLite transaction as the accepted mutation. Existing tasks at migration time receive a clear history-start boundary; Slate does not fabricate earlier events.

### Reviewed change sets

My Day Changed, Do Less, and later board batch actions share one native-authoritative contract.

A proposal contains:

- The expected affected task state or stable task revisions.
- The expected effective capacity and relevant Anchors.
- Ordered proposed task mutations.
- Before/after capacity totals.
- A short product-owned reason for each change.

Generation, retry, editing, and dismissal do not mutate SQLite. Acceptance validates the entire proposal against current state and either applies every change in one transaction or writes nothing.

This boundary should support deterministic proposals without AI. AI may help explain or shrink work later, but it does not own mutation authority.

## Interaction requirements

- Every flow works at the configured 360 × 520 minimum.
- Pointer and keyboard actions have equivalent outcomes.
- Review trays or panels keep only the task list scrollable when space is constrained.
- Escape dismisses transient proposals without mutation.
- Reduced Motion removes entrance, exit, and layout choreography without removing state feedback.
- Cross-window refresh must not silently replace a dirty recovery decision.
- Errors explain whether the proposal became stale, persistence failed, or an input is invalid.

## Deliberate non-goals

- Automatic rollover.
- A daily score or productivity report.
- Time tracking.
- Energy modeling.
- Permanent priorities or multiple Anchor levels.
- Automatic calendar scheduling.
- AI-generated recovery without review.
- A permanent Recovery route.
- Full task-history or Calibration dashboards in the popover.

## Entry criteria

- Slate 1.0 exit criteria are met.
- Manual task lifecycle, capacity, Plan My Day, and persistence are trustworthy.
- The packaged app and compact popover have passed release acceptance.

## Exit criteria

- Global capture is faster than opening Slate and does not create accidental commitments.
- Every unfinished commitment can be deliberately resolved without automatic rollover.
- A changed capacity can be reflected without manually rebuilding Today.
- Anchors remain temporary and understandable.
- Release is recoverable and distinct from completion and deletion.
- Accepted multi-task changes are atomic and stale-safe.
- Later Calibration and agent auditing have reliable accepted history to build on.

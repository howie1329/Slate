# Daily resilience

> **Status:** Directional Stage 2 foundation contract and conditional 2.3 full-window review definition
>
> **Updated:** 2026-07-28

The 1.1 implementation begins with the focused global quick-capture slice described below. The unfinished-day and changed-day review concepts originally described as 1.2 and 1.3 are moved to a conditional 2.3 full-window slot; they are not requirements for the menu-bar popover.

## Purpose

Slate 1.0 establishes a trustworthy local capture-to-commit-to-completion loop. Stage 2 extends that loop in two ways:

1. Capture work without first opening Slate.
2. Record accepted task and day changes with durable, stale-safe local boundaries so later workspace review can be trustworthy.

This is not a retrospective analytics system. Stage 2 records the accepted changes that later Calibration and the full-window workspace may need, but it does not force a large review surface into the popover.

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

## Conditional 2.3 — Full-window daily review and recovery

These are two separate candidates for the full-window workspace. Neither blocks the 2.0 foundation, 2.1 acceleration, or 2.2 polish work, and neither needs to be implemented in the menu-bar popover.

### Unfinished-day review

The review answers one question: what should happen to commitments that remain?

For each unfinished commitment, the user may:

- **Schedule** it for another explicitly selected date.
- **Return to Backlog** by clearing its date.
- **Reduce or clarify** it through ordinary task editing.
- **Complete** it if the recorded state is wrong.
- **Leave unchanged** and exit the review.

Slate never preselects tomorrow. Dismissing or partially completing the review does not mutate the remaining decisions, and a partially completed review can resume from current SQLite state. The surface states current facts only; it does not show completion percentages, scores, streaks, comparisons, or historical recommendations.

### Changed-day recovery

Only build this if real use shows repeated friction after a capacity change. The full-window flow may then:

1. Show which commitments no longer fit.
2. Produce one transient, deterministic proposal of keep/return changes.
3. Explain each proposed change and show before/after totals.
4. Preserve Anchor Commitments only if that concept still earns its complexity.
5. Apply the accepted proposal atomically and reject stale state without partial writes.

The existing task-level Return to Backlog and editing controls remain the fallback. AI is not required to generate the recovery proposal; any AI explanation or shrinking remains separately reviewable.

### Evidence gate and cleanup

Start either candidate only after the full-window workspace exists and real use shows that the compact task-level controls are insufficient. If the changed-day recovery candidate is not earned, remove provisional Anchor UI, domain logic, events, tests, and persisted state through a forward migration rather than leaving dormant product surface behind.

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

### Provisional Anchor groundwork

An Anchor is a possible future protection for a task on one local date. It is not required for the current Plan My Day contract: existing Today commitments are already fixed and Plan My Day only proposes additions from Backlog.

If the conditional 2.3 changed-day recovery flow is approved, Anchors may protect a small number of active Today commitments from a reviewed keep/return proposal. They must then remain temporary, understandable, and explicitly unlockable. If 2.3 is not earned, remove the provisional Anchor surface and persistence state through a forward migration.

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
- Returned to Backlog.
- Permanently deleted using a minimal non-secret tombstone.
- Global/weekday capacity settings changed.
- Recovery change set accepted, only if the conditional 2.3 flow ships.
- Day review closed, only if the conditional 2.3 unfinished-day review ships.

Sources distinguish at least:

- Manual popover or full-window action.
- Global quick capture.
- AI Assist.
- Plan My Day.
- My Day Changed or Do Less, only if the conditional 2.3 recovery flow ships.
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

Plan My Day and later board batch actions share one native-authoritative contract. The conditional 2.3 recovery flow may reuse the same boundary if it is approved.

A proposal contains:

- The expected affected task state or stable task revisions.
- The expected effective capacity and, if applicable, relevant Anchors.
- Ordered proposed task mutations.
- Before/after capacity totals.
- A short product-owned reason for each change.

Generation, retry, editing, and dismissal do not mutate SQLite. Acceptance validates the entire proposal against current state and either applies every change in one transaction or writes nothing.

This boundary should support deterministic proposals without AI. AI may help explain or shrink work later, but it does not own mutation authority.

## Interaction requirements

- Current compact flows work at their configured minimum sizes. The conditional 2.3 review flows are full-window experiences and are not required to fit inside the popover.
- Pointer and keyboard actions have equivalent outcomes.
- Review trays or panels keep only the task list scrollable when space is constrained.
- Escape dismisses transient proposals without mutation.
- Reduced Motion removes entrance, exit, and layout choreography without removing state feedback.
- Cross-window refresh must not silently replace a dirty review decision.
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
- A dedicated unfinished-day or changed-day review inside the menu-bar popover.

## Entry criteria

- Slate 1.0 exit criteria are met.
- Manual task lifecycle, capacity, Plan My Day, and persistence are trustworthy.
- The packaged app and compact popover have passed release acceptance.

## Exit criteria

- Global capture is faster than opening Slate and does not create accidental commitments.
- Plan My Day and other current multi-task actions remain reviewable, atomic, and stale-safe.
- Later Calibration and agent auditing have reliable accepted history to build on.

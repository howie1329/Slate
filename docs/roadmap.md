# Slate Product Roadmap

> **Status:** Directional roadmap
>
> **Updated:** 2026-07-23
>
> This document describes the order in which Slate should earn new capabilities. It is not a fixed release schedule. Each stage should be validated against the product thesis before the next stage expands the model.

## Product thesis

Slate is a calm, local-first macOS planner for one person deciding what work realistically fits into today.

The core loop is:

1. Capture work quickly.
2. Keep uncommitted work in Backlog.
3. Commit a realistic amount to Today.
4. Complete, adapt, or intentionally return work.
5. Learn from previous plans without turning productivity into a score.

Slate is not a project-management suite, calendar replacement, time-blocking tool, team workspace, or autonomous AI planner.

## Product guardrails

Future work should make at least one of these actions easier:

- Capture work.
- Decide what deserves space today.
- Protect or adapt today’s commitments.
- Make estimates and capacity more realistic.
- Reduce the need to check several other applications.

The following rules remain true as Slate grows:

- The menu-bar popover is the primary product surface.
- The normal daily loop must remain possible from the popover.
- Manual planning must work without AI, an account, or a network connection.
- AI and integrations propose changes; the user reviews them before they are committed.
- Slate never silently rolls unfinished work into another day.
- Capacity is expressed in understandable minutes, not opaque productivity scores.
- New organization must not become nested projects, tags, dependencies, or a dense task database without strong evidence.

## Where the project is now

Slate currently has the foundation for the first usable daily planning loop:

- Tauri macOS host with a compact menu-bar popover and full application window.
- Today, Backlog, and Settings routes using the same workspace shell.
- Local SQLite persistence for tasks, ordering, and non-sensitive preferences.
- Native task creation, editing, completion, deletion, scheduling, and reordering boundaries.
- Daily capacity state with visible remaining and over-capacity behavior.
- macOS Keychain storage for provider API keys.
- Renderer caching and cross-window invalidation through TanStack Query and native change events.
- Compact task-detail interaction above the persistent footer.
- Light and dark themes with a restrained visual system.
- Pointer-only Motion transitions for task presence/layout, task-detail entry and exit, route changes, empty states, and pending-save feedback.

The immediate product is not finished yet:

- AI Assist and the atomic Plan My Day review flow are implemented as reviewable vertical slices; final packaged/manual acceptance remains.
- Native, sidecar, and renderer tests cover the Plan My Day contract, candidate bounds, and stale-safe acceptance.
- The daily loop needs final empty, error, completed, and overloaded states.
- Compact-window behavior, reduced motion, documentation, and packaged-build quality need a final pass.
- The distinction between the current Backlog view and a future richer Log view should remain deliberate rather than being expanded prematurely.

The next goal is therefore not Spaces, sync, mobile, or integrations. It is a trustworthy 1.0 core.

## Stage 1 — Finish the local daily planner

### Goal

Make the capture-to-commit-to-completion loop reliable and demonstrable without requiring any future roadmap feature.

### Scope

- Finish task editing, scheduling, deletion, ordering, and capacity behavior.
- Make Today and Backlog understandable when empty, active, completed, overdue, and over capacity.
- Keep unsized tasks out of Today and AI-generated plans while allowing them to remain in Backlog.
- Preserve explicit Today commitments when planning again.
- Treat existing Today commitments as fixed planning context; only accepted eligible Backlog tasks receive today’s date and enter Today.
- Make Plan My Day additive and capacity-aware; it may fill available capacity but never removes or reorders existing commitments.
- Add AI Assist for rough capture: title cleanup, positive whole-minute estimate, and an optional date only when the user has not already supplied one.
- Put both AI actions in a footer-adjacent review tray. Nothing is persisted until the user accepts it.
- Validate accepted plans again at the SQLite transaction boundary so stale proposals cannot partially apply.
- Keep credentials in the native Keychain boundary; no provider key enters renderer state, SQLite, logs, or change events.
- Verify the popover at the configured minimum size and produce a stable packaged macOS build.

### Capacity contract

For 1.0, capacity is a daily budget in minutes. Today contains explicit commitments. Capacity is a visible planning constraint and warning, not an automatic rescheduler.

When a plan is over capacity, Slate should explain the overage and offer recovery actions. The user may deliberately keep an over-capacity commitment. Slate must not silently move or delete it.

### 1.0 exit criteria

- A new user can capture, estimate, schedule, commit, complete, and return a task without explanation.
- A returning user can understand Today’s remaining capacity from the popover at a glance.
- AI is optional and never blocks manual capture or task management.
- AI suggestions and plans are reviewable before any write.
- Plan acceptance is atomic and rejects stale or invalid proposals without partial writes.
- Closing and reopening the app preserves task and preference state.
- The popover and full window expose the same essential workflow.
- `npm run build` and the relevant native tests pass.

## Stage 2 — Make the daily loop resilient

### Goal

Help Slate remain useful when the day changes, without adding project-management complexity.

### Scope

- Global quick capture through a configurable shortcut, then evaluate Share extension, Shortcuts, URL scheme, clipboard capture, or Raycast based on actual demand.
- End-of-day review for unfinished commitments.
- Explicit choices to keep for another day, return to Backlog, reduce or clarify, or release a task.
- A small number of Anchor Commitments that Plan My Day and recovery proposals preserve unless unlocked.
- A contextual “My Day Changed” recovery flow that shows what no longer fits and proposes changes for review.
- A “Do Less” recovery action that preserves one or two anchors and reduces the rest of the day through a reviewable proposal.

### Guardrails

- No automatic rollover.
- Anchors do not create a second priority hierarchy.
- Recovery is contextual and temporary, not a permanent major navigation area.
- Capacity adjustments are explicit and reversible.

### Exit criteria

- An unfinished day can be closed deliberately in under a minute.
- A disrupted day can be recovered without rebuilding the plan manually.
- Users understand why Slate preserved, returned, or proposed a task.

## Stage 3 — Add planning contexts only if needed

### Goal

Support distinct parts of one person’s life without turning Slate into a hierarchy of projects.

The user-facing concept is **Spaces**. Examples might include Work, Personal, School, or Job Search.

### Minimal Space model

A task belongs to exactly one Space. A Space may have:

- Name and restrained visual identity.
- Backlog and Today commitments.
- Daily capacity.
- A short planning instruction.
- Completed and calibration history.

Spaces are not nested folders, projects, teams, or labels.

### Scope

- Create, rename, switch, and delete Spaces with clear handling for their tasks.
- Remember the last-used Space for quick capture.
- Plan within one Space using that Space’s capacity and instruction.
- Add an All Spaces view for review and comparison.
- Show Space identity on mixed-context views without adding visual noise inside a single Space.

### Important design decision

All Spaces should initially be a review surface, not an opaque global optimizer. Per-Space capacity must remain understandable. Slate should not silently let one Space consume another Space’s protected capacity.

### Entry criteria

Do not start Spaces because they are common in task managers. Start them when observed users regularly need separate capacity or planning rules that a single planner cannot express cleanly.

### Exit criteria

- Switching context is clear in the popover.
- A task’s Space is always understandable.
- Per-Space and total capacity do not conflict conceptually.
- The product still feels like a daily commitment planner, not a project-management suite.

## Stage 4 — Improve calibration and recovery quality

### Goal

Help users make better estimates and capacity decisions over time without measuring their worth by output.

### Scope

- Optional completion feedback: shorter than expected, about right, or longer than expected.
- Planned versus completed minutes.
- Estimate accuracy and common task durations.
- Repeatedly deferred-task review.
- Suggestions for smaller useful versions of oversized tasks through “Make This Fit.”
- Conservative capacity recommendations based on recent behavior.

### Rules for insights

- Call this Calibration or Review, not Analytics.
- Suggestions are directional and require acceptance.
- Do not show recommendations until there is enough history to avoid false precision.
- Never add streaks, badges, rankings, productivity scores, or shame-based language.
- Completion feedback is not a timer and should not turn Slate into a time-tracking system.

### Exit criteria

- Users can understand why a plan repeatedly fails.
- Slate helps shrink, clarify, release, or re-estimate work.
- Insights lead to better future plans without increasing pressure to work more.

## Stage 5 — Add outside context carefully

### Goal

Reduce context switching while preserving Slate as the place where commitments are reviewed.

### Sources Inbox

External systems create candidate actions, never automatic Today commitments.

Potential sources:

- GitHub assigned issues and pull-request review requests.
- Gmail messages with actionable requests.
- Existing task-service imports.
- Calendar context.

The flow is always:

```text
External source → candidate action → suggested Space/estimate → user review → Backlog or dismiss
```

Each candidate should retain its source, link, suggested title, estimate, and destination so the user can make an informed decision.

### Calendar-informed capacity

Start with one-way context. Calendar events may suggest that less capacity is available, but Slate should not initially create time blocks, schedule meetings, or claim to understand a person’s entire day.

### Optional sync and mobile

Sync is a separate product problem, not a prerequisite for the local Mac app. It should be considered only when there is a real multi-device use case and a clear conflict model. Local use must remain available offline, and an account must not be required for the Mac application.

A mobile companion should focus on capture, Today, completion, remaining capacity, and lightweight review. It does not need to reproduce desktop settings, bulk source management, or calibration dashboards.

### Exit criteria

- Imported work is easier to triage than the original cross-application workflow.
- No integration can silently consume Today capacity.
- Calendar context informs decisions without turning Slate into a calendar.
- Sync behavior and failure recovery are understandable before any hosted service is introduced.

## Stage 6 — Local agent access through MCP

### Goal

Allow local AI clients and coding agents to use Slate as the user’s persistent commitment system without putting chat inside Slate or requiring a cloud account.

This stage may move earlier than mobile or sync once the core domain and permission rules are stable.

### First release

- Local-only companion binary.
- MCP stdio transport.
- Shared task, capacity, planning, permission, and persistence rules with the desktop app.
- Agent-created work defaults to Backlog.
- No raw SQL or arbitrary database mutation.

Initial read operations may include listing Spaces, Today, Backlog, task details, remaining capacity, and planning context. Capture operations may add tasks or create reviewable candidates. Mutating Today, completion, or anchors should require an explicit permission level and a clear user request.

### Permission model

- **Read only:** inspect planning context.
- **Capture:** add proposed work to Backlog.
- **Manage:** update tasks or commitments, with a stronger warning and audit trail.

Every request must be authorized against the current stored setting, allowed Spaces, and current task state. A local process being available is not itself permission to mutate the planner.

### Exit criteria

- Agents can understand remaining capacity without receiving secrets or raw database access.
- Ambiguous agent requests capture work first rather than committing it.
- Desktop and MCP actions use the same validation rules.
- The user can disable access, revoke permission, and inspect recent agent activity.

## Evidence gates

Before expanding the product, answer these questions with real use:

- Do users understand Backlog versus Today without onboarding?
- Does Plan My Day save effort while preserving trust and control?
- Do users return for end-of-day review when plans change?
- Do multiple Spaces solve a recurring problem or merely add organization overhead?
- Do external candidates reduce capture friction or create another inbox to maintain?
- Does agent access create useful follow-up capture without making commitments feel unsafe?

If a feature does not improve one of these outcomes, it should be reduced, postponed, or removed.

## What Slate should not become

- A full project-management system with nested hierarchies and dependency graphs.
- A calendar or time-blocking replacement.
- An always-on autonomous agent.
- A social productivity product.
- A dashboard that turns work, rest, or reduced capacity into a performance score.
- A cloud service that is required for basic personal planning.

The long-term test is simple: Slate should help a person make fewer, clearer, more realistic commitments—and recover gracefully when reality changes.

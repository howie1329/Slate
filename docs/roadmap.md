# Slate Product Roadmap

> **Status:** Directional roadmap
>
> **Updated:** 2026-07-26
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

## Release framing

Roadmap stages describe dependency order and evidence gates. Versions describe a coherent user-facing release. A stage may span several minor releases, and conditional work must not block an unrelated capability merely because it has a later stage number.

| Release family | Roadmap stage | Product outcome |
| --- | --- | --- |
| **1.0** | Stage 1 | A trustworthy, distributable local daily planner. |
| **1.1–1.x** | Stage 2 | Capture from anywhere, close unfinished days deliberately, and recover when available capacity changes. |
| **2.0–2.x** | Stage 3 | A capacity-aware full-window planning workspace built over the same task model. |
| **3.0** | Stage 4 | History-informed calibration that improves estimates and capacity without scoring productivity. |
| **4.0, only if earned** | Stage 5 | Spaces for genuinely distinct personal planning contexts. |
| **5.0** | Stage 6 | Reviewed outside context from integrations and calendar-informed capacity. |
| **6.0, only if earned** | Stage 7 | Optional sync and a deliberately limited mobile companion. |
| **Independent post-1.x track** | Local MCP access | Permissioned local agent access once history, authorization, and shared domain rules are stable. |

The version labels are directional rather than promises of release dates. Calibration, Spaces, integrations, MCP, and device expansion remain evidence-gated. In particular, optional Spaces do not block calibration, integrations, or local MCP access.

## Where the project is now

Slate 1.0.0 is the shipped baseline for the first usable daily planning loop:

- Tauri macOS host with a compact menu-bar popover and full application window.
- Today, Backlog, and Settings routes using the same workspace shell.
- Local SQLite persistence for tasks, ordering, and non-sensitive preferences.
- Native task creation, editing, completion, deletion, scheduling, and persisted pointer/keyboard reordering.
- Daily capacity state with visible remaining and over-capacity behavior.
- macOS Keychain storage for provider API keys.
- Renderer caching and cross-window invalidation through TanStack Query and native change events.
- Compact task-detail interaction above the persistent footer.
- Light and dark themes with a restrained visual system.
- Pointer-only Motion transitions for task presence/layout, task-detail entry and exit, route changes, empty states, and pending-save feedback.
- Reviewable AI Assist and atomic Plan My Day flows through the Keychain-backed packaged Node sidecar.
- A signed, notarized, and stapled Apple Silicon DMG for macOS 13.5 or later.

Stage 1 is complete. The next eligible work is Stage 2 daily resilience, not Spaces, sync, mobile, or integrations. New work remains evidence-gated, and the distinction between the shipped Backlog view and a future richer Log view stays deliberate.

## Stage 1 — Shipped local daily planner

**Status:** Shipped in Slate 1.0.0; the 1.0 exit criteria are met.

### Goal

Make the capture-to-commit-to-completion loop reliable and demonstrable without requiring any future roadmap feature.

### Scope

- Finish task editing, scheduling, deletion, and capacity behavior.
- Make Today and Backlog understandable when empty, active, completed, overdue, and over capacity.
- Keep unsized tasks out of Today and AI-generated plans while allowing them to remain in Backlog.
- Preserve explicit Today commitments when planning again.
- Treat existing Today commitments as fixed planning context; only accepted eligible Backlog tasks receive today’s date and enter Today.
- Make Plan My Day additive and capacity-aware; it may fill available capacity but never removes or reorders existing commitments.
- Add AI Assist for rough capture: title cleanup, positive whole-minute estimate, and an optional date only when the user has not already supplied one.
- Put both AI actions in a footer-adjacent review tray. Nothing is persisted until the user accepts it.
- Validate accepted plans again at the SQLite transaction boundary so stale proposals cannot partially apply.
- Keep credentials in the native Keychain boundary; no provider key enters renderer state, SQLite, logs, or change events.
- Verify the popover at the configured minimum size.
- Choose and document the supported macOS and processor architecture matrix, then align the app plist, native binary, and bundled sidecar deployment targets with it.
- Replace starter bundle metadata and produce a Developer ID signed, notarized, and stapled DMG for direct distribution. The existing `macOSPrivateApi` dependency keeps Mac App Store distribution out of scope.

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
- The release artifact contains production metadata, covers the declared architecture/OS matrix, and passes Gatekeeper assessment after notarization and stapling.
- `npm run build` and the relevant native tests pass.

## Stage 2 — Make the daily loop resilient (1.1–1.x)

### Goal

Help Slate capture work outside the popover, close unfinished days deliberately, and recover when available capacity changes without introducing project-management complexity.

The detailed behavior and data boundaries are defined in [Daily resilience](daily-resilience.md).

### Entry criteria

- Stage 1 1.0 exit criteria are met.
- The signed, notarized packaged app and compact popover have passed release acceptance.
- Manual task lifecycle, capacity, AI review, and persistence are trustworthy before new history or recovery states expand the model.

Slate 1.0.0 satisfies these entry gates. Stage 2 remains a deliberate product decision rather than an automatic expansion.

### Foundations

Stage 2 introduces a small amount of durable domain infrastructure before its recovery experiences:

- Append-only task and day events that record accepted mutations, their source, and before/after values without turning SQLite into an event-sourced system.
- A per-day capacity override layered over the existing global default.
- Date-scoped Anchor Commitments.
- A recoverable **Released** disposition distinct from completion and destructive deletion.
- Stable expected-state or record-revision validation for cross-window edits and proposals.
- One reviewed change-set contract for multi-task recovery: generate a transient diff, validate it against current SQLite state, and apply it atomically only after acceptance.

History collection begins here because later calibration, agent auditing, and repeated-deferral review cannot be reconstructed retroactively. Stage 2 does not expose productivity statistics or aggregate analytics.

### Release slices

#### 1.1 — Capture anywhere

- Global quick capture through a configurable macOS shortcut.
- Immediate manual capture to Backlog without requiring an estimate, date, AI provider, or full-window interruption.
- Clear source attribution and a short undo opportunity.
- Evaluate Share extension, Shortcuts, URL scheme, clipboard, selected-text, or Raycast capture only after the global shortcut proves useful.

#### 1.2 — Close unfinished days

- A short unfinished-commitment review, not a statistical daily report.
- Explicit choices to schedule for another selected day, return to Backlog, reduce or clarify, release, complete, or leave unchanged.
- A small number of date-scoped Anchor Commitments that Plan My Day and recovery proposals preserve unless unlocked.
- A resumable review that never preselects tomorrow or automatically rolls work forward.

#### 1.3 — Recover a changed day

- An explicit, reversible per-day capacity adjustment.
- A contextual **My Day Changed** flow that shows what no longer fits.
- A **Do Less** action that preserves Anchors and proposes which commitments to keep, return, or release.
- Exact before/after changes and reasons for every proposed move.
- Atomic acceptance with stale-proposal rejection and no partial writes.

Task shrinking in Stage 2 is manual. One-off AI-generated smaller versions belong to Stage 3’s Make This Fit capability; history-informed shrink suggestions belong to Stage 4 Calibration.

### Guardrails

- No automatic rollover.
- No productivity scores, completion percentages, streaks, or mandatory reflection.
- Anchors do not create a permanent priority hierarchy.
- Recovery is contextual and temporary, not a permanent major navigation area.
- Capacity adjustments are explicit, date-specific, and reversible.
- History records accepted product actions only. It never stores credentials, raw prompts, model reasoning, or dismissed proposals.

### Exit criteria

- Capture from another application takes one shortcut and does not require opening the full workspace.
- An unfinished day can be resolved deliberately in under a minute.
- A disrupted day can be recovered without rebuilding the plan manually.
- Users understand why Slate preserved, returned, released, or proposed a task.
- Recovery proposals remain reviewable, atomic, and stale-safe across the popover and full window.
- The event history is sufficient to support later task inspection and calibration without fabricating past state.

## Stage 3 — Build the full-window planning workspace (2.0–2.x)

### Goal

Give Slate a visual, spacious desktop surface for shaping and reviewing commitments while preserving the menu-bar popover as the fast daily planning tool.

The product direction and release slices are defined in [Full-window planning workspace](full-window-planning-workspace/README.md).

### 2.0 — Workspace foundation

- Add a board and equivalent list as derived views over the existing task model.
- Use commitment-oriented lanes such as Capture, Ready, Today, and Done rather than generic project-management statuses.
- Establish shared selection, ordering, task detail, and capacity context across board and list.
- Add keyboard navigation and keyboard movement before or with drag-and-drop.
- Support deliberate pointer movement and task reordering with visible capacity impact.
- Keep movement atomic, stale-safe, and reversible through the Stage 2 mutation boundary.
- Add a restrained full-window toolbar with search, view selection, and capacity context.

### 2.1 — Planning acceleration

- Add a small number of useful filters and safe multi-select actions.
- Add batch Fit into Today and scheduling actions through reviewed change sets.
- Give Plan My Day more room for inspecting proposed additions before acceptance.
- Add a lightweight Today / Next / Later horizon without introducing a calendar or time-blocking grid.
- Add a calm Needs Attention surface for current actionable states such as missing estimates, overdue work, and over-capacity plans.

Repeated-deferral insights do not appear in the Needs Attention surface until Stage 4 Calibration has enough history.

### 2.2 — Distinctive workspace polish

- Add a temporary focus mode for active Today commitments.
- Add a reviewable one-off **Make This Fit** action for an oversized or unclear task.
- Add recent capture, completion, and per-task history inspection backed by the Stage 2 event ledger.
- Add drag-in capture from selected text, links, or files only as reviewed user capture.
- Reuse the Stage 2 end-of-day and disrupted-day recovery flows in the larger workspace rather than creating parallel implementations.

### Domain boundary

- Board lanes are derived from completion, estimate, date, and released state in the existing task model.
- Do not add a persistent kanban-status field until real use proves commitment state is insufficient.
- Capacity validation, expected-state checks, atomic writes, SQLite persistence, and cross-window invalidation remain authoritative.
- The normal daily loop must remain usable from the popover.

### Guardrails

- No custom columns, nested projects, subtasks, dependencies, tags, assignees, or arbitrary WIP system.
- Do not normalize overdue work into an automatic rollover lane.
- Do not add a generic In Progress state merely because it is familiar.
- User-initiated moves may warn about over-capacity, but AI and imported work remain reviewable before writes.
- The full window adds perspective and planning room; it does not become a prerequisite for ordinary daily planning.

### Entry criteria

- Stage 1 1.0 exit criteria are met.
- Stage 2 daily-resilience foundations and exit criteria are met.
- Backlog, Today, capacity, Anchors, release, and task lifecycle behavior are trustworthy without the board.
- Full-window and popover state share the same authoritative task, history, mutation, and persistence boundaries.
- Real use shows that users need more visual planning context than the compact workflow provides.

### Exit criteria

- Users understand the board’s commitment lanes quickly.
- Moving work into Today makes its capacity cost clear before or at commitment.
- Board and list feel like two views over one planning system.
- Keyboard, pointer, reduced-motion, empty, overloaded, error, undo, and persistence states are usable.
- No board action silently rolls work forward or changes an existing commitment.
- Users describe the full window as helping them shape realistic commitments rather than as a project-management database.

## Stage 4 — Improve calibration and recovery quality (3.0)

### Goal

Use accumulated history to help users make better estimates and capacity decisions without measuring their worth by output.

Calibration follows the core daily loop and history foundation directly. It does not depend on Spaces.

### Entry criteria

- Stage 2 has collected enough task and day events to avoid false precision.
- Event history distinguishes accepted manual, AI, and recovery changes.
- Planned minutes, completed planned minutes, estimate revisions, returns, releases, and deferrals have stable definitions.
- Any user-facing comparison clearly states that estimates are planning values, not measured time worked.

### Scope

- Optional completion feedback: shorter than expected, about right, or longer than expected.
- Planned minutes versus completed planned minutes.
- Estimate revisions and common accepted estimate ranges.
- Repeatedly deferred-task review.
- History-informed suggestions for smaller useful versions through Make This Fit.
- Conservative capacity recommendations based on recent closed or otherwise interpretable days.
- A restrained task-history inspector if it did not already ship in 2.x.

### Rules for insights

- Call this Calibration or Review, not Analytics.
- Suggestions are directional and require acceptance.
- Do not show recommendations until there is enough history to avoid false precision.
- Never add streaks, badges, rankings, productivity scores, completion percentages, or shame-based language.
- Completion feedback is not a timer and must not imply actual time tracking.

### Exit criteria

- Users can understand why a plan repeatedly fails.
- Slate helps shrink, clarify, release, or re-estimate work.
- Insights lead to better future plans without increasing pressure to work more.
- A user can inspect the evidence behind a recommendation.

## Stage 5 — Add planning contexts only if needed (4.0)

### Goal

Support distinct parts of one person’s life only when real use shows that a single capacity and planning instruction cannot express them cleanly.

The user-facing concept is **Spaces**. Examples might include Work, Personal, School, or Job Search.

### Minimal Space model

A task belongs to exactly one Space. A Space may have:

- Name and restrained visual identity.
- Backlog and Today commitments.
- Default and date-specific capacity.
- A short planning instruction.
- Anchors, recovery, completed work, and calibration history using the same shared rules.

Spaces are not nested folders, projects, teams, or labels.

### Prerequisite decisions

- Existing tasks migrate into one explicit default Space.
- Task history retains the Space that applied when an event occurred rather than inferring it only from current task state.
- Quick capture has a clear destination and remembers the last-used Space without making capture slower.
- Anchor limits, daily closure, recovery, and capacity remain understandable across one Space and All Spaces.
- All existing task, ordering, planning, mutation, and history operations become Space-aware together; no surface keeps an accidental global interpretation.

### Scope

- Create, rename, switch, and delete Spaces with clear handling for their tasks and history.
- Plan within one Space using that Space’s capacity and instruction.
- Add an All Spaces review surface.
- Show Space identity on mixed-context views without adding visual noise inside a single Space.
- Extend Calibration to compare or recommend within a Space only when each Space has enough evidence.

### Important design decision

All Spaces is initially a review surface, not an opaque global optimizer. Per-Space capacity must remain understandable. Slate must not silently let one Space consume another Space’s protected capacity.

### Entry criteria

Do not start Spaces because they are common in task managers. Start them only when observed users regularly need separate capacity or planning rules that a single planner cannot express cleanly.

### Exit criteria

- Switching context is clear in the popover.
- A task’s current Space and historical Space changes are understandable.
- Per-Space and total capacity do not conflict conceptually.
- Capture, Anchors, recovery, planning, and Calibration remain coherent within and across Spaces.
- The product still feels like a daily commitment planner, not a project-management suite.

## Stage 6 — Add outside context carefully (5.0)

### Goal

Reduce context switching while preserving Slate as the place where external work is reviewed.

### Sources Inbox

External systems create candidate actions, never tasks or Today commitments automatically.

Potential sources:

- GitHub assigned issues and pull-request review requests.
- Gmail messages with actionable requests.
- Existing task-service imports.
- Calendar context.

The flow is:

```text
External source → deduplicated candidate → suggested estimate/destination → user review → Backlog or dismiss
```

Space suggestions appear only when Spaces exist. Otherwise the destination is Backlog.

Each candidate retains its source, external identifier, link, suggested title, estimate, destination, refresh state, and dismissal state. Accepting a candidate creates a normal task with source attribution; candidate records do not become a second task database.

### Calendar-informed capacity

Calendar events may propose a date-specific capacity override through the Stage 2 review boundary. Slate does not initially create time blocks, schedule meetings, modify calendars, or claim to understand a person’s entire day.

### Security and reliability boundary

- Integration credentials remain in Keychain or the appropriate native credential store.
- External identifiers support deduplication and safe refresh.
- Imported content never bypasses title, estimate, date, capacity, or stale-state validation.
- Manual local planning remains fully available when sources are offline or disconnected.

### Exit criteria

- Imported work is easier to triage than the original cross-application workflow.
- Refreshing a source does not duplicate previously reviewed or dismissed candidates.
- No integration can silently create a Today commitment or alter capacity.
- Calendar context informs a reviewed decision without turning Slate into a calendar.
- Disconnecting a source does not damage accepted local tasks or the offline planner.

## Stage 7 — Optional sync and mobile (6.0)

### Goal

Support a proven multi-device use case without making an account or hosted service a prerequisite for the Mac application.

Sync and mobile are a separate product and architecture program from integrations.

### Entry criteria

- Real use shows demand for capture, Today, completion, remaining capacity, and lightweight review away from the Mac.
- Task identity, record revisions, deletion or release tombstones, conflict resolution, and offline recovery have explicit contracts.
- The local SQLite planner remains authoritative and usable when signed out or offline.
- The smallest useful companion experience justifies the hosted-service and account complexity.

### Scope order

1. Define identity, encryption, conflict, tombstone, and offline reconciliation behavior.
2. Build optional sync without changing the local manual workflow.
3. Ship a limited mobile companion for capture, Today, completion, remaining capacity, and lightweight review.
4. Expand mobile only when a mobile-specific workflow proves necessary.

The companion does not initially reproduce desktop settings, bulk source management, Spaces administration, or calibration dashboards.

### Exit criteria

- Sync conflicts and failure recovery are understandable before broad release.
- Local edits remain safe during network loss and reconcile predictably.
- Signing out does not remove or disable the local Mac planner.
- Mobile reduces capture or daily-review friction without becoming a second full product surface.

## Independent track — Local agent access through MCP

### Goal

Allow local AI clients and coding agents to use Slate as the user’s persistent commitment system without putting chat inside Slate or requiring a cloud account.

MCP is eligible after the Stage 2 history, authorization, expected-state, and shared mutation rules are stable. It may ship before the full-window workspace, Spaces, integrations, sync, or mobile and does not block those releases.

### First release

- Local-only companion binary using MCP stdio transport.
- Shared task, capacity, planning, validation, history, and persistence rules with the desktop app.
- Read Today, Backlog, task details, remaining capacity, and planning context.
- Capture explicitly requested work to Backlog with source attribution.
- No raw SQL, arbitrary database mutation, Today mutation, completion, or Anchor management.

Spaces are exposed only when Spaces exist. Reviewable external candidates are exposed only when the candidate model exists.

### Permission expansion

- **Read only:** inspect planning context.
- **Capture:** add explicitly requested work to Backlog.
- **Manage, later:** update tasks or commitments only after stronger warnings, expected-state validation, and a complete audit trail are proven.

Every request is authorized against the current stored permission, available scope, and current task state. A local process being available is not itself permission to mutate the planner.

### Exit criteria

- Agents can understand remaining capacity without receiving secrets or raw database access.
- Ambiguous requests do not become Today commitments.
- Desktop and MCP actions use the same validation and history rules.
- The user can disable access, revoke permission, and inspect recent agent activity.

## Cross-stage dependency rules

- Stage 2 records history; Stage 4 interprets it.
- Stage 2 owns reviewed multi-task change sets; Stage 3 reuses them for board and batch planning.
- The per-day capacity override introduced in Stage 2 is reused by Calibration, Spaces, and calendar-informed capacity.
- Make This Fit begins as a one-off Stage 3 proposal and becomes history-informed only in Stage 4.
- Spaces are optional and never block Calibration, integrations, MCP, sync, or mobile.
- Integration candidates and MCP capture may share source attribution, but neither depends on the other.
- An event or audit ledger is useful for sync diagnostics but does not replace a real sync conflict model.

## Evidence gates

Before expanding the product, answer these questions with real use:

- Do users understand Backlog versus Today without onboarding?
- Does Plan My Day save effort while preserving trust and control?
- Does global quick capture reduce capture friction without causing accidental commitments?
- Do users deliberately resolve unfinished days and recover changed days?
- Does the full-window workspace make commitment planning clearer without creating project-management overhead?
- Does Calibration improve future estimates without feeling evaluative?
- Do multiple Spaces solve a recurring problem or merely add organization overhead?
- Do external candidates reduce context switching or create another inbox to maintain?
- Does local agent access create useful capture without making commitments feel unsafe?
- Is multi-device demand strong enough to justify accounts, hosted sync, and conflict resolution?

If a feature does not improve one of these outcomes, it should be reduced, postponed, or removed.

## What Slate should not become

- A full project-management system with nested hierarchies and dependency graphs.
- A calendar or time-blocking replacement.
- An always-on autonomous agent.
- A social productivity product.
- A dashboard that turns work, rest, or reduced capacity into a performance score.
- A cloud service that is required for basic personal planning.

The long-term test is simple: Slate should help a person make fewer, clearer, more realistic commitments—and recover gracefully when reality changes.

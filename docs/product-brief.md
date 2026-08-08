# Slate Product Brief

> **Status:** Current product contract and 1.1 release candidate
>
> This brief describes the Slate 1.0.x product contract, the 1.0.1 onboarding release, the 1.1.0 quick-capture release candidate, and the boundaries future work must preserve. The staged expansion plan lives in [the roadmap](roadmap.md).

## Product definition

Slate is a local-first macOS planner that helps one person decide what work realistically fits into today. Its defining idea is a daily commitment budget: tasks have an estimated duration, and Slate makes the cost of a commitment visible before and after it is added to the day.

Slate should feel calmer than a conventional task manager. It is not a project-management suite, calendar replacement, time-blocking tool, team workspace, or autonomous AI that plans a person’s life for them.

## Target user

An individual knowledge worker who captures more work than they can reliably finish and wants a small, private desktop tool for deciding what actually fits today.

## Current product state

Slate 1.1.0 is the current local planning release candidate. It provides:

- A Tauri macOS shell with a menu-bar popover and full application window.
- A unified Daily workspace and a separate Settings route using the same workspace shell.
- Local SQLite persistence for tasks, ordering data, daily capacity, and non-sensitive preferences.
- Task creation, editing, completion, deletion, and calendar-date scheduling.
- Pointer and keyboard ordering within the active Today list, persisted through SQLite.
- Visible Today capacity, remaining minutes, and over-capacity state.
- A task-detail panel above the compact Settings utility strip.
- macOS Keychain storage for provider API keys.
- Reviewable AI Assist and Plan My Day flows through the packaged Node sidecar.
- A short, skippable first-run onboarding flow that explains capacity, Backlog, Today, and task details.
- Configurable global quick capture with a dedicated compact capture window, title-only Backlog creation, draft preservation, and revision-safe Undo.
- Cross-window refresh through native planner-change events and TanStack Query invalidation.

AI Assist and Plan My Day ship as reviewable Keychain-backed sidecar flows. The manual workflow remains the product’s source of truth, and AI never commits a task or plan without explicit acceptance.

End-of-day review, changed-day recovery, Spaces, integrations, sync, mobile, and MCP remain outside the shipped 1.1 baseline and follow the evidence-gated roadmap. The unfinished-day and changed-day review candidates are now conditional full-window 2.3 work.

### 1.1 global quick capture slice

The configurable `CommandOrControl+Shift+Space` shortcut opens Slate’s dedicated compact capture window and focuses the capture input. A title is saved immediately as an unestimated, unscheduled Backlog task with source `manual-quick-capture`; it never commits work to Today. The in-process draft survives focus loss and capture-window dismissal, and an explicit discard clears it.

The capture window is a two-line command bar: a 40px title field with a separate Add action, followed by a quiet Backlog/status line. It opens at 520 × 100 and supports a 360 × 100 minimum without inheriting the planner popover’s 360 × 520 geometry.

The returned task revision bounds a five-second Undo action. Undo succeeds only while the task remains unchanged, incomplete, unscheduled, and unestimated, and records a `manual-quick-capture-undo` deletion event in the same SQLite transaction. Clipboard, selected-text, application, URL, file, AI enrichment, and destination-picker capture remain deferred.

## Product surfaces

- **Daily workspace** is the default workspace. It shows Today as the dominant section and a flat, collapsible Backlog beneath it. Today includes dated work for today, active committed minutes, remaining capacity, unsized commitments that need estimates, over-capacity state, and completed work at the bottom. There is no separate Done section.
- **Backlog** is the current task record for work that is not committed to Today. Its metadata can identify Needs estimate, Unscheduled, Overdue / needs reschedule, and Upcoming work without making each state a top-level route or section.
- **Settings** contains daily capacity, AI provider/model/key configuration, and the persistent planning instruction.
- **Daily command row** is always available at the top of the workspace. It supports search, quick manual capture, Save, and the context-sensitive AI action. Text invokes AI Assist; empty input invokes the Plan My Day review flow. A thin Settings utility strip remains available at the bottom.
- **Menu-bar popover** is the primary surface. It dismisses when focus leaves it and must support the essential daily loop within the compact window.
- **Full window** provides more room for the same workflow. It may later support configuration, comparison, history, and review surfaces, but it must not be required for ordinary daily planning.

The term **Log** may become a future product label if it makes the broader task record clearer. The current route and user-facing surface remain Backlog until that change is earned through testing.

## 1.0 product goal

Make the local capture-to-commit-to-completion loop reliable enough that Slate is useful without any future roadmap feature.

The 1.0 loop is:

1. Capture a task from the Daily command row with a title.
2. Add or suggest a positive whole-minute estimate.
3. Keep newly captured but uncommitted work in Backlog.
4. Deliberately place work on Today; an unsized task may be committed manually but remains visibly in need of an estimate.
5. See the cost of the commitment against daily capacity.
6. Complete, edit, return, or delete the work.
7. Use AI only as an optional, reviewable aid for capture and planning.

## 1.0 behavior contract

- A task requires a non-empty title. Duration may be empty at quick capture; new captures land in Backlog by default. A user may explicitly move an unsized task into Today, where it remains visibly in need of an estimate and cannot enter an AI-generated plan until sized.
- Duration is measured in whole minutes. The core loop does not model energy, priority, time of day, start/end times, or calendar blocks.
- A scheduled date is a calendar date only (`YYYY-MM-DD`). No date means the task is unscheduled; today’s date places it on Today; a future date appears under Upcoming; a past date appears under Overdue / needs reschedule.
- Today contains deliberate commitments, not an automatically rolled-forward list.
- Unfinished tasks keep their original date after it passes. Slate never silently moves them to tomorrow.
- Active sized Today tasks count against known daily capacity. Unsized Today commitments do not contribute a guessed minute cost; they remain visible as needing an estimate alongside the known remaining minutes. Completed tasks remain visible as history but do not count toward active remaining capacity.
- Slate may allow a user to keep an over-capacity Today plan. The meter and affected task make the overage visible, and recovery actions help the user return work to Backlog or revise the plan.
- Plan My Day considers only eligible estimated Backlog tasks and the current remaining capacity. It preserves existing uncompleted Today commitments, proposes an additive plan, and never silently removes or reorders existing commitments.
- Existing Today tasks are planning constraints, not move candidates. Accepted Backlog selections receive the current local Today date and Today scope only after user approval.
- Every AI result is transient until the user accepts it. Dismiss and Redo do not write task or plan changes.
- Accepted Plan My Day assignments are validated again at the native SQLite boundary and applied atomically. A stale or invalid proposal must make no partial writes.
- Manual capture, editing, scheduling, completion, deletion, and persistence work without an AI provider, API key, or network connection.
- API keys remain in macOS Keychain. They do not appear in SQLite, planner snapshots, renderer review state, change events, or logs.

## AI actions for 1.0

The Daily command row has one context-sensitive AI action:

- With composer text, it becomes **AI Assist** and proposes a cleaner title, a positive whole-minute estimate, and an optional date only when the user has not already supplied one.
- With an empty composer, it becomes **Plan My Day** and proposes eligible Backlog tasks that fit the remaining capacity.

Both actions use a compact review tray above the footer. The user can edit or dismiss an AI Assist proposal, or review and accept/dismiss a Plan My Day proposal. The native layer owns provider requests, structured-result validation, and credential access. The renderer receives only safe, non-secret proposal data.

The detailed request and result contract lives in [the AI actions brief](ai-actions-brief.md).

## 1.0 success criteria

- A new user can capture a task, set capacity, estimate work, and understand Today without instructions.
- A returning user can see what fits today from the menu-bar popover in one glance.
- Every essential daily action works in the popover and full window.
- Closing and reopening the app does not lose tasks, estimates, dates, capacity, completion state, or non-sensitive preferences.
- Over-capacity and persistence failures are understandable and recoverable.
- AI actions save effort without making the user feel that commitments changed behind their back.
- The workflow remains usable in the configured compact window, including the 360 × 520 minimum.
- The product can be packaged and demonstrated without explaining unfinished core behavior.

## Explicitly out of 1.0

- Accounts, cloud sync, collaboration, and sharing.
- Calendar integrations, time-of-day scheduling, and automatic recurring plans.
- Spaces, nested projects, tags, subtasks, dependencies, explicit priority systems, and energy modeling.
- Rich notes and long-form task context.
- AI chat history, background agents, autonomous commits, model discovery, pricing UI, or provider-specific control surfaces.
- Notifications, focus timers, productivity scores, streaks, badges, rankings, and analytics dashboards.
- Mobile applications and external task integrations.

These are not rejected permanently. They remain outside 1.0 until the deterministic local workflow is reliable and real usage shows that the added complexity solves a recurring problem.

## Long-term direction

Slate may expand around the same commitment-budget model in the following order:

1. **1.1–1.x — Capture and foundations:** global capture, accepted task/day history, recurring capacity, stale-safe mutations, and the shared boundaries required by later workspace actions.
2. **2.0–2.2 — Full-window planning workspace:** a visual desktop surface for shaping commitments while preserving the popover as the fast daily planning tool.
3. **2.3, conditional — Full-window daily review:** unfinished-commitment review and changed-day recovery only if real use shows that the compact task-level controls are insufficient.
4. **3.0 — Calibration:** respectful, history-informed feedback and conservative suggestions that improve estimates and capacity without scoring productivity.
5. **4.0, only if earned — Spaces:** distinct planning contexts with their own capacity only when users demonstrate that one planner cannot express their needs.
6. **5.0 — Outside context:** reviewed, deduplicated candidate actions from systems such as GitHub and Gmail, plus calendar-informed capacity proposals.
7. **6.0, only if earned — Optional sync and mobile:** explicit identity, conflict, tombstone, and offline-recovery rules followed by a limited mobile companion for a proven multi-device use case.

**Local agent access** is an independent post-1.x track. A permissioned MCP interface may arrive before later major releases once history, authorization, expected-state validation, and shared domain rules are stable. It does not depend on Spaces, integrations, sync, or mobile.

Each expansion is conditional. Optional Spaces do not block Calibration, integrations, or MCP. The full sequencing, dependency rules, entry criteria, exit criteria, and non-goals are maintained in [the roadmap](roadmap.md). The Stage 2 behavior and data contract is maintained in [Daily resilience](daily-resilience.md).

## Product guardrails

- Protect the daily decision from feature sprawl.
- Prefer explicit user choices over hidden automation.
- Keep estimates and capacity understandable in minutes.
- Preserve a useful offline-capable core even if external services are added later.
- Keep the menu-bar popover capable of the normal daily loop.
- Treat external work as a candidate until the user reviews it.
- Add a feature only when it makes deciding what fits today easier.

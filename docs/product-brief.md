# Slate Product Brief

> **Status:** Current product contract and 1.0 direction
>
> This brief describes what Slate is now, what 1.0 must prove, and which boundaries future work must preserve. The staged expansion plan lives in [the roadmap](roadmap.md).

## Product definition

Slate is a local-first macOS planner that helps one person decide what work realistically fits into today. Its defining idea is a daily commitment budget: tasks have an estimated duration, and Slate makes the cost of a commitment visible before and after it is added to the day.

Slate should feel calmer than a conventional task manager. It is not a project-management suite, calendar replacement, time-blocking tool, team workspace, or autonomous AI that plans a person’s life for them.

## Target user

An individual knowledge worker who captures more work than they can reliably finish and wants a small, private desktop tool for deciding what actually fits today.

## Current product state

The current application is a pre-1.0 local planning foundation. It already provides:

- A Tauri macOS shell with a menu-bar popover and full application window.
- Today, Backlog, and Settings routes using the same workspace shell.
- Local SQLite persistence for tasks, ordering data, daily capacity, and non-sensitive preferences.
- Task creation, editing, completion, deletion, and calendar-date scheduling.
- Visible Today capacity, remaining minutes, and over-capacity state.
- A task-detail panel above the persistent footer.
- macOS Keychain storage for provider API keys.
- Cross-window refresh through native planner-change events and TanStack Query invalidation.

The following are deliberately not presented as shipped yet:

- Plan My Day provider requests and atomic review acceptance.
- A finished drag-and-drop ordering experience.
- Global quick capture, end-of-day review, Spaces, integrations, sync, mobile, or MCP.

AI Assist is implemented on the current branch as a reviewable Keychain-backed sidecar flow. Plan My Day remains unavailable until its own provider, review, and atomic acceptance slice is implemented and validated. The manual workflow remains the product’s source of truth.

## Product surfaces

- **Today** is the default workspace. It shows dated tasks for today, active committed minutes, remaining capacity, over-capacity state, and completed work at the bottom.
- **Backlog** is the current task record. It groups captured work into Needs estimate, Unscheduled, Overdue / needs reschedule, Upcoming, and Completed.
- **Settings** contains daily capacity, AI provider/model/key configuration, and the persistent planning instruction.
- **Persistent footer** is always available in the workspace. It supports quick manual capture, Save, the context-sensitive AI action, and Settings access. Text invokes the shipped AI Assist flow; empty input exposes Plan My Day as unavailable until its own slice is shipped.
- **Menu-bar popover** is the primary surface. It dismisses when focus leaves it and must support the essential daily loop within the compact window.
- **Full window** provides more room for the same workflow. It may later support configuration, comparison, history, and review surfaces, but it must not be required for ordinary daily planning.

The term **Log** may become a future product label if it makes the broader task record clearer. The current route and user-facing surface remain Backlog until that change is earned through testing.

## 1.0 product goal

Make the local capture-to-commit-to-completion loop reliable enough that Slate is useful without any future roadmap feature.

The 1.0 loop is:

1. Capture a task from the persistent footer with a title.
2. Add or suggest a positive whole-minute estimate.
3. Keep captured but uncommitted work in Backlog.
4. Deliberately place eligible work on Today.
5. See the cost of the commitment against daily capacity.
6. Complete, edit, return, or delete the work.
7. Use AI only as an optional, reviewable aid for capture and planning.

## 1.0 behavior contract

- A task requires a non-empty title. Duration may be empty at quick capture; unsized tasks remain in Backlog and cannot enter Today or an AI-generated plan until sized.
- Duration is measured in whole minutes. The core loop does not model energy, priority, time of day, start/end times, or calendar blocks.
- A scheduled date is a calendar date only (`YYYY-MM-DD`). No date means the task is unscheduled; today’s date places it on Today; a future date appears under Upcoming; a past date appears under Overdue / needs reschedule.
- Today contains deliberate commitments, not an automatically rolled-forward list.
- Unfinished tasks keep their original date after it passes. Slate never silently moves them to tomorrow.
- Active Today tasks count against the daily capacity. Completed tasks remain visible as history but do not count toward active remaining capacity.
- Slate may allow a user to keep an over-capacity Today plan. The meter and affected task make the overage visible, and recovery actions help the user return work to Backlog or revise the plan.
- Plan My Day considers only eligible estimated Backlog tasks and the current remaining capacity. It preserves existing uncompleted Today commitments, proposes an additive plan, and never silently removes or reorders existing commitments.
- Every AI result is transient until the user accepts it. Dismiss and Redo do not write task or plan changes.
- Accepted Plan My Day assignments are validated again at the native SQLite boundary and applied atomically. A stale or invalid proposal must make no partial writes.
- Manual capture, editing, scheduling, completion, deletion, and persistence work without an AI provider, API key, or network connection.
- API keys remain in macOS Keychain. They do not appear in SQLite, planner snapshots, renderer review state, change events, or logs.

## AI actions for 1.0

The persistent footer has one context-sensitive AI action:

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

1. **Daily resilience:** global capture, end-of-day review, anchors, and contextual recovery when the day changes.
2. **Spaces:** distinct planning contexts with their own capacity only when users need them.
3. **Calibration:** respectful feedback and conservative suggestions that improve estimates and capacity without scoring productivity.
4. **Outside context:** reviewed candidate actions from systems such as GitHub, Gmail, and calendar-informed capacity.
5. **Optional device expansion:** mobile capture and review, followed by sync only when a real multi-device need and conflict model exist.
6. **Local agent access:** an optional, permissioned MCP interface that captures agent-discovered work into Backlog by default.

Each expansion is conditional. The full sequencing, entry criteria, exit criteria, and non-goals are maintained in [the roadmap](roadmap.md).

## Product guardrails

- Protect the daily decision from feature sprawl.
- Prefer explicit user choices over hidden automation.
- Keep estimates and capacity understandable in minutes.
- Preserve a useful offline-capable core even if external services are added later.
- Keep the menu-bar popover capable of the normal daily loop.
- Treat external work as a candidate until the user reviews it.
- Add a feature only when it makes deciding what fits today easier.

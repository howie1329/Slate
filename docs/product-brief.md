# Slate product brief

## Product definition

Slate is a local-first macOS planner that helps one person decide what work realistically fits into today. Its defining idea is a daily commitment budget: tasks have an estimated duration, and the product makes the cost of a commitment visible before and after it is added to the day.

Slate should feel calmer than a conventional task manager. It is not a project-management suite, a calendar replacement, a time-blocking tool, or an autonomous AI that plans a person’s life for them.

## Target user

An individual knowledge worker who captures more work than they can reliably finish and wants a small, private desktop tool for deciding what actually fits today.

## Product surfaces

- **Today** is the default workspace. It shows today’s dated tasks, active committed minutes, remaining capacity, over-capacity state, and completed work at the bottom.
- **Log** is the task record. It groups tasks into Needs estimate, Unscheduled, Upcoming, Overdue / needs reschedule, and Completed.
- **Settings** contains daily capacity, AI provider/model/key, and the persistent planning instruction.
- **Persistent footer** is always available in the workspace. It contains quick capture, Save, AI Assist, Plan My Day, Replan My Day, and the AI availability indicator.
- **Menu-bar popover** toggles from the macOS menu bar, dismisses when clicking outside, and exposes the same GUI and actions as the full app. An Open Full App action opens the larger version of the same shell.

## MVP

The MVP is a five-hour-hackathon-sized, local-first daily planning loop:

1. Capture a task from the persistent footer with a single input.
2. Save it manually or use AI Assist to suggest a title, duration, and optional date.
3. Review, edit, delete, complete, or return tasks to Log.
4. Set a daily capacity in Settings; the default is 240 minutes / 4 hours.
5. Plan only tasks with valid positive duration estimates onto Today.
6. Use Plan My Day to generate a reviewable plan from Log tasks and the persistent planning instruction.
7. Use Replan My Day to produce a revised plan when capacity or circumstances change.
8. Persist tasks and preferences in local SQLite across restarts.
9. Use the same GUI in the menu-bar popover and full app.

### MVP behavior rules

- A task requires a title, but duration may be empty at quick capture. Such tasks show Needs estimate and cannot enter Today or an AI plan until sized.
- Duration is measured in whole minutes. The MVP has no energy field, priority field, time-of-day, start/end-of-day, or calendar time-block model.
- A task’s scheduled date is a calendar date only (`YYYY-MM-DD`). No date means it remains unscheduled in Log; today’s date puts it on Today; a future date appears under Upcoming.
- Plan My Day and Replan My Day only consider tasks with valid durations. They use capacity, dates, task text, and the persistent planning instruction; they do not silently change data.
- AI results appear in a reusable result tray directly above the persistent footer. The user must accept or dismiss task suggestions and plans before any changes are written.
- AI is optional. Without a configured key or network access, manual capture and task management remain fully usable. AI controls may be disabled or show an availability state.
- The app allows a task to push Today over capacity. The meter and offending task show the overage, and the primary recovery action is Return to Log, which removes the date. The user may also run Replan My Day or keep the task on Today.
- Completed tasks remain visible at the bottom of Today in a muted completed state, do not count toward active remaining capacity, and also appear in Log → Completed.
- Unfinished tasks keep their original date after it passes and appear in Log → Overdue / needs reschedule. Slate never silently rolls them into tomorrow.
- The AI provider selector supports Vercel Gateway and OpenRouter, with a curated list of two or three supported models. The selected provider and model persist in Settings.
- API keys are stored in the macOS Keychain through the Tauri layer. Non-sensitive preferences are stored in SQLite.

### MVP success criteria

- A new user can capture a task, set capacity, and build a first plan without instructions.
- A returning user can understand what fits today in one glance from the menu-bar popover.
- A user can perform every MVP action from the popover, while the full app provides more room for the same GUI.
- Closing and reopening the app does not lose tasks, estimates, dates, capacity, completion state, or non-sensitive preferences.
- AI actions produce reviewable structured results and never block the manual workflow.
- The workflow stays usable in the current 440×640 shell and down to the configured 360×520 minimum.

## Explicitly out of MVP

- Accounts, Clerk, Convex, cloud sync, collaboration, and sharing.
- Calendar integrations, time-of-day scheduling, and automatic recurring plans.
- Recurring tasks, projects, tags, subtasks, explicit priorities, energy modeling, and complex filters.
- AI chat history, background agents, autonomous commits, model discovery, pricing UI, or provider-specific controls.
- Notifications, focus timers, productivity scores, and analytics.

These may become final-product capabilities only after the deterministic local workflow is reliable.

## Final product direction

The final product remains a focused personal planning system, expanded around the same commitment-budget model:

- A fast menu-bar and global-shortcut capture surface that feeds the Log.
- A multi-day planner that proposes realistic plans from capacity, dates, deadlines, and user direction while keeping the user in control.
- Stronger AI assistance for clarification, estimation, triage, replanning, and end-of-day review. Suggestions still require review before changing commitments.
- Projects and areas for organization without turning the product into a task database.
- Recurring tasks, defer/reschedule flows, reminders, and lightweight calendar context.
- Optional encrypted sync across the user’s Apple devices, with local data remaining usable offline.
- Optional Convex and Clerk integrations, followed by external context from systems such as Composio, Gmail, and GitHub.
- Small, respectful summaries such as planned versus completed time; no productivity gamification.

The final product should preserve the MVP promises: local-first behavior, visible time cost, deliberate commitment, and a quiet desktop experience.

## Product guardrails

- Protect the daily decision from feature sprawl.
- Prefer explicit user choices over hidden automation.
- Keep estimates and capacity understandable in minutes.
- Preserve an offline-capable core even if sync is added later.
- Add a feature only when it makes deciding what fits today easier.

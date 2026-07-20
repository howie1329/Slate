# Implementation plan: MVP menu-bar daily planning loop

## Objective

Turn the current placeholder shell into a reliable menu-bar-first workflow for capturing tasks, assigning time estimates, planning work onto today, and completing it against a daily capacity budget. The target is a focused five-hour implementation, so every phase must preserve the narrow product boundary in `docs/product-brief.md`.

## Scope

### In scope

- SQLite persistence behind a small repository/adapter boundary.
- macOS Keychain storage for BYOK API keys.
- Today, Log, and Settings workspace views.
- Persistent footer with manual capture and AI actions.
- Menu-bar tray/popover toggling, outside-click dismissal, and Open Full App.
- Daily capacity setting with a 240-minute default.
- Date-only task planning and Log grouping.
- Visible over-capacity state with Return to Log recovery.
- Three optional AI actions: AI Assist, Plan My Day, and Replan My Day.
- Reusable AI result tray with review, loading, unavailable, and error states.
- Empty, validation, persistence-error, and keyboard accessibility states.

### Out of scope

- Accounts, Clerk, Convex, sync, collaboration, calendar integration, time-of-day scheduling, recurring tasks, projects, notifications, energy modeling, explicit priorities, AI chat history, and autonomous AI commits.

## Proposed domain model

Keep the first model small and explicit:

```text
Task
  id: string
  title: string
  estimateMinutes?: number
  notes?: string
  status: "unscheduled" | "planned" | "completed"
  scheduledDate?: YYYY-MM-DD
  createdAt: ISO timestamp
  completedAt?: ISO timestamp

Settings
  dailyCapacityMinutes: number // default 240
  planningInstruction: string
  aiProvider: "vercel-gateway" | "openrouter"
  aiModel: string // one of the curated supported models
```

`estimateMinutes` is nullable at capture time. A missing value derives the Needs estimate state and excludes the task from Today and AI plans. `scheduledDate` is date-only; there is no time-of-day field. Completed tasks retain their date and remain visible on Today until the day changes.

The storage boundary should expose task operations and settings operations to the UI without coupling route components to the storage implementation. Use SQLite through the simplest dependable Tauri-compatible SQL integration available, with migrations. Keep the repository replaceable so a future Convex adapter can be added without changing route components. Store the API key in macOS Keychain rather than SQLite.

## Delivery phases

### 1. Native shell and storage foundation

- Add the menu-bar tray icon and compact popover window.
- Toggle the popover from the icon, dismiss it on outside click, and add Open Full App.
- Add SQLite migrations and a thin task/settings repository.
- Add Tauri Keychain access for the API key.
- Load state on startup and handle malformed records/write failures visibly.

### 2. Workspace shell and capture footer

- Replace the placeholder Inbox concept with Today, Log, and Settings views.
- Add the persistent footer with text input, Save, AI Assist, Plan My Day, Replan My Day, and AI availability.
- Allow manual capture with title-only tasks; show Needs estimate until the user adds a duration.
- Keep the footer and workspace usable in both popover and full-app modes.
- Add keyboard-friendly focus order and submit behavior.

### 3. Log and Today workflow

- Build Log sections for Needs estimate, Unscheduled, Upcoming, Overdue / needs reschedule, and Completed.
- Build Today with date, capacity meter, planned tasks, completion, edit/delete, and Return to Log.
- Allow tasks to exceed capacity; show the numerical overage and mark contributing tasks.
- Keep completed tasks at the bottom of Today in a muted state and exclude them from active remaining capacity.
- Preserve past dates for unfinished work and surface it as Overdue in Log.

### 4. AI actions and review tray

- Add provider/model selection for Vercel Gateway and OpenRouter using Vercel AI SDK v7.
- Add AI Assist to suggest title, duration, and optional date from the capture text.
- Add Plan My Day to propose a dated, ordered plan using only valid-duration tasks, capacity, and the saved planning instruction.
- Add Replan My Day using the same structured proposal flow.
- Render all AI work in one tray above the footer: loading, review, accept/edit/dismiss, unavailable, and retryable error states.
- Require confirmation before any AI result changes tasks or dates.

### 5. Verification and polish

- Verify restart persistence and the 360×520 minimum window.
- Verify popover toggle, outside-click dismissal, and Open Full App.
- Verify manual workflow with no key, offline, provider errors, and invalid task values.
- Verify Plan My Day excludes Needs estimate tasks and never silently applies changes.
- Tighten empty states, validation copy, focus states, icon actions, and visual rhythm against `DESIGN.md`.

## Validation checklist

- `npm run build` passes.
- `npm run tauri -- dev` supports the complete capture-to-completion flow.
- The menu-bar icon toggles the popover, outside click dismisses it, and Open Full App launches the expanded shell.
- Tasks and non-sensitive settings survive closing and reopening the desktop app; API keys remain in Keychain.
- Title-only capture works, and invalid durations are rejected with actionable feedback.
- Log grouping is correct for Needs estimate, Unscheduled, Upcoming, Overdue, and Completed.
- Budget totals remain correct when planning, completing, returning to Log, deleting, and reopening tasks.
- Over-capacity tasks remain visible and offer Return to Log without silently changing dates.
- AI is optional, provider/model selection persists, and AI results require confirmation.
- No route change requires hand-editing `src/routeTree.gen.ts`.

## Decisions needed before implementation

The product decisions are now settled for implementation. Any new request should be evaluated against the MVP boundary in `docs/product-brief.md`; especially avoid adding calendar time blocks, energy/priority fields, AI chat, or backend integrations to the five-hour build.

# Slate AI actions brief

## Purpose

Slate has one AI action button in the persistent footer. The button changes behavior based on whether the task composer contains text:

- With non-empty input: **AI Assist**.
- With empty or whitespace-only input: **Plan My Day**.

## Implementation status

AI Assist and Plan My Day are implemented in the current vertical slices. Both use the native Keychain-backed provider boundary and packaged Node sidecar; Assist presents one editable proposal, while Plan My Day presents an additive, stale-safe review proposal. Final packaged/manual acceptance remains before calling Plan My Day broadly shipped.

The implementation details and acceptance checklist are in [Plan My Day sidecar vertical slice](plans/012-plan-my-day-sidecar-vertical-slice.md).

The regular Save button remains available for manual task capture. AI is an optional acceleration layer; manual capture and task management must continue to work without a configured key or network access.

## Shared footer behavior

The footer contains:

- A task input.
- A regular Save button for immediate manual capture.
- One AI button whose action is selected from the input state.
- Settings access.

The AI button should treat whitespace-only input as empty. Its label, tooltip, and accessible name should reflect the active action:

- Input present: `Use AI Assist`.
- Input empty: `Plan My Day`.

When the active provider has no saved key, the AI button is disabled and its tooltip directs the user to Settings. An `unavailable-key` response still opens the unavailable review state when a key is removed outside Slate after the last native snapshot. Neither state prevents regular Save from working.

Settings uses one footer Save action for provider, global model, planning preferences, and the selected provider's Keychain credential. A saved credential appears only as a fixed non-secret mask. OpenRouter and AI Gateway keys are stored independently; secrets never enter planner snapshots, SQLite, query-cache data, logs, or change events.

## AI Assist

### Purpose

AI Assist turns rough capture text into a cleaner, more actionable task without requiring the user to manually estimate or format it first.

### Input context

AI Assist receives:

- The text currently in the composer.
- The active Today commitments, when useful for local context.
- The current scheduled date, if one already exists.

### Suggested result

AI may suggest:

- A cleaned-up task title.
- An estimated duration in whole positive minutes.
- An optional scheduled date.

The AI must not overwrite an explicit date. When capture begins from Today, the task already has Today’s date, so AI Assist focuses on title cleanup and duration estimation. When capture begins from Log/backlog without a date, AI may infer a date from the capture only when it is clearly justified; otherwise it should leave the task unscheduled.

### Interaction

1. The user enters text into the footer.
2. The user presses the AI button.
3. The composer text is cleared from the visible input.
4. A review panel opens above the footer using the same interaction pattern as the existing task detail panel.
5. The panel shows the AI’s proposed title, estimate, and optional date.
6. The user chooses one of:
   - **Accept** — create the task using the reviewed values.
   - **Redo** — run AI Assist again for the same capture.
   - **Dismiss** — close the panel without creating a task.

The original capture should remain available in transient review state while the panel is open or a redo is in progress, even though the visible composer input has been cleared.

No task is written to SQLite before the user accepts the result.

## Plan My Day

### Purpose

Plan My Day proposes what existing Log tasks should be committed to Today based on available capacity and the user’s planning context.

### Trigger

The same footer AI button triggers Plan My Day when the composer is empty.

### Planning inputs

The planner receives:

- Existing uncompleted Today tasks as fixed planning context, not candidates for movement.
- Remaining capacity.
- Log tasks with valid positive estimates.
- Explicit dates and overdue state.
- Current Log ordering as a soft preference signal.
- The saved planning instruction.
- Task titles and estimates.

Tasks without valid estimates are excluded. Existing Today commitments are preserved and must not be removed or reordered.

### Suggested result

Plan My Day returns an additive list of task assignments for Today. Each proposed item includes:

- Task title.
- Estimate.
- Source Log section or date context when useful.
- The resulting Today date and native-derived position.

Existing Today tasks are not returned as assignments. They stay on Today with their current date and order. Selected Backlog tasks receive the current local Today date and Today scope only when the user accepts the plan.

The plan should fill remaining capacity where possible. It may leave capacity unused when no eligible task fits or when the planning instruction suggests restraint.

### Interaction

1. The user leaves the composer empty.
2. The user presses the AI button.
3. Plan My Day evaluates the current local planner state.
4. A larger review panel opens above the footer with the proposed task list.
5. The user chooses one of:
   - **Accept plan** — move all selected Backlog assignments to Today atomically, updating their dates and order together.
   - **Redo** — generate a new plan using the current state.
   - **Dismiss** — close the panel without changing tasks.

Running Plan My Day again after accepting, completing, deleting, or returning a task to Log should fill only newly available capacity. It must not silently remove or reorder existing commitments.

If there are no eligible tasks or no remaining capacity, the review panel should explain why there is nothing to add rather than producing an empty ambiguous state.

## Shared review tray

The review tray is the shared transient surface above the persistent footer for both AI actions. It follows the existing task detail panel’s positioning, focus, dismissal, and compact-window behavior.

### AI Assist variant

- Compact single-result layout.
- Editable title, estimate, and date fields.
- Accept, Redo, and Dismiss controls.
- No persistence before Accept.

### Plan My Day variant

- Taller scrollable layout for multiple proposed tasks.
- Clear indication of total proposed minutes and remaining capacity after the plan.
- Accept plan, Redo, and Dismiss controls.
- No task dates or ordering changes before Accept plan.

### Shared states

The tray must support:

- Loading.
- Reviewable result.
- AI unavailable or no configured key.
- Retryable provider/network error.
- Dismissal without mutation.

Only one AI review should be active at a time. Opening a new AI action should replace or explicitly dismiss the previous transient result.

## Safety and persistence rules

- AI suggestions are never committed automatically.
- AI Assist acceptance creates one task through the existing persistence boundary.
- Plan My Day acceptance applies all selected Backlog assignments in one atomic persistence operation; existing Today tasks remain unchanged.
- API keys remain in macOS Keychain and never appear in planner snapshots, SQLite, review state, or change events.
- Manual Save remains available regardless of AI configuration or network access.

## Out of scope

- AI chat history.
- Autonomous background planning.
- Automatic commits without review.
- Model discovery or pricing UI.
- Per-task AI conversations.
- Cloud sync or external task integrations.

## Open implementation choices

- The visible action names are recommended as **Accept**, **Redo**, and **Dismiss**. “Dismiss” is the product equivalent of “Decline.”
- The exact AI provider request/response schema and model prompts remain implementation details, provided the structured result contracts above are preserved.

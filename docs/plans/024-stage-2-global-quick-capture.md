# Plan 024: Stage 2 global quick capture

> **Executor instructions:** Implement this as a focused macOS capture slice. Preserve the existing menu-bar popover, local-first persistence, and deliberate Backlog-to-Today workflow. Do not add external context or AI behavior to this plan.

## Status

- **Priority:** P1 Stage 2 follow-up
- **Effort:** M
- **Risk:** MEDIUM — native shortcut registration, popover focus, and reversible task creation cross the Rust/renderer boundary
- **Category:** macOS native integration / capture / task lifecycle
- **Planned at:** 2026-07-27

## Objective

Let a user capture a thought from anywhere on macOS in one short interaction:

1. Press a configurable global shortcut.
2. Slate opens or focuses its compact capture surface.
3. Type a title and press Enter.
4. Slate creates an unestimated, unscheduled Backlog task immediately.
5. Show a short Undo action while the new task is still unchanged.

The feature must feel faster than opening Slate manually while preserving the same native task validation, Planner Event history, revision checks, and cross-window refresh behavior.

## Product decisions

- The recommended default shortcut is `CommandOrControl+Shift+Space`, displayed as `⌘⇧Space` on macOS.
- The existing popover and persistent footer are reused. The shortcut opens the popover and focuses the capture input; a second capture window is not introduced in 1.1.
- Global quick capture always creates a Backlog task with no estimate and no scheduled date.
- The accepted event source is `manual-quick-capture`.
- Undo uses a separate source, `manual-quick-capture-undo`, and is valid only while the created task is unchanged.
- A draft survives popover dismissal, focus changes, and reopening the capture surface. Explicit discard clears it. Crash/relaunch recovery is not required unless the chosen native draft store makes it trivial.
- No clipboard, selected text, application name, URL, file, AI cleanup, estimate, date, tags, or destination picker ships in this slice.
- Quick capture does not commit work to Today. The task remains in Backlog until the user deliberately estimates and schedules it.

## Existing boundaries to preserve

- Native behavior, shortcut registration, task persistence, and privileged window operations remain in `src-tauri/`.
- SQLite remains the source of truth. Renderer state is only a draft, focus state, or transient Undo affordance.
- Accepted task creation and Undo write Planner Events in the same SQLite transaction as their task mutation.
- API keys, prompts, model output, and unrelated planner snapshots are never included in drafts, events, shortcut state, or logs.
- `planner://changed` remains a refresh notification, not a concurrency guard.
- The compact popover remains usable at the configured 360 × 520 minimum.

## Data and native API changes

### Shortcut settings

Extend the persisted Settings contract with:

```text
quick_capture_enabled: boolean
quick_capture_shortcut: string
```

Use the native accelerator representation for storage, with the renderer displaying a macOS-friendly label. Seed existing databases with:

```text
quick_capture_enabled = true
quick_capture_shortcut = "CommandOrControl+Shift+Space"
```

Validate shortcuts before saving. Reject empty shortcuts, modifier-only combinations, unsupported keys, and malformed accelerator strings with a stable user-facing error. Preserve the previous registered shortcut if a new shortcut cannot be registered.

### Shortcut registration

Add a Tauri-compatible global shortcut dependency or native registration seam after confirming the project’s Tauri 2 compatibility. Keep registration in a small native controller module, not in persistence or React components.

The native controller should own:

- Registering the persisted shortcut during app setup.
- Unregistering and re-registering when Settings changes.
- Disabling registration when quick capture is disabled.
- Opening/focusing the existing popover and emitting a typed `quick-capture://opened` event.
- Reporting registration conflicts without crashing or silently changing the stored preference.

The shortcut handler must not create a task directly. It only opens the capture surface and focuses the input.

### Quick capture task result

Change the successful native create response from `void` to a minimal safe result:

```text
CreatedTask {
  id: string
  revision: number
}
```

The result is needed only for the Undo boundary. Existing manual and AI Assist callers may ignore it.

Extend task creation source validation with `manual-quick-capture`. The accepted task payload remains title-only:

```text
estimate_minutes = NULL
scheduled_date = NULL
completed_at = NULL
```

### Undo contract

Add an explicit native Undo operation rather than making the renderer issue an unrestricted delete.

Input:

```text
UndoQuickCaptureInput {
  id: string
  expected_revision: number
}
```

Native validation must confirm:

- The task exists at the expected revision.
- The task is incomplete, unscheduled, and unestimated.
- The task has a matching `task-created` event with source `manual-quick-capture`.
- The task has not been edited, reordered, scheduled, completed, or otherwise changed.

If valid, delete the task and its task-order rows in the same transaction, then write a `task-deleted` event with source `manual-quick-capture-undo`. The event must retain the task’s before-state so deleted-task history remains queryable.

If stale or ineligible, return a stable `stale-quick-capture` or `quick-capture-not-undoable` error and make no write.

## Draft contract

Use one explicit quick-capture draft boundary rather than relying on incidental component lifetime.

Recommended shape:

```text
QuickCaptureDraft {
  title: string
  updated_at: string
}
```

The simplest acceptable implementation is a native in-memory draft state scoped to the app process, exposed through small `get`, `set`, and `clear` commands. If preserving a draft across relaunch is low-cost within the existing SQLite migration, use a singleton local draft record; do not add it to Planner Events or expose it in planner snapshots.

Draft rules:

- Restore the draft when the global shortcut opens the capture surface.
- Debounce updates so every keystroke does not create a database write.
- Preserve text when focus loss hides the popover or the user switches applications.
- Clear only after successful task creation or explicit discard.
- Clear the draft after Undo as well.
- Never create an empty task.

## Renderer and interaction changes

### Settings

Update `src/routes/settings.tsx` with a compact **Quick capture** group:

- Enable/disable switch.
- Shortcut recorder showing the current shortcut.
- Reset to recommended shortcut.
- Registration-conflict or invalid-shortcut error state.
- Save through the existing unified Settings draft.

The recorder must be keyboard-operable, show a visible focus state, ignore modifier-only key presses, and provide a clear Escape/cancel path that leaves the saved shortcut unchanged.

Update `src/lib/settings-draft.ts` and its tests so the new fields participate in cloning, equality, reset, and save payload construction. Settings saves should identify `source: "settings"` as they do today.

### Popover capture mode

Add a small quick-capture mode seam to the existing footer/root shell:

- Listen for `quick-capture://opened` in the renderer.
- Clear task selection and transient AI review state before focusing capture.
- Restore the saved draft into the title input.
- Focus the input after the popover becomes visible.
- Keep the surface visually quiet and compact; do not introduce a second navigation or dashboard state.
- Escape hides the popover while preserving the draft.
- Provide an explicit Clear/Discard affordance only when a draft exists.

The ordinary footer path remains unchanged: it creates a normal manual task using the current route’s scheduling context. The global shortcut path explicitly sends `manual-quick-capture` with no date.

### Confirmation and Undo

After successful quick capture:

- Clear the draft.
- Close or leave the compact capture surface according to the existing popover behavior.
- Show a short confirmation toast with an Undo action.
- Keep the Undo action available for a bounded period, recommended five seconds.
- Use the returned task ID and revision for the Undo request.
- On Undo success, invalidate planner state and confirm removal.
- On stale failure, refresh planner state and explain that the task changed and cannot be undone.

The Undo affordance must not delete a task after the user has interacted with it elsewhere.

## Implementation sequence

### 1. Add the persisted shortcut contract

Files: `src-tauri/src/persistence.rs`, `src/lib/planner.ts`, `src/lib/settings-draft.ts`, migration tests, settings draft tests

- Add migration fields with the recommended defaults.
- Extend Settings serialization and save inputs.
- Validate accelerator strings natively.
- Preserve existing Settings behavior and onboarding’s global capacity path.

### 2. Add native shortcut lifecycle

Files: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/src/window_controller.rs`, a focused shortcut module if needed

- Add and initialize the global shortcut integration.
- Register the persisted shortcut during setup.
- Rebind after a successful Settings save, with rollback on registration failure.
- Open/focus the existing popover and emit `quick-capture://opened`.
- Keep registration errors explicit and recoverable.

### 3. Add quick-capture draft and task commands

Files: `src-tauri/src/persistence.rs`, `src-tauri/src/lib.rs`, `src/lib/planner.ts`, `src/lib/planner-query.tsx`

- Add draft get/set/clear behavior.
- Add the quick-capture source to task creation validation.
- Return the created task ID and revision.
- Add the atomic Undo command and event source.
- Preserve `planner://changed` after accepted task creation and Undo.

### 4. Wire the popover/footer interaction

Files: `src/routes/__root.tsx`, `src/components/task-composer-footer.tsx`, `src/lib/task-composer.ts`, focused interaction helpers

- Subscribe to the native quick-capture event.
- Restore and persist the draft.
- Focus the existing composer without duplicating the task creation UI.
- Distinguish normal manual capture from global quick capture at submission.
- Add the confirmation/Undo flow and stale-safe refresh behavior.

### 5. Build Settings UI

Files: `src/routes/settings.tsx`, `src/components/ui/*` only if an existing primitive is insufficient

- Add the enable toggle and shortcut recorder.
- Keep the group usable at 360 × 520.
- Use the existing design tokens, compact controls, visible focus, semantic labels, and reduced-motion behavior.
- Keep shortcut registration errors adjacent to the control that caused them.

### 6. Update documentation and release notes

Files: `docs/roadmap.md`, `docs/product-brief.md`, `docs/daily-resilience.md`, a new release note if the project convention calls for it

- Mark global quick capture as the 1.1 implementation slice.
- Document title-only Backlog capture, source attribution, draft behavior, and revision-safe Undo.
- State that clipboard, selected-text, AI enrichment, and app-context capture remain deferred.

## Test and acceptance plan

### Native tests

- Existing databases receive the default shortcut settings exactly once.
- Invalid and conflicting shortcut inputs are rejected without changing persisted Settings.
- Quick capture task creation returns an ID/revision and writes `task-created` with source `manual-quick-capture`.
- Created quick-capture tasks have no estimate and no scheduled date.
- Undo succeeds for an unchanged quick-capture task and writes a deletion event with the undo source.
- Undo rejects stale, edited, scheduled, completed, reordered, and non-quick-capture tasks without writing.
- Deleted-task history remains queryable after Undo.
- Draft get/set/clear behavior preserves text without creating Planner Events.

### Renderer tests

- Settings draft equality includes enabled state and shortcut value.
- Shortcut display/normalization handles macOS modifiers and cancel/reset behavior.
- Quick capture submission always sends `scheduledDate: null` and `source: "manual-quick-capture"`.
- Successful creation clears the draft and exposes Undo data.
- Failed or stale Undo refreshes state and leaves changed tasks intact.

### Manual macOS verification

| Scenario | Expected result |
| --- | --- |
| Press the default shortcut over another app | Slate’s popover opens, focuses the capture input, and restores any draft. |
| Type a title and press Enter | One unscheduled, unestimated Backlog task is created. |
| Press Escape before submitting | The surface hides and the draft remains available next time. |
| Explicitly discard a draft | The draft is cleared and no task or event is created. |
| Use Undo immediately | The created task disappears and its accepted creation/deletion history remains. |
| Edit or schedule, then use Undo | Undo is rejected as stale; the task remains unchanged. |
| Disable quick capture | The shortcut is unregistered and no capture surface opens. |
| Change the shortcut | The old shortcut stops working and the new one works after save. |
| Register a conflicting shortcut | Settings remains on the previous working shortcut and explains the conflict. |
| Open full app and popover together | Both surfaces refresh from the same SQLite state. |
| Use light/dark themes and keyboard navigation | The recorder, input, discard, and Undo controls retain focus visibility and readable contrast. |

## Non-goals and deferred work

- Clipboard or selected-text capture.
- Automatic title cleanup, estimates, dates, AI Assist, or Plan My Day integration.
- Capturing the active application, URL, file, or window context.
- Notifications, launch-at-login, shortcut suggestions, or multiple shortcut profiles.
- A separate capture window or custom AppKit capture panel.
- History UI or an event query command.
- Cloud sync or cross-device shortcut synchronization.

## Completion criteria

- A configurable macOS shortcut opens the existing compact capture surface from another application.
- Title-only capture creates a normal Backlog task with explicit quick-capture source attribution.
- Draft text survives focus loss/popover dismissal and can be explicitly discarded.
- Undo is bounded, revision-safe, atomic, and visible in Planner Events.
- Existing manual capture, AI Assist, settings, and Today/Backlog workflows remain unchanged.
- `cargo test --manifest-path src-tauri/Cargo.toml`, `npm run build`, and renderer helper tests pass.
- Manual macOS verification covers shortcut registration, focus, conflict handling, draft restoration, and Undo.

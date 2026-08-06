# Plan 025: Stage 2 dedicated quick-capture window

> **Executor instructions:** Replace the global shortcut’s reuse of the planner popover with a purpose-built transient capture window. Reuse Plan 024’s task, draft, Undo, settings, event, and persistence contracts. Keep the menu-bar popover and full planner window unchanged for ordinary planning.

## Status

- **Status:** Implemented on 2026-07-28.
- **Priority:** P1 follow-up to Plan 024
- **Effort:** M
- **Risk:** MEDIUM — a third Tauri webview, macOS panel focus, window dismissal, and shared renderer/native state must remain deterministic
- **Category:** macOS native integration / dedicated capture UI
- **Planned at:** 2026-07-27
- **Depends on:** [Plan 024 — Stage 2 global quick capture](024-stage-2-global-quick-capture.md)

## Objective

Give global quick capture a focused UI designed specifically for one action:

1. Press the configured global shortcut from any macOS application.
2. Slate opens a small dedicated capture window above the current application.
3. The existing quick-capture draft is restored and the title field receives focus.
4. Press Enter to create an unestimated, unscheduled Backlog task.
5. Show a compact success state with revision-safe Undo, then dismiss the window.

The dedicated surface should feel like a fast command panel, not a miniature Today/Backlog workspace. It must not make the compact planner popover behave like a shortcut-only dashboard or create a second task model.

## Product decisions

- Add a third native surface with the stable label `quick-capture`.
- The global shortcut opens `quick-capture`, not the existing `popover` window.
- The menu-bar tray continues to open and close `popover`; its footer remains ordinary manual capture.
- The dedicated window contains one title field, submit action, discard action, and transient success/Undo state. It has no Today/Backlog navigation, AI action, task list, settings link, or destination picker.
- The recommended shortcut remains `CommandOrControl+Shift+Space`, displayed as `⌘⇧Space` on macOS.
- Existing Plan 024 task creation remains title-only with source `manual-quick-capture`, `scheduledDate: null`, and `estimateMinutes: null`.
- The draft remains native in-memory state. It survives focus loss and dismissal, but not crash/relaunch.
- Escape dismisses the transient window while preserving a non-empty draft. Explicit Discard clears the draft and hides the window.
- After successful creation, show an inline confirmation and Undo action for five seconds. The window may hide automatically after that period or immediately on focus loss; Undo must never become an unrestricted delete.
- A new shortcut invocation while an Undo confirmation is visible starts a fresh capture and replaces only the transient confirmation UI. The prior task remains intact and can no longer be acted on from that confirmation.

## Existing contracts to preserve

- SQLite remains the source of truth for tasks, revisions, ordering, and Planner Events.
- `CreatedTask { id, revision }` remains the only data required by Undo.
- Undo continues to use `UndoQuickCaptureInput { id, expectedRevision }` and the native `stale-quick-capture` / `quick-capture-not-undoable` errors.
- Accepted creation and Undo write their Planner Events in the same SQLite transaction as the task mutation.
- `planner://changed` remains a refresh notification, not a concurrency guard.
- Draft get/set/clear commands do not create Planner Events and drafts contain title text plus `updatedAt` only.
- API keys, prompts, model output, planner snapshots unrelated to the capture, and active-app context never enter the dedicated surface state or capture events.
- The existing `popover` remains usable at 360 × 520 and the normal footer continues to create `manual` tasks using the current route scheduling context.
- No generated router output is hand-edited. The dedicated surface is a window-mode branch in the shared root shell unless a route is proven necessary.

## Native window contract

### Window configuration

The implemented hidden `quick-capture` webview window in `src-tauri/tauri.conf.json` uses this compact launcher geometry:

- Initial size 520 × 100.
- Minimum size 360 × 100.
- Undecorated, non-resizable, transparent, shadowed, and skipped from the taskbar.
- Initially hidden and created once during app setup.
- No normal title-bar or application navigation chrome.

The dimensions match the final two-line command-bar UI. The window does not inherit the planner popover’s 360 × 520 minimum simply because both are compact surfaces.

### macOS panel behavior

Extend the native window controller with a dedicated panel type or a clearly separated configuration path for `quick-capture`:

- Floating above normal applications.
- Able to become the key window so the text field can receive typing.
- Available across Spaces and full-screen apps using the same narrowly scoped panel behavior already used by the popover.
- Hidden on focus loss and on close request rather than destroyed.
- Reused across shortcut invocations; never create a new webview per capture.

The native controller should own:

- Creating and configuring the window during setup.
- Showing, focusing, and hiding the dedicated capture window.
- Positioning it on the active display. Prefer the current mouse/tray display when available; otherwise use the primary display’s usable bounds. Keep the whole panel inside the visible work area.
- Emitting a window-targeted `quick-capture://opened` event after the panel is visible and focusable.

Do not broadcast the opened event to the full app or planner popover. A dedicated capture invocation must not put both existing planner windows into quick-capture mode.

### Shortcut lifecycle

Keep registration in `src-tauri/src/shortcut_controller.rs`:

- The handler opens/focuses `quick-capture` only; it does not create tasks.
- Enabling/disabling and rebinding continue to use the persisted Settings values.
- Registration conflicts preserve the previous working registration and persisted preference.
- Native errors remain stable and user-facing through the existing Settings error path.
- If the dedicated window is already visible, a second shortcut focuses it and restores the current native draft without creating a duplicate window.

## Renderer architecture

### Window mode

Extend `src/lib/window-mode.ts` from `full | popover` to a typed mode that also represents `quick-capture`.

Use a small root-shell split so the dedicated surface does not render planner navigation or the persistent footer:

- `SlateShell` continues to own the full planner and menu-bar popover modes.
- `QuickCaptureWindow` owns the dedicated field, draft lifecycle, creation, confirmation, Undo, and dismissal behavior.
- Both remain under the existing query, theme, tooltip, and reduced-motion providers.
- Avoid loading task-list UI, AI review UI, or planner routes into the dedicated surface.

The dedicated surface may still use the planner query boundary for theme and mutation invalidation, but it must not treat renderer state as authoritative task data.

### Dedicated UI

Add a focused component such as `src/components/quick-capture-window.tsx` using the existing UI primitives and tokens:

- One clearly labelled title input with an intentionally short placeholder such as “Capture a thought”, paired with a separate 40px Add action in the primary row.
- Enter submits when the trimmed title is non-empty.
- A compact submit affordance that reflects pending state without moving the layout.
- An explicit Discard action only when a draft exists.
- A quiet 20px secondary line indicating “Backlog · no estimate or date” without adding dashboard language.
- A confirmation state such as “Added to Backlog” with an Undo button and five-second bounded availability.
- Pending creation reuses the secondary line for concise “Adding to Backlog…” feedback.
- No AI sparkle action, route navigation, settings button, task details, date picker, estimate control, tags, or clipboard affordance.

Use Slate’s existing warm-neutral surfaces, muted teal commitment signal, sans-serif operational text, visible focus ring, compact radii, and flat/transient elevation rules. The panel should read as a calm utility launcher rather than a card inside the planner. Respect `MotionConfig reducedMotion="user"`; keep any entrance/exit motion short and non-essential.

### Draft and focus behavior

- On `quick-capture://opened`, call `getQuickCaptureDraft`, set the title, clear any previous transient confirmation, and focus after the window is visible.
- Debounce `setQuickCaptureDraft` updates so typing does not issue a native command for every keystroke.
- Preserve draft text when the native window hides because focus moved to another application.
- On Escape, hide the native capture window without clearing the draft.
- On Discard, cancel any pending draft write, call `clearQuickCaptureDraft`, clear the local title, and hide the window.
- On successful creation, clear the native draft before showing the confirmation state.
- On Undo success, invalidate planner state, clear the confirmation, and hide or reset the window.
- On stale Undo failure, refresh planner state, keep the task intact, and explain that the task changed and can no longer be undone.

## Existing renderer cleanup

Move the global quick-capture interaction out of `src/components/task-composer-footer.tsx`:

- Remove the footer’s listener for the global `quick-capture://opened` event.
- Remove the footer-only quick-capture mode, draft persistence, dedicated discard action, and quick-capture source branching.
- Keep ordinary footer creation exactly as `source: "manual"` with its existing scheduling context.
- Retain shared planner and Undo command helpers used by the dedicated component.

This prevents the same global shortcut from creating two capture states across the popover and dedicated window.

## Implementation sequence

### 1. Add the dedicated native window

Files: `src-tauri/tauri.conf.json`, `src-tauri/src/window_controller.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/main.rs` only if setup wiring requires it

- Add the `quick-capture` window configuration.
- Add its macOS panel configuration and lifecycle handlers.
- Keep existing `main` and `popover` behavior unchanged.
- Add focused native helpers such as `open_quick_capture`, `hide_quick_capture`, and `quick_capture_window` without exposing arbitrary window labels to React.

### 2. Redirect the shortcut

Files: `src-tauri/src/shortcut_controller.rs`, `src-tauri/src/window_controller.rs`

- Change the shortcut handler target from the planner popover to `quick-capture`.
- Target the opened event to the dedicated webview only.
- Reuse existing registration rollback, disabled-state, and conflict behavior.
- Add positioning logic that works from the current/primary display and does not place the window off-screen.

### 3. Add typed renderer window mode and dedicated component

Files: `src/lib/window-mode.ts`, `src/routes/__root.tsx`, new `src/components/quick-capture-window.tsx`, `src/lib/quick-capture.ts`

- Detect the `quick-capture` label.
- Render the dedicated surface through a root-level mode split.
- Reuse typed planner commands and shortcut/draft helpers.
- Keep focus, Escape, submit, Discard, confirmation, Undo, and stale refresh behavior explicit.

### 4. Remove global capture behavior from the footer

Files: `src/components/task-composer-footer.tsx`, focused interaction helpers

- Restore the footer to the ordinary manual capture path.
- Confirm AI Assist, Plan My Day, Today scheduling context, selection dismissal, and settings access remain unchanged.
- Do not duplicate quick-capture UI in the popover.

### 5. Validate visual and accessibility behavior

Files: `src/styles.css` or existing UI primitives only if required

- Verify the dedicated window at its minimum size in light and dark themes.
- Verify the 520 × 100 default and 360 × 100 minimum geometry in light and dark themes.
- Verify keyboard-only flow, visible focus, labelled input, Escape dismissal, Discard, Enter submission, pending state, and Undo.
- Keep motion reduced and avoid adding a decorative animation system.
- Confirm the main planner popover remains usable at 360 × 520 after the footer cleanup.

### 6. Update product documentation

Files: `docs/roadmap.md`, `docs/product-brief.md`, `docs/daily-resilience.md`, `docs/plans/024-stage-2-global-quick-capture.md`, release notes if appropriate

- Mark Plan 024’s “no second capture window” decision as superseded for the dedicated-window follow-up while preserving its data contracts.
- Document that the shortcut opens the dedicated capture window and tray clicks still open the planner popover.
- Record the dedicated surface’s non-goals and the unchanged title-only Backlog behavior.

## Test and acceptance plan

### Native tests

- The `quick-capture` window is configured once and reused across repeated shortcut invocations.
- Shortcut invocation targets only the dedicated capture window and does not emit the opened event to `main` or `popover`.
- Focus loss and close requests hide the dedicated window without clearing the native draft.
- Positioning keeps the window inside the usable bounds of the target display.
- Existing shortcut enable/disable, rebind, conflict, and rollback tests remain valid.

### Renderer tests

- `quick-capture` is detected as a distinct window mode.
- Draft restoration and debounced updates work without Planner Events.
- Empty and whitespace-only titles cannot submit.
- Submission always uses `manual-quick-capture`, `scheduledDate: null`, and `estimateMinutes: null`.
- Successful creation clears draft state and shows bounded Undo data.
- Undo uses the returned ID/revision and handles stale failure without deleting or changing the task.
- Footer submission remains `manual` and preserves Today scheduling behavior.
- Escape preserves draft; Discard clears it.

### Manual macOS verification

| Scenario | Expected result |
| --- | --- |
| Press the global shortcut over another app | The dedicated capture window appears, stays above the active app, and focuses its title field. |
| Press the shortcut while capture is already open | The same window is focused; no second window appears and the draft remains. |
| Type a title and press Enter | The dedicated confirmation reports Backlog; the task has no estimate or date. |
| Click elsewhere or press Escape | The capture window hides and the draft remains for the next shortcut. |
| Press Discard | The draft clears and the next invocation starts empty. |
| Use Undo | The unchanged task is removed and its deletion event is recorded. |
| Edit or schedule before Undo | Undo reports stale and leaves the task intact. |
| Click the menu-bar icon | The existing planner popover opens normally; it does not show the dedicated capture UI. |
| Open the full app while capture is hidden or visible | The full planner remains a separate normal window and shares refreshed task state. |
| Switch light/dark themes and enable Reduced Motion | The dedicated panel retains readable contrast, visible focus, and restrained/no spatial motion. |
| Use a secondary display or full-screen app | The capture window appears fully within the active display and accepts typing. |

## Non-goals

- Clipboard, selected text, active application, URL, file, AI, estimate, date, tag, project, or destination capture.
- A custom AppKit `NSPanel` implementation beyond the existing Tauri-compatible panel seam.
- A second task repository, event source, draft store, or Undo contract.
- Planner navigation, task list, Today capacity, Backlog browsing, or Settings inside the dedicated window.
- Notifications, launch-at-login, multiple capture profiles, crash/relaunch draft recovery, cloud sync, or mobile behavior.
- Changes to the global shortcut’s default value or Settings persistence contract.

## Completion criteria

- The global shortcut opens a dedicated, reusable capture window rather than the planner popover.
- The dedicated surface is one focused title-to-Backlog interaction with draft preservation and revision-safe Undo.
- The dedicated surface remains a compact two-line command bar at 520 × 100 and 360 × 100.
- Tray, full-app, manual footer capture, AI review, Settings, SQLite events, and cross-window planner refresh remain unchanged in behavior.
- The dedicated window is keyboard-operable, accessible, theme-aware, reduced-motion-safe, and usable at its minimum size.
- `cargo test --manifest-path src-tauri/Cargo.toml`, `npm run build`, and renderer helper tests pass.
- Manual macOS verification covers panel focus, dismissal, positioning, duplicate prevention, draft restoration, Undo, and separation from the planner popover.

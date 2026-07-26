# Plan 022: Implement first-run onboarding

> **Executor instructions:** Implement in the sequence below. Keep the normal Today/Backlog workflow usable at every step. Run the verification commands and manual acceptance checks before considering the work complete.

## Status

- **Priority:** P1 after the 1.0 empty-state usability check
- **Effort:** S–M
- **Risk:** LOW–MEDIUM
- **Depends on:** [Plan 021: Slate first-run onboarding brief](021-onboarding-brief.md)
- **Category:** Product / first-run UX

## Objective

Add an optional, compact first-run flow that guides a new user through one real planning loop:

1. Confirm a realistic daily capacity.
2. Capture one real task in Backlog.
3. Give it a rough estimate and schedule it for Today.
4. Show the real remaining-capacity result in the normal Today workspace.

The flow must teach Slate’s Backlog-versus-Today model through real actions. It must not become a feature tour, a fake tutorial mode, a required AI setup, or a new route.

## Product and design constraints

- The menu-bar popover remains the primary surface and must work at the configured 360 × 520 minimum size.
- Today contains deliberate commitments; Backlog contains captured but uncommitted work.
- Manual planning must work without AI, an account, a network connection, or a provider key.
- The task created during onboarding must be a normal persisted task with normal edit, schedule, complete, delete, and return-to-Backlog behavior.
- Use the existing shell, `Button`, `Input`, `Empty`, task-detail, focus, toast, and motion patterns.
- Use semantic tokens from `src/styles.css`; no decorative illustration, gradient, broad shadow, or second component vocabulary.
- Do not dim or lock the entire interface. The user may skip onboarding and continue using the product immediately.
- Do not hand-edit `src/routeTree.gen.ts`.
- Keep API keys and AI availability out of onboarding state; the existing Keychain boundary remains unchanged.
- Persist onboarding state through SQLite settings, not renderer-only `localStorage`, so SQLite remains the local source of truth.

## Current state and relevant seams

- `src/routes/__root.tsx` owns the shared shell, route outlet, footer placement, route transitions, and popover Escape behavior.
- `src/components/task-composer-footer.tsx` owns the persistent composer and renders the selected task detail panel above the footer.
- The composer accepts a `scheduledDate` prop. Today passes the current date; Backlog passes `null`.
- `src/components/task-detail-panel.tsx` already edits title, estimate, and scheduled date through the normal `update_task` command. An unscheduled task exposes **Set date** and the calendar can choose Today.
- `src/lib/planner.ts` defines the renderer snapshot and settings contract.
- `src/lib/planner-query.tsx` already provides `usePlannerState` and `useSaveSettings`, including query-cache update on a successful settings save.
- `src/lib/settings-draft.ts` and `src/lib/settings-draft.test.mjs` assume `Settings` is a complete serializable object and must preserve any new field through the settings screen.
- `src-tauri/src/persistence.rs` has a single-row `settings` table, migration version 1, settings validation, snapshot serialization, and the existing atomic `save_settings` command.
- `src/components/planner-empty-state.tsx`, `src/routes/today.tsx`, and `src/routes/backlog.tsx` own the current first-use empty states.

## Desired behavior

### Eligibility and lifecycle

Add a persisted `onboardingStatus` with three values:

- `not-started`
- `completed`
- `skipped`

On a fresh local database, offer onboarding only when:

- `onboardingStatus === "not-started"`;
- the initial planner snapshot has no tasks;
- persistence has loaded successfully; and
- the user is not on Settings or the persistence-recovery surface.

Once the flow is active, keep it mounted for the current app session even after the user creates the onboarding task. Otherwise the task-count eligibility check would remove the flow halfway through.

On a later app launch, do not offer onboarding if any task already exists, even if the user closed the app halfway through. Do not interrupt an existing planner with first-run UI.

### Flow states

Use a small explicit state machine in a dedicated component. Do not spread step logic across routes.

| State | User action | Transition |
| --- | --- | --- |
| `welcome` | Start planning | `capacity` |
| `welcome` | I’ll explore on my own | Persist `skipped`, dismiss |
| `capacity` | Confirm default or edited minutes | Persist capacity, then `capture` |
| `capture` | Navigate to Backlog and add a real task | Detect the newly created task, select it, then `commit` |
| `commit` | Set estimate, choose Today, save | When snapshot shows positive estimate + today date, `complete` |
| `complete` | Continue normally or dismiss | Persist `completed`, dismiss |

The user may skip from every active state. The skip action should be visible but quiet. Do not treat closing the popover as a completed flow.

### Flow placement

Mount `OnboardingFlow` from `src/routes/__root.tsx` inside the non-Settings shell, above the route outlet or as a bounded overlay in the workspace. Keep it visually attached to the workspace rather than creating a new route or full-screen modal.

The panel should:

- remain above the workspace content but below the persistent footer/task detail layer when possible;
- avoid covering the composer or selected-task controls;
- remain readable at 360 × 520;
- use a single heading, short explanation, one primary action, and a quiet skip action;
- expose an `aria-live="polite"` status for step changes;
- move focus to the first meaningful control when a step changes, without trapping focus in the entire app.

If compact-window testing shows that a top workspace panel competes with the empty state, use the existing footer-adjacent review-tray geometry. Do not introduce a new modal system.

## Implementation steps

### 1. Add the native onboarding preference

Update `src-tauri/src/persistence.rs`:

- Add migration 2 after the existing migration 1:
  - `ALTER TABLE settings ADD COLUMN onboarding_status TEXT NOT NULL DEFAULT 'not-started'`;
  - constrain accepted values in application validation to `not-started`, `completed`, and `skipped`.
- Update `apply_migrations` to apply migrations sequentially and preserve existing v1 databases.
- Add `onboarding_status` to the native `Settings` snapshot struct.
- Read it from the settings row in `Repository::settings`.
- Add it to `UpdateSettingsInput` and the `UPDATE settings` statement used by `save_settings`.
- Validate the value and return an actionable error for invalid input.
- Keep the field non-secret and outside all AI context structs.

Add native tests for:

- a fresh database defaulting to `not-started`;
- a v1 database migrating without losing capacity, theme, AI provider/model, or planning instruction;
- completed and skipped values persisting after reopen;
- invalid onboarding values being rejected before the settings write.

Do not add a new Tauri command. Reuse the existing `save_settings` command so the native boundary stays small and the existing `planner://changed` invalidation behavior remains authoritative.

### 2. Extend the renderer settings contract

Update `src/lib/planner.ts`:

- Add `OnboardingStatus` as a string union.
- Add `onboardingStatus` to `Settings`.
- Keep `SaveSettingsInput` unchanged structurally by passing the complete settings object through the existing command.

Update `src/lib/settings-draft.ts`:

- Preserve `onboardingStatus` when creating and saving settings drafts.
- Include it in settings equality so a successful native snapshot resets the draft cleanly.
- Do not render it as an editable Settings control.

Update `src/lib/settings-draft.test.mjs` fixtures and assertions so existing settings-save behavior proves that the onboarding field is preserved and never affects API-key handling.

### 3. Add a focused onboarding settings mutation helper

Prefer a small helper in `src/lib/planner-query.tsx` or `src/lib/onboarding.ts` that builds a complete `SaveSettingsInput` from the current snapshot:

- copy all existing settings values;
- override only `dailyCapacityMinutes` and/or `onboardingStatus`;
- always use `{ kind: "unchanged" }` for `apiKeyChange`.

Use the existing `useSaveSettings` cache-update behavior. Do not duplicate native invocation, invalidate queries manually in multiple places, or create a second persistence path.

On save failure:

- keep the onboarding state active;
- do not advance the step;
- show the existing toast error pattern;
- never claim that capacity or onboarding status was saved.

### 4. Implement the `OnboardingFlow` component

Create `src/components/onboarding-flow.tsx` with small explicit subcomponents only if each has a clear state boundary. Keep the state machine and transitions in the parent component.

Inputs needed from the shell:

- current `PlannerSnapshot`;
- current pathname;
- current `WindowMode`;
- a route-transition setter or callback if navigation to Backlog/Today needs the existing motion behavior.

Use existing hooks and utilities:

- `usePlannerState` or the snapshot passed by the shell;
- `useSaveSettings` or the focused helper from step 3;
- `useNavigate`;
- `focusTaskComposer`;
- `useTaskSelection` to select the new task and expose its existing detail panel.

State details:

- On initial mount, compute eligibility from the initial empty snapshot and initialize `active` once. Do not derive visibility directly from the current task count after the flow has started.
- Record the initial task count before entering `capture`. When a new task appears, choose the newest task created after that count and store its ID. Avoid selecting an arbitrary task if the planner somehow changed concurrently.
- In `capture`, navigate to `/backlog` using the existing route-transition pattern, then focus the composer after navigation settles.
- When the new task is detected, select it and move to `commit`. The normal task detail panel should remain the editing surface.
- In `commit`, observe the selected task from the planner snapshot. Completion requires `estimateMinutes > 0` and `scheduledDate === planner.today`.
- After the task reaches Today, navigate to `/today`, show the actual header capacity result, then persist `completed` and dismiss the panel.
- If the user deletes the onboarding task, return to `capture` and refocus the composer rather than leaving the flow in a dead state.
- If the user edits the task to a future date or returns it to Backlog, remain in `commit` and explain the expected first success without overriding the user’s choice.

Suggested copy should follow Plan 021 and remain concise:

- Welcome: “Make today realistic.”
- Capacity: “How much focused work fits in a day?”
- Capture: “Capture something you actually need to do.”
- Commit: “Give it a time cost, then decide whether it deserves space in Today.”
- Completion: “You’ve made your first plan.”

Do not add an onboarding-specific animation. Use a short opacity/translate transition only if it matches existing route/task motion and provide the existing reduced-motion behavior.

### 5. Integrate the flow into the shared shell

Update `src/routes/__root.tsx`:

- Render `OnboardingFlow` only in the normal Today/Backlog shell, not on Settings.
- Keep the footer available during `welcome`, `capacity`, and `capture` unless the user explicitly navigates through the flow.
- Ensure shell-level pointer and Escape handling does not dismiss or corrupt the onboarding state.
- Preserve the existing behavior where clicking outside a task detail clears task selection. The onboarding panel must not count as an outside click when it is intentionally interacting with the flow.
- Keep the existing `Outlet` and generated route tree unchanged.

If the onboarding panel needs a local stacking boundary, use the existing semantic layers and a modest z-index. Do not add arbitrary `z-index: 9999` values.

### 6. Improve the normal empty states

Update `src/routes/today.tsx` and `src/routes/backlog.tsx` copy without adding route-specific onboarding logic:

- Today should explain that it contains commitments and that Backlog work can be chosen when ready.
- Backlog should explain that captured work waits there before it is given space in Today.
- Preserve the current action behavior and existing empty-state motion.

Use `src/components/planner-empty-state.tsx` as the shared presentation boundary. Do not create separate first-use and cleared-state components unless a real behavioral difference is discovered during testing.

The task detail already exposes **Set time** and **Set date** labels. First test whether the onboarding copy makes the existing date control understandable. Add an explicit **Commit to Today** affordance only if usability testing shows that users cannot find the existing date interaction; if added, keep it as a normal task-detail action backed by the existing `update_task` mutation, not an onboarding-only shortcut.

### 7. Keep AI discovery out of the first slice

Do not add AI setup to onboarding. The existing composer tooltip and unavailable-state copy are sufficient for this release.

Only add a one-time AI contextual hint if usability testing shows that users miss the optional review action after completing the manual loop. That follow-up would need its own persisted hint state and should not expand the first-run migration casually.

## Error and edge-case behavior

- Persistence error before onboarding loads: show the existing persistence recovery surface; do not render onboarding.
- Capacity save failure: remain on the capacity step with the user’s draft value intact.
- Task creation failure: remain on capture and use the existing composer error toast.
- Task update failure: remain on commit and use the existing task-detail error toast.
- User closes the popover midway: do not mark completed; on a later launch with existing tasks, do not interrupt them with onboarding.
- User changes theme or opens Settings during the flow: preserve the local component state for the current session when possible; returning to the workspace should not restart the flow.
- Cross-window task creation: only select a new task that was created after the recorded onboarding baseline and is still present in the current snapshot.
- Unsized tasks never count toward Today capacity. Completion detection must require a positive estimate.
- A scheduled task is not considered committed until its scheduled date equals the current local `today` value.

## Verification

Run the real repository checks:

```bash
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
node --test src/lib/settings-draft.test.mjs
```

Manual acceptance checks:

1. Fresh database, light theme, no tasks: welcome appears once on Today.
2. **I’ll explore on my own** dismisses onboarding and persists `skipped`.
3. Starting onboarding allows the default 240-minute capacity to be accepted and allows a positive custom value.
4. Capacity save survives closing and reopening the app.
5. Capture step navigates to Backlog, focuses the real composer, and creates an unscheduled task.
6. The created task is selected in the normal task-detail panel.
7. Setting only an estimate does not complete onboarding or mark the task as committed.
8. Setting the task date to Today and saving completes onboarding, returns to Today, and shows the real remaining-minute result.
9. Deleting the onboarding task returns to capture; returning it to Backlog does not silently reschedule or complete it.
10. Existing v1 databases migrate successfully and users with existing tasks never see first-run onboarding.
11. Settings saves preserve onboarding status and never touch API keys when `apiKeyChange` is unchanged.
12. Keyboard-only use reaches every control, focus remains visible, step changes are announced, and Escape does not cause accidental persistence.
13. The flow remains usable at 360 × 520 and in the full window.
14. Light/dark themes, reduced motion, persistence errors, AI-unconfigured state, and popover dismissal remain correct.

## Done criteria

- [ ] Fresh users can create one real, estimated Today commitment through the flow.
- [ ] The flow explains Backlog versus Today through action and concise copy.
- [ ] Capacity is persisted through the existing settings/native boundary.
- [ ] Completed and skipped onboarding never reappears on later launches.
- [ ] Existing users with tasks are never interrupted by first-run UI.
- [ ] Manual planning and AI remain independently usable.
- [ ] No new route, account, network request, analytics SDK, secret-bearing field, or generated router edit was added.
- [ ] Native migration and persistence tests pass.
- [ ] `npm run build` passes.
- [ ] Compact popover, full window, keyboard, theme, and reduced-motion checks pass.

## Deferred follow-up

- Replayable **Review the basics** entry from Settings or Help.
- Persisted one-time AI contextual hint.
- Product analytics or activation telemetry; only consider this if it can be reconciled with Slate’s local-first privacy promise and is explicitly user-consented.
- A dedicated **Commit to Today** task-detail action, unless usability testing shows the existing date control is not discoverable.


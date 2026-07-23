# Implementation plan: AI connection settings save flow

## Objective

Replace the current split Settings save behavior with one predictable form transaction.

The Settings footer **Save changes** button becomes the only save action for:

- Daily capacity.
- AI provider.
- AI model.
- API-key replacement or removal.
- Planning instruction.
- Theme when saved through the shared settings boundary.

The implementation must make persisted state visually authoritative immediately after success, while keeping API-key material transient and out of planner snapshots, SQLite, query caches, logs, and change events.

## Status

- Priority: P0 usability correction.
- Risk: High — this flow controls credentials and whether both AI features appear usable.
- Current implementation should be treated as a failed intermediate design and simplified rather than patched further.
- No provider request or AI proposal behavior changes are part of this work.

## Source-of-truth constraints

This plan follows:

- `AGENTS.md`: native Keychain and SQLite boundaries; no secrets in planner state or logs.
- `DESIGN.md`: quiet grouped Settings UI and one persistent global save action.
- `CODE-QUALITY.md`: small explicit APIs and no unnecessary fallback layers.
- `docs/product-brief.md`: manual features work without AI; provider/model/key configuration lives in Settings.
- `docs/ai-actions-brief.md`: unavailable AI must be communicated without affecting manual Save.
- Plans 007, 011, and 012: the selected provider/model are authoritative and credentials are read from Keychain only at request time.

This plan supersedes plan 006 only on one UI decision: a known missing key disables the footer AI button and exposes a Settings tooltip instead of opening an unavailable tray. Native `unavailable-key` handling remains as a defensive fallback for Keychain changes that happen outside Slate.

## Agreed product decisions

1. Settings has one save action: the footer **Save changes** button.
2. Remove the checkmark button beside the API-key field.
3. Save is disabled when the form matches persisted state.
4. Save enables when any setting or credential action changes.
5. While saving, the button is disabled and reads **Saving…**.
6. After success, Save disables again.
7. After failure, the draft remains intact and Save remains enabled for retry.
8. OpenRouter and Vercel AI Gateway retain separate Keychain entries.
9. The model choice is global, not remembered separately per provider.
10. Switching providers shows the saved-key status for the newly selected provider.
11. Ordinary settings can be saved without a key.
12. Saving an unconfigured provider leaves AI disabled and keeps the required-key warning visible.
13. Leaving Settings without saving discards the draft without a confirmation dialog.
14. Reopening Settings always shows the last successfully persisted values.
15. A saved key displays a fixed mask, never the real value.
16. Focusing the saved mask prepares the field for replacement.
17. Leaving the replacement field without typing restores the saved mask.
18. Each provider’s saved key can be marked for removal, but deletion occurs only when **Save changes** is clicked.

## Root cause of the current failures

The current screen has two competing form systems:

- Provider, model, capacity, instruction, and theme use `update_settings`.
- The API key uses a separate checkmark button and `set_api_key`.
- Both mutations independently invalidate or refetch the shared planner query.
- Local draft state attempts to resist those refreshes with a broad dirty flag.
- Key status is derived asynchronously from planner snapshots and then translated into placeholder text.
- The footer AI button reads a different derived availability field from the same changing snapshot.

This creates multiple race windows:

1. A key save can refresh the snapshot while provider/model edits still exist only in the local draft.
2. A settings save and key save can complete in different orders.
3. The field clears its real input state before a confirmed snapshot has replaced it with a saved mask.
4. Settings and the app footer can render different interpretations of provider availability.
5. Query-cache inference attempts to compensate for a native command that returns no authoritative post-save state.

The fix is to use one draft, one save command, and one returned safe state.

## Data contract

### Renderer save request

Add one typed save request:

```ts
type ApiKeyChange =
  | { kind: "unchanged" }
  | { kind: "replace"; apiKey: string }
  | { kind: "remove" };

type SaveSettingsInput = {
  settings: Settings;
  apiKeyChange: ApiKeyChange;
};
```

Rules:

- `apiKey` exists only in the transient Settings draft and the Tauri invocation payload.
- It must never enter TanStack Query data, planner snapshots, local storage, SQLite, logs, errors, URLs, or change events.
- `unchanged` preserves the selected provider’s current Keychain entry.
- `replace` requires a non-empty trimmed value.
- `remove` deletes only the selected provider’s Keychain entry.

### Native response

The save command returns a fresh safe `PlannerSnapshot` after all successful writes:

```ts
type PlannerSnapshot = {
  // Existing task, order, settings, and date fields.
  aiAvailability: "configured" | "unconfigured";
  aiAvailabilityByProvider: Record<
    "vercel-gateway" | "openrouter",
    "configured" | "unconfigured"
  >;
};
```

The response includes configuration status only. It never includes a key, masked key, key length, suffix, or Keychain metadata.

## Native save boundary

Replace renderer use of separate `update_settings`, `set_api_key`, and `delete_api_key` mutations with one native `save_settings` command.

The command:

1. Validates provider, model, capacity, theme, instruction bounds, and credential action.
2. Applies the selected provider’s credential action:
   - `unchanged`: no Keychain write.
   - `replace`: write the new non-empty key.
   - `remove`: delete the selected provider’s key.
3. Persists non-secret settings in SQLite.
4. Reads a fresh safe planner snapshot from SQLite and Keychain status.
5. Emits exactly one planner-change event.
6. Returns that same safe snapshot to the caller.

SQLite and Keychain cannot share a true transaction. Use the following failure policy:

- Validate everything before either store is changed.
- Apply the Keychain action before switching the active provider/model in SQLite.
- If the Keychain action fails, do not update SQLite.
- If SQLite fails after a successful Keychain action, report failure, retain the renderer draft, and allow an idempotent retry.
- Never report success until both required writes and the final snapshot read succeed.

Keep private credential helpers in `credentials.rs`:

- `write_api_key(provider, key)`
- `remove_api_key(provider)`
- `has_api_key(provider)`

Remove the old credential commands from the renderer invoke surface after all callers move to `save_settings`.

## Renderer state model

Create a small pure Settings draft module instead of coordinating several component-level booleans.

```ts
type KeyDraft =
  | { kind: "unchanged" }
  | { kind: "replace"; value: string }
  | { kind: "remove" };

type SettingsDraft = {
  baseline: Settings;
  values: Settings;
  availabilityByProvider: ProviderAvailability;
  key: KeyDraft;
  keyFocused: boolean;
};
```

Required derived values:

- `selectedProviderConfigured`
- `settingsChanged`
- `keyChanged`
- `isDirty`
- `canSave`
- `displayedKeyValue`
- `keyStatus`

State rules:

- Initialize the draft once from the current planner snapshot when Settings mounts.
- Do not continuously copy query data into a dirty draft.
- Successful save replaces the baseline and values from the returned snapshot and resets the key draft to `unchanged`.
- Failed save leaves every draft value untouched.
- Route unmount discards the draft.
- Provider changes reset any unsaved key text so a key can never be accidentally carried to the other provider.
- Switching providers reads mask/required state from `availabilityByProvider`.
- External planner snapshots may replace the draft only while it is clean.

## API-key field behavior

The field is a replacement control, not a secret viewer.

### Saved and unchanged

- Display `••••••••••••`.
- Do not derive the number of dots from the actual key.
- Use an accessible label such as “API key configured. Enter a new key to replace it.”
- The mask is a display token and is never included in a save request.

### Focused without typing

- Clear the display mask.
- Do not mark the form dirty merely because the field received focus.
- If the field blurs empty, return to the saved mask.

### Replacement typed

- Use the normal password input rendering.
- Mark `apiKeyChange` as `replace`.
- Enable Save.
- Keep the currently persisted key active until Save succeeds.

### Unconfigured provider

- Show an empty field with `Paste key`.
- Show the subtle destructive underline and `Required for AI`.
- Typing a key enables Save, but the warning remains until persistence succeeds.

### Pending removal

- Remove the mask from the draft UI.
- Show `Key will be removed when you save`.
- Enable Save.
- Keep the app footer based on persisted availability until Save succeeds.

### Successful save

- Replace the typed value with the fixed mask.
- Show `Configured`.
- Remove destructive highlighting.
- Disable Save if no other draft changes remain.
- Update the app footer AI button from the returned planner snapshot in the same render cycle.

## Provider and model behavior

- Provider and model are controlled by `draft.values`.
- Save persists both to SQLite.
- The returned snapshot becomes the new baseline.
- Reopening Settings reads the persisted provider/model.
- Switching provider does not change the selected model.
- Switching provider changes only the visible key status and transient key editor.
- A provider with no key can still be saved; AI remains unavailable.
- A provider with a saved key immediately shows the fixed mask when selected.

## Footer AI availability

The app footer reads only:

```ts
snapshot.aiAvailability
```

That value is native-derived from the persisted active provider and its Keychain status.

Behavior:

- `configured`: AI button uses normal Assist/Plan behavior.
- `unconfigured`: AI button is disabled and visibly muted.
- The disabled wrapper remains keyboard-focusable for its tooltip.
- Tooltip: `Add an API key in Settings to use AI`.
- Manual task Save remains enabled and independent.
- `unavailable-key` from an actual AI request still opens the existing unavailable state because a key can be removed externally after the last snapshot.

Do not let unsaved Settings drafts change the app footer. The footer changes only after the unified save command succeeds and returns its snapshot.

## Query-cache and cross-window behavior

Add one `useSaveSettings` mutation:

1. Invoke native `save_settings`.
2. Receive the authoritative safe `PlannerSnapshot`.
3. Call `queryClient.setQueryData(plannerStateQueryKey, returnedSnapshot)`.
4. Reset the local draft from that same snapshot.

Do not optimistically infer settings or key availability.
Do not depend on invalidation timing to make the initiating window correct.

The native planner-change event remains responsible for other open Slate windows. Those windows invalidate and fetch the same native snapshot.

The initiating window may receive the event as well; the returned snapshot and subsequent refetch must be equivalent.

## UI changes

Files:

- `src/routes/settings.tsx`
- `src/lib/settings-draft.ts`
- `src/lib/planner.ts`
- `src/lib/planner-query.tsx`
- `src/components/task-composer-footer.tsx`

Settings changes:

- Remove the API-key checkmark button.
- Keep the API-key input aligned with the other compact controls.
- Make the footer Save button the only primary action.
- Disable Save when clean.
- Enable Save when dirty.
- Show spinner plus `Saving…` while pending.
- Add a quiet `Remove key` control only when the selected provider has a saved key.
- Use semantic destructive color for required/removal states and visible text so color is never the only signal.
- Preserve the 360 × 520 minimum layout, keyboard focus, light/dark themes, and reduced-motion behavior.

## Implementation sequence

### 1. Define and test the pure draft state

- Add Settings draft types and transition functions.
- Encode mask, focus, blur, replacement, removal, provider switch, dirty detection, success reset, and failure preservation.
- Add provider-specific availability handling.

### 2. Replace the native settings command

- Add `ApiKeyChange` and `SaveSettingsInput`.
- Add private credential write/remove helpers.
- Implement one `save_settings` command returning `PlannerSnapshot`.
- Emit one change event after success.
- Remove old renderer-facing credential commands once unused.

### 3. Simplify the query layer

- Add `saveSettings(input): Promise<PlannerSnapshot>`.
- Add `useSaveSettings`.
- Set returned snapshot directly into the query cache.
- Remove settings/key cache inference and separate key mutations.
- Route theme updates through the same command with `apiKeyChange: unchanged`.

### 4. Rewrite the Settings screen

- Initialize one draft from planner state.
- Remove the checkmark button and nested save callbacks.
- Bind provider, model, capacity, instruction, and key controls to the draft.
- Implement fixed mask and replacement behavior.
- Implement pending key removal.
- Drive footer Save enabled/pending text from derived draft state.
- Reset only from an authoritative successful response or a clean external refresh.

### 5. Verify footer synchronization

- Ensure footer uses persisted `aiAvailability`.
- Confirm the initiating window updates immediately from the returned snapshot.
- Confirm another open window updates from `planner://changed`.
- Retain unavailable-key defensive handling for external Keychain changes.

### 6. Align documentation

- Document the single-save Settings behavior.
- Clarify provider-specific keys and global model selection.
- Record the disabled AI button plus Settings tooltip as the current preflight behavior.
- Mark plan 006’s unavailable-tray preflight choice as superseded while preserving runtime unavailable handling.

## Automated tests

### Pure renderer state tests

- Clean configured provider displays the fixed mask and Save is disabled.
- Focusing and blurring without typing restores the mask and stays clean.
- Typing a replacement marks the draft dirty and emits `replace`.
- The fixed mask can never become an API-key payload.
- Selecting an unconfigured provider shows required state.
- Switching providers never carries transient key text across providers.
- Selecting a configured provider restores its mask.
- Marking removal emits `remove` and enables Save.
- Successful save resets the baseline, mask, status, and dirty state.
- Failed save preserves the complete draft.
- Unsaved changes are discarded when a new draft is created after remount.

### Native tests

- Provider and model persist after repository reopen.
- `unchanged` does not call a credential mutation.
- Empty replacement keys are rejected before persistence.
- Unknown providers are rejected.
- Settings validation happens before credential mutation.
- Successful save returns availability for both providers.
- Returned active availability matches the persisted selected provider.
- Exactly one change event is emitted after complete success where testable.

Use a narrow fake credential boundary for save-command tests; never touch the developer’s real Keychain in automated tests.

### Integration/build checks

```bash
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
git diff --check
```

## Manual acceptance matrix

1. Start with no keys:
   - Both providers show `Required for AI`.
   - Save is disabled until a field changes.
   - App footer AI button is disabled.
2. Enter an OpenRouter key and save:
   - One footer Save action performs the write.
   - Input becomes the fixed mask.
   - Required warning disappears.
   - Save disables.
   - Footer AI button enables.
3. Leave and reopen Settings:
   - OpenRouter remains selected.
   - Model remains selected.
   - Fixed key mask remains.
   - No secret is exposed.
4. Focus the saved key and leave it empty:
   - Mask returns.
   - Save remains disabled.
5. Replace the key:
   - Save enables after typing.
   - Successful save returns to the mask.
6. Switch to AI Gateway without a saved key:
   - OpenRouter’s transient key is never shown.
   - Required warning appears.
   - Saving the provider is allowed.
   - Footer AI button disables after save.
7. Add an AI Gateway key and save:
   - Gateway becomes configured.
   - Switching between providers shows each provider’s own mask.
8. Change only the model:
   - Save enables.
   - Model persists after leaving and reopening.
   - Key status does not change.
9. Mark a key for removal:
   - UI explains removal is pending.
   - Nothing changes outside Settings before Save.
   - After Save, mask disappears, warning returns, and footer AI disables.
10. Force a save failure:
    - Typed replacement and all other draft values remain.
    - Save remains enabled for retry.
    - No success toast appears.
11. Open both popover and full window:
    - Save in one.
    - Confirm the other refreshes provider, model, key status, and footer AI availability.
12. Confirm manual task Save works throughout every unconfigured and failure state.

## Done criteria

- [x] API-key checkmark button is removed.
- [x] Settings footer Save is the only settings/credential save action.
- [x] Save accurately reflects clean, dirty, pending, success, and failure states.
- [x] Saved keys always render as a fixed non-secret mask.
- [x] Focus-without-edit restores the mask and does not dirty the form.
- [x] Provider/model persist across route remount and app restart.
- [x] Provider keys remain independent.
- [x] Model selection remains global.
- [x] Key replacement and deferred removal work through the same save command.
- [x] Required highlighting follows the selected provider and clears immediately after success.
- [x] Footer AI availability updates immediately after success.
- [x] Other open Slate windows refresh through the native change event.
- [x] Secrets never enter snapshots, SQLite, query-cache data, logs, or change events.
- [ ] Automated tests and the complete manual acceptance matrix pass.

Implementation completed on 2026-07-23. Pure draft-state tests, the native test suite, the production renderer build/type-check, and diff whitespace validation pass. The complete packaged desktop manual acceptance matrix remains open.

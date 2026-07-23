# Implementation plan: AI Assist, Plan My Day, and review tray

> Status: Product behavior reference only. The native HTTP transport in this historical plan is superseded by the packaged Node sidecar in plan 007. AI Assist is implemented in plan 011 and Plan My Day is implemented in plan 012; final packaged/manual acceptance remains.

## Objective

Ship the two AI actions defined in [the AI actions brief](../ai-actions-brief.md) through one footer button:

- With non-whitespace composer text, **AI Assist** returns an editable task title, positive whole-minute estimate, and (only when no date was supplied) an optional date suggestion.
- With an empty composer, **Plan My Day** returns an additive, capacity-safe proposal that moves eligible Backlog tasks into Today.

Both results remain transient until the user accepts them in a review tray above the persistent footer. Manual Save continues to work with no AI key or network connection.

## Status and prerequisites

- **Priority:** P1
- **Effort:** Large
- **Risk:** Medium — credentials, provider responses, and stale plan acceptance need deliberate handling.
- **Prerequisites:** `004-today-capacity-state` and `005-persistence-recovery-screen` are implemented. Plan My Day uses the dedicated native acceptance command defined in plan 012 rather than treating the older generic `apply_planner_plan` command as an AI boundary.

## Current architecture and constraints

- The footer in `src/components/task-composer-footer.tsx` already has manual Save and a disabled Sparkles button. Today passes its date as `scheduledDate`; Backlog passes `null`.
- `src/components/task-detail-panel.tsx` is the established compact panel pattern: it sits above the footer, supports editing, respects the 360 × 520 popover, and is dismissed by the root shell.
- `src/lib/planner.ts` and `src/lib/planner-query.tsx` are the only renderer-to-native planner boundary. `PlannerSnapshot` reports only whether an AI key is configured.
- `src-tauri/src/credentials.rs` stores API keys in macOS Keychain. Keys must never be included in snapshots, SQLite rows, review state, change events, logs, or a renderer command response.
- `src-tauri/src/persistence.rs` already stores all task and order changes and can atomically apply a group of plan assignments.

## Fixed transport decision

This plan selects the native Rust HTTP transport. The shipped implementation uses a bundled Node sidecar while retaining this plan's product behavior and persistence requirements.

Make the native Rust host, not the React webview, the AI client. The host reads the selected provider key from Keychain just in time, makes the provider request, validates the result, and returns only a safe proposal. This is required by the credential boundary and aligns with Vercel AI Gateway’s instruction not to expose its credential to browser clients.

Add a small native provider adapter using `reqwest`, `serde`, and `serde_json`; do **not** add an AI SDK package to the renderer and do not create a local HTTP server or Node sidecar. Both configured providers can be isolated behind the same non-streaming structured-result interface:

- `vercel-gateway` uses the configured Gateway model identifier and its Gateway request contract.
- `openrouter` uses its documented OpenAI-compatible chat-completions endpoint and configured model identifier.

Keep endpoint URLs, authorization headers, response decoding, timeouts, and provider-specific JSON in the adapter only. The rest of the app deals in Slate proposal types. Set a conservative request timeout and map provider failures to concise, non-secret error categories: unavailable key, timeout/network, rejected request, malformed response, and no usable proposal.

## Scope

Included:

- Native AI requests for the existing Vercel Gateway and OpenRouter settings.
- Strict structured proposals for AI Assist and Plan My Day.
- A single transient review-state owner and shared footer-adjacent review tray.
- Editing, Accept, Redo, and Dismiss for AI Assist.
- Additive, atomic Accept plan, Redo, and Dismiss for Plan My Day.
- Capacity, eligibility, and stale-plan validation at the persistence boundary.
- Native unit tests and manual compact-window verification.
- README and brief status updates after the feature is complete.

Excluded:

- Chat history, background/autonomous planning, streaming UI, model discovery, pricing, cloud sync, or external task integrations.
- AI changes to existing Today tasks, task completion, task deletion, or manual Save.
- Moving future-dated work into Today in this MVP. A future date is an explicit scheduling constraint; only unscheduled and overdue Backlog tasks are eligible.

## Result contracts

Define Rust request/response structs in a new focused module such as `src-tauri/src/ai.rs`, with camel-case serialization at the Tauri boundary. Mirror the returned, non-secret proposal types in `src/lib/planner.ts`.

### AI Assist request and result

Input:

- `capture`: non-empty trimmed composer text.
- `scheduledDate`: the route-provided date or `null`.

The native command reads the current settings and a minimal relevant task context itself. It should tell the model that an input date is immutable. Its structured output is:

- `title`: non-empty normalized text.
- `estimateMinutes`: positive integer.
- `scheduledDate`: valid local date or `null`.

After decoding, reject invalid values. If input `scheduledDate` is non-null, replace any model-supplied date with the input date before returning the proposal. If it is null, a returned date is allowed only when it is a valid local date; otherwise return `null` rather than guessing in the renderer.

### Plan My Day request and result

The renderer invokes Plan My Day with no task IDs. The native command reads a fresh snapshot and computes:

- Today and its active commitments, which are fixed context and never move candidates.
- Daily capacity and remaining capacity.
- Eligible Backlog tasks: incomplete, positive estimated minutes, not already Today, and either unscheduled or overdue. Exclude future-dated and title-only tasks.
- Current Backlog ordering as a soft priority signal and the saved planning instruction.

Give the model stable eligible task IDs, titles, estimates, date context, current order, remaining minutes, and the instruction. Ask it to return an ordered list of selected task IDs plus optional short rationale; it must not return dates, scopes, or positions.

Validate the selection after decoding: no unknown IDs, duplicates, completed tasks, invalid estimates, future-dated tasks, existing Today tasks, or total beyond remaining capacity. Convert the valid ordered Backlog IDs into final Today assignments by assigning the current local Today date and positions after the last existing Today task. Return those final items, total minutes, remaining capacity after the proposal, and an explicit empty-state reason when nothing can be added. Existing Today tasks are not returned as assignments.

Use deterministic validation as the final authority. The model ranks eligible work; it never determines persistence fields or bypasses capacity.

## Implementation steps

### 1. Add the native AI boundary and keep credentials native

Files:

- `src-tauri/Cargo.toml`
- `src-tauri/src/ai.rs` (new)
- `src-tauri/src/credentials.rs`
- `src-tauri/src/lib.rs`

1. Add only the Rust HTTP and JSON dependencies required by the native adapter (`reqwest` with TLS/JSON support and `serde_json`). Keep the existing Keychain dependency and provider allow-list.
2. Add a private credential reader in `credentials.rs` that validates the provider and returns its non-empty key to native code only. Do not annotate it as a Tauri command and do not expose it through `planner.ts`.
3. Implement two async Tauri commands in `ai.rs`: `generate_ai_assist` and `generate_daily_plan`. Both load settings and planner data through the existing persistence state, then use the private Keychain reader.
4. Build one provider adapter function per configured provider behind a small internal `generate_structured_json` interface. Supply a strict JSON schema or equivalent provider response-format request where the provider supports it, then deserialize and validate again locally. Do not rely solely on prompt wording or provider JSON mode.
5. Use concise, user-safe errors. Never interpolate API keys, authorization headers, raw provider bodies, or full prompts into errors or `println!` output.
6. Register the two commands in `tauri::generate_handler!`. They must not emit `planner://changed`, because generating or dismissing a proposal is not a planner mutation.

### 2. Make plan acceptance safe against stale or malicious proposal data

Files:

- `src-tauri/src/persistence.rs`
- `src/lib/planner.ts`
- `src/lib/planner-query.tsx`

1. Retain `apply_planner_plan` as the only Plan My Day write command, but validate its entire assignment set inside its existing SQLite transaction before updating any row.
2. Require every accepted assignment to target the current local Today date and Today scope, contain a unique existing task ID, and use contiguous append-only positions after the current active Today order. Do not permit it to change existing Today tasks or reorder their current positions.
3. Re-read each target task in the transaction. Reject completed, unsized, already-Today, and future-dated tasks. Recalculate active committed minutes plus proposed minutes and reject a plan that now exceeds capacity. Return a clear “Plan needs updating” error for stale state rather than partially applying anything.
4. Preserve the current transaction rollback behavior: all task date/order changes commit together or none do. Emit exactly one planner change after successful commit.
5. Add renderer types and invoke functions for the two proposal commands. Add React Query mutations for generation only; do not invalidate planner state on a generated result. Reuse `useCreateTask` for accepted Assist and `useApplyPlannerPlan` for accepted Plan My Day so accepted writes retain the current invalidation behavior.

### 3. Add one transient AI review-state owner

Files:

- `src/components/ai-review.tsx` (new)
- `src/routes/__root.tsx`
- `src/components/task-composer-footer.tsx`

1. Add a small `AiReviewProvider` around `SlateShell`, inside the existing `TaskSelectionProvider`. Its state must be a discriminated union for `idle`, `loading-assist`, `assist`, `loading-plan`, `plan`, `unavailable`, and `error`.
2. Keep only transient data in this state: original Assist capture text, immutable route date, current editable Assist draft, current plan proposal, and retry metadata. Never store API keys or raw provider responses.
3. `startAssist` clears task selection, stores the original capture and route date, switches to loading, calls the native command, and replaces loading with the proposal or error. `redoAssist` uses the retained original capture, not the cleared composer value.
4. `startPlan` uses a fresh native plan request each time. `redoPlan` repeats it from the current local persistence state, not a cached snapshot.
5. Superseded by plan 013 for known preflight state: when the active provider has no saved key, disable the AI button and direct the user to Settings with a tooltip. Preserve this unavailable tray with **Open Settings** for runtime `unavailable-key` failures, such as an external Keychain change after the last snapshot. Manual Save remains independent and usable.
6. Starting an AI action replaces any prior AI review. Starting an AI action clears a selected task; clicking a task row while a review is open dismisses the review before opening the task detail panel.
7. Extend root outside-click and Escape handling to recognize `[data-ai-review]`. Escape or an outside click dismisses the review first; the popover only hides after no task detail or review surface remains open.

### 4. Turn the footer button into the two requested actions

Files:

- `src/components/task-composer-footer.tsx`
- `src/routes/__root.tsx`

1. Derive `hasComposerText` from `title.trim().length > 0`.
2. Keep the current Save button and submit behavior exactly as-is.
3. Make the Sparkles button call `startAssist(title.trim(), scheduledDate)` when `hasComposerText`; clear the visible composer immediately after successfully beginning that request. When the composer is empty or whitespace-only, call `startPlan()`.
4. Set the icon button’s accessible name and title from the active action: **Use AI Assist** with text and **Plan My Day** without text. During AI generation, disable only the Sparkles button and expose a busy label; do not block Save unless its own mutation is pending.
5. Continue to pass Today’s date from the root route and `null` from Backlog. Do not infer route state from display labels.

### 5. Build the shared review tray above the footer

Files:

- `src/components/ai-review-tray.tsx` (new)
- `src/components/task-composer-footer.tsx`
- `src/components/task-detail-panel.tsx` (only if a small shared date helper is extracted)

1. Render `AiReviewTray` beside `TaskDetailPanel` in the footer, with the same `absolute inset-x-4 bottom-full` placement, compact safe width, semantic tokens, reduced-motion behavior, and `data-ai-review` marker. Render at most one of the detail panel and review tray at a time.
2. The Assist variant is a compact editable task form with title, whole-minute estimate, and date controls. Reuse the calendar/input interaction and validation rules already present in `TaskDetailPanel`; do not duplicate persistence logic or create a separate draft table.
3. Its controls are **Accept**, **Redo**, and **Dismiss**. Accept validates the edited title and estimate, then creates exactly one task with the reviewed date. Disable the controls while a request or create mutation is pending. On success, close the tray and show the existing success feedback; on failure, leave the editable proposal visible.
4. The Plan variant is taller but bounded by the footer/workspace. Make only its list scrollable. Show each proposed title and estimate, total proposed minutes, and capacity remaining after the plan. Its controls are **Accept plan**, **Redo**, and **Dismiss**.
5. Accept plan calls the existing atomic plan mutation with the final assignments. On success, close the tray. On a stale-plan error, keep the tray open, explain that the plan needs updating, and offer Redo; do not apply a subset.
6. The loading, unavailable, error, and empty-plan states must explain what happened and supply the appropriate action: retry/Redo, Open Settings, or Dismiss. Errors must not expose provider internals or secrets.
7. Maintain keyboard focus after every state change, provide `aria-live` status for loading/error/empty states, and verify focus rings and color contrast in both themes.

### 6. Test, document, and verify the desktop behavior

Files:

- `src-tauri/src/ai.rs` tests
- `src-tauri/src/persistence.rs` tests
- `README.md`
- `docs/ai-actions-brief.md`

1. Add Rust unit tests for provider-free logic: Assist date preservation and validation; Plan eligibility; duplicate/unknown selection rejection; capacity fitting; and conversion to append-only Today assignments. Mock the HTTP adapter boundary rather than using real keys or network calls.
2. Add persistence tests proving a valid accepted plan is atomic and a stale, over-capacity, completed, future-dated, or malformed assignment set makes no writes.
3. Update the README only after implementation to mark AI Assist, Plan My Day, review-before-commit, and Keychain-backed provider configuration as available. Keep model discovery, automatic planning, and cloud features out of its “implemented” list.
4. Update this brief’s status/implementation notes once behavior is shipped; it remains the product contract rather than a second technical design.

## Manual acceptance matrix

1. From Today, enter rough text and use AI Assist. The composer clears, the tray opens, the Today date is preserved even if the provider suggests another date, and no task exists until Accept.
2. From Backlog, use AI Assist on text without a date. Accept a valid title/estimate; confirm the provider may leave it unscheduled and the task lands in the expected Log section.
3. Edit an Assist title, estimate, and date before Accept. Reject blank titles, zero, decimals, and negative estimates locally without losing the review result.
4. Press Redo for Assist after editing. Confirm it uses the original cleared capture, replaces the old result, and still creates nothing until Accept. Dismiss must create nothing.
5. With a configured key and empty composer, Plan My Day proposes only eligible unscheduled/overdue estimated Backlog tasks, preserves existing Today order, stays within remaining capacity, and clearly explains no-capacity/no-eligible-task cases.
6. Accept a multi-item plan and confirm all assignments appear together in Today. Create a stale condition before accepting another plan (for example, add a Today task or complete a proposed task); confirm acceptance fails atomically and Redo produces a fresh plan.
7. Confirm future-dated and title-only tasks never enter the proposal. Confirm re-running after acceptance only fills newly available capacity and never silently removes or reorders current Today tasks.
8. Remove the configured API key, trigger both button modes, and confirm the unavailable tray offers Settings while manual Save still works.
9. Simulate a timeout/provider failure and malformed provider output. Confirm the tray shows a concise retryable error without any secret or raw provider response.
10. Verify Escape, outside clicks, task-detail selection, keyboard focus, light/dark themes, and 360 × 520 popover and full-window layouts.

## Validation commands

Run after implementation:

```bash
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

Run the desktop app for the manual matrix:

```bash
npm run dev:desktop
```

## Done criteria

- [ ] One footer AI button reliably chooses AI Assist from non-empty text and Plan My Day from empty/whitespace-only text.
- [ ] API keys stay in native Keychain handling and never cross into planner/review state or storage.
- [ ] AI Assist produces an editable, validated draft and never writes before Accept.
- [ ] An explicit Today date is retained during Assist.
- [ ] Plan My Day proposes only eligible work, respects capacity, and preserves existing Today commitments.
- [ ] Plan acceptance is atomic and rejects stale or invalid assignments without partial writes.
- [ ] Review tray supports loading, unavailable, error, result, Redo, and Dismiss states accessibly in the compact window.
- [ ] Manual Save works without an AI key or network access.
- [ ] README and AI brief accurately state the shipped behavior.
- [ ] `npm run build` and `cargo test --manifest-path src-tauri/Cargo.toml` pass.

## References

- [Slate AI actions brief](../ai-actions-brief.md)
- [Slate product brief](../product-brief.md)
- [Vercel AI SDK structured data guide](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [Vercel AI Gateway provider guide](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway)
- [OpenRouter API quickstart](https://openrouter.ai/docs/quickstart)

## Planned at

Commit `cfccc75`, 2026-07-21.

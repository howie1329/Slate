# Implementation plan: AI Assist sidecar vertical slice

## Objective

Ship the first production AI feature end to end: turn non-empty footer capture text into one editable task proposal using the existing Keychain settings and packaged Node sidecar.

## Status

Completed on the current branch. Plan My Day was intentionally separate and is now implemented in [012-plan-my-day-sidecar-vertical-slice.md](012-plan-my-day-sidecar-vertical-slice.md).

This slice validates the real product path before Plan My Day:

```text
Footer input → native Tauri command → Keychain and planner context
→ Node sidecar → JavaScript AI SDK → structured proposal
→ editable review tray → existing create-task command
```

This document covers the Assist-only incremental slice. Current empty-composer behavior is owned by the completed Plan My Day slice in 012.

## Product contract

- AI Assist returns exactly one task proposal.
- The proposal contains a cleaned-up title, a positive whole-minute estimate, and a nullable scheduled date.
- Assist accepts the current composer text, workspace date, and bounded relevant planner context.
- An explicit date supplied by the user is authoritative. AI may not replace it.
- A Backlog capture without a date may receive a cautious valid local-date suggestion; otherwise the date remains `null`.
- Nothing is written before the user accepts the reviewed result.
- Manual Save remains available without an AI key or network access.
- AI Assist is the only production AI action in this slice. Empty composer behavior is outside this slice and is implemented by Plan My Day in 012.

## Native and sidecar boundary

Add a native `generate_ai_assist` command. The renderer sends only:

```ts
type AiAssistInput = {
  capture: string;
  scheduledDate: LocalDate | null;
};
```

Rust owns the following sequence:

1. Validate the capture and date.
2. Read the selected provider and model from Settings.
3. Read the selected provider's non-empty API key from macOS Keychain.
4. Read the local Today date from the local planner.
5. Build a versioned sidecar request.
6. Start the packaged sidecar and write one request through stdin.
7. Validate the single response, timeout, exit status, and output limits.
8. Return only the safe proposal or a stable error category to the renderer.

The sidecar request is:

```ts
type AssistRequest = {
  version: 1;
  operation: "assist";
  provider: "vercel-gateway" | "openrouter";
  model: string;
  apiKey: string;
  input: {
    capture: string;
    today: LocalDate;
    scheduledDate: LocalDate | null;
  };
};
```

Request bounds:

- Capture: maximum 2,000 characters.
- Local today: a validated calendar date used only for cautious relative-date interpretation.
- The saved planning instruction is not sent to Assist; it remains Plan My Day-only.

The API key travels only from Keychain to native memory to the sidecar stdin request. It must never enter renderer state, SQLite, URLs, command-line arguments, change events, or logs.

## Sidecar operation

Add the `assist` operation to the sidecar protocol. Packaging probes are historical spike tooling and are not part of the product runtime.

Use the installed AI SDK version's structured-output API: `generateText` with `Output.object(...)` and a Zod schema equivalent to:

```ts
{
  title: non-empty string, max 240 characters;
  estimateMinutes: positive integer, max 1440;
  scheduledDate: string or null;
}
```

Support both configured providers through their existing factories. The selected Settings provider is authoritative; do not fall back to another configured provider.

Provider execution must:

- Make one bounded request with no automatic SDK retry.
- Use a conservative provider timeout inside the native process timeout.
- Treat task titles and capture text as untrusted data, clearly delimited from instructions.
- Normalize failures to `unavailable-key`, `timeout`, `network`, `provider-rejected`, `malformed-output`, `no-proposal`, or `internal`.
- Never write raw provider responses, prompts, authorization headers, or API keys to stdout, stderr, or logs.

Rust performs final validation, including local-date validity, explicit-date preservation, positive estimate, title bounds, matching operation, and strict response shape.

## Renderer review flow

Add one transient AI review-state owner shared by the footer and review tray. Its state must never contain API keys or raw provider responses.

When the composer contains non-whitespace text:

1. Label the action **Use AI Assist**.
2. Preserve the original capture in transient state.
3. Clear the visible composer.
4. Open the footer-adjacent tray in loading state.
5. Show an editable title, estimate, and date when generation succeeds.

The tray provides **Accept**, **Redo**, and **Dismiss**.

- Accept validates the edited fields and reuses the existing `create_task` mutation.
- Accept creates exactly one task and emits the normal planner change through the existing persistence path.
- Dismiss discards the proposal and original capture without mutation.
- Redo reuses the original capture, reads fresh planner context, and creates a new operation ID.
- Late responses from older operation IDs must not replace a newer result or reopen a dismissed tray.
- If the route changes, dismiss the review.
- If the popover hides, preserve the in-memory review while the application process remains alive.

When the composer is empty or whitespace-only:

- Label the action **Plan My Day**.
- Show that Plan My Day is not yet available.
- Do not start a sidecar request.

When the selected provider has no Keychain key:

- Keep the AI action discoverable.
- Show the unavailable state with an **Open Settings** action.
- Do not fall back to another provider.
- Keep manual Save unaffected.

## Planner and event rules

- AI generation, loading, retry, redo, and dismissal are transient and must not emit `planner://changed`.
- Only accepted task creation emits the existing planner change event.
- Assist acceptance does not require stale-plan rejection because it creates one new task and does not overwrite existing tasks.
- Existing native task validation remains authoritative for title, estimate, date, and persistence.

## UI and accessibility constraints

- Reuse the existing task-detail-panel placement and interaction pattern.
- Keep the review tray usable at the 360 × 520 popover minimum.
- Use semantic CSS tokens from `src/styles.css`.
- Keep controls and task data in the sans-serif UI type.
- Use a flat bordered/tinted transient panel; avoid decorative cards and broad shadows.
- Preserve visible keyboard focus, Escape dismissal, outside-click behavior, reduced-motion behavior, and both light/dark themes.
- Provide concise `aria-live` loading, error, and unavailable status text.
- Keep the primary teal reserved for the explicit action and meaningful ready/confirmed state.

## Documentation alignment

After implementation and acceptance:

- Update the README to mark AI Assist, review-before-commit, and Keychain-backed provider configuration as implemented.
- Update the AI Actions Brief status/implementation notes.
- Keep Plan My Day’s current implementation and remaining manual acceptance documented in 012.
- Preserve the product brief as the behavior authority.
- Correct the sidecar plan's provider reference to match the verified dependency set: Gateway support is imported from `ai` via `createGateway` for the pinned sidecar version; do not add the stale `@ai-sdk/gateway` package unless a future SDK upgrade requires it.

## Tests and acceptance

Sidecar tests:

- Valid Assist request parsing.
- Unknown provider, operation, version, and extra-field rejection.
- Structured output validation.
- Invalid date and estimate rejection.
- Provider error normalization.
- No secret output or diagnostic logging.
- One-attempt behavior and timeout mapping.

Rust tests:

- Assist input validation.
- Private selected-provider Keychain lookup.
- No-provider-fallback behavior.
- Bounded request construction.
- Explicit-date preservation.
- Strict response validation and error mapping.
- No planner event for generation or dismissal.
- Existing malformed, trailing, oversized, timeout, and non-zero sidecar behavior.

Manual acceptance:

1. From Today, generate Assist and confirm the supplied Today date is preserved in the result.
2. From Backlog, generate Assist with no date and confirm the result can remain unscheduled or contain a valid inferred date.
3. Edit title, estimate, and date; reject blank, zero, decimal, and negative estimates locally.
4. Confirm no task exists before Accept and exactly one task exists after Accept.
5. Confirm Dismiss creates no task and Redo uses the original capture with fresh context.
6. Confirm late results cannot replace a newer request or a dismissed review.
7. Confirm missing key, timeout, network, provider rejection, malformed output, and no-proposal states are concise and retryable where appropriate.
8. Confirm empty input is handled by the separate Plan My Day slice and does not start an Assist request.
9. Confirm manual Save works without a key or network.
10. Verify Escape, outside click, route changes, popover hide/reopen, keyboard focus, themes, and the 360 × 520 popover.
11. Verify both configured providers in the packaged macOS application.

Validation commands:

```bash
npm run build
npm --prefix sidecar test
cargo test --manifest-path src-tauri/Cargo.toml
npm run dev:desktop
npm run tauri -- build
```

## Done criteria

- [x] AI Assist works from non-empty Today and Backlog captures.
- [x] The result is one editable, validated task proposal.
- [x] Explicit dates are preserved by AI and may be intentionally edited by the user.
- [x] No task or planner event is produced before acceptance.
- [x] Accepted Assist uses the existing native create-task path.
- [x] Keys remain native and never enter renderer state, storage, logs, or change events.
- [ ] Both configured providers work through the packaged sidecar; live provider verification remains a manual acceptance step requiring each key.
- [x] Loading, unavailable, error, retry, result, and dismissal states work in the compact window.
- [x] Empty composer is outside the Assist slice and is routed to the separate Plan My Day slice.
- [x] README and AI brief accurately describe the shipped Assist state.
- [x] The stale Gateway dependency reference is corrected.
- [ ] Native, sidecar, and packaged acceptance checks pass; automated checks pass, while live provider and macOS UI acceptance remain manual.

## References

- [AI actions brief](../ai-actions-brief.md)
- [Product brief](../product-brief.md)
- [AI Assist and Plan My Day review tray plan](006-ai-assist-plan-my-day-review-tray.md)
- The native sidecar boundary owns credentials, process lifecycle, and safe response validation.
- [Slate design system](../../DESIGN.md)

## Planned at

Branch `codex/ai-sidecar-packaging-spike`, 2026-07-23.

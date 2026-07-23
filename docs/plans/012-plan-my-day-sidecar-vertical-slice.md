# Implementation plan: Plan My Day sidecar vertical slice

## Objective

Ship Plan My Day as the second AI vertical slice, building on the completed AI Assist sidecar path.

When the footer composer is empty, Plan My Day should:

1. Read the current local planner state.
2. Identify eligible Backlog work that could fit into remaining Today capacity.
3. Ask the configured provider to rank a bounded set of candidates.
4. Show an additive proposal in the existing review tray.
5. Apply the accepted assignments atomically, or apply nothing.

Plan My Day must not edit, delete, complete, reorder, or silently reschedule existing Today commitments.

## Status and prerequisites

- Priority: P1
- Effort: Large
- Risk: High — the main risks are stale acceptance, capacity correctness, and explaining why work was or was not selected.
- Prerequisite: AI Assist sidecar vertical slice in 011 is complete.
- Prerequisite: The packaged Node sidecar, native Keychain boundary, review-state owner, and shared footer tray already exist.
- Plan My Day remains unavailable in the UI until this slice is implemented and accepted.

## Source-of-truth decisions

This plan cross-references:

- Product behavior in the product brief.
- Shared AI behavior and review rules in the AI actions brief.
- Review-tray and atomic-plan requirements in 006-ai-assist-plan-my-day-review-tray.md.
- The current JavaScript SDK transport and packaged sidecar in 007-ai-sdk-node-sidecar.md.
- The completed Assist implementation and current sidecar protocol in 011-ai-assist-sidecar-vertical-slice.md.
- Capacity and staged product guardrails in the roadmap.

The current sidecar transport remains authoritative. Do not revive the native HTTP alternative from plan 006 and do not create a localhost server. Plan My Day is a new sidecar operation behind the same native process boundary.

Plan My Day does use Backlog context because selecting existing Backlog work is its product purpose. This is intentionally different from AI Assist, which no longer sends Backlog context and only transforms the user’s capture.

## Product contract

- The empty composer invokes Plan My Day.
- The plan is additive: it can add eligible Backlog tasks to Today, but cannot remove or reorder existing Today tasks.
- Existing uncompleted Today commitments are preserved exactly.
- Only incomplete, positively estimated, non-Today tasks are candidates.
- Unscheduled and overdue candidates are eligible.
- Future-dated, title-only, completed, and already-Today tasks are excluded.
- The current remaining capacity is a hard limit for generated and accepted plans.
- A plan may leave capacity unused when no candidate fits or the planning instruction calls for restraint.
- Nothing changes in SQLite during generation, loading, retry, redo, empty-state display, or dismissal.
- Accept plan is the only operation that can mutate tasks.
- Acceptance either applies every selected task or applies none.
- A stale or invalid proposal returns a retryable “Plan needs updating” state and performs no partial writes.
- Manual Save and all non-AI task actions remain usable without a key or network.

## Native planning context

Native Rust computes the planning context from the current SQLite state before starting the sidecar. The renderer does not send task IDs, dates, capacity, or planning instructions for generation.

The context contains:

- Current local date.
- Daily capacity in minutes.
- Active Today commitments, ordered by the persisted Today order.
- Current committed minutes and remaining capacity.
- Up to 50 eligible Backlog candidates.
- Candidate stable ID, title, positive estimate, scheduled date, source section, and current Backlog order position.
- The saved planning instruction, bounded before it enters the provider request.

Candidate construction is deterministic:

1. Read incomplete tasks and persisted scope ordering.
2. Exclude tasks without a positive estimate.
3. Exclude tasks dated today because they are already commitments.
4. Exclude future-dated tasks because their explicit date is a scheduling constraint.
5. Keep unscheduled and overdue tasks.
6. Order candidates by the existing Backlog group order, then persisted order within each group, then created-at and ID tie-breakers.
7. Limit the request to the first 50 candidates.

If remaining capacity is zero, return a local empty result without starting a provider request. If there are no eligible candidates, return a local empty result without starting a provider request. This avoids unnecessary cost and makes those states deterministic.

## Sidecar request and result

Add the versioned plan operation to the existing newline-delimited JSON protocol.

The plan request includes:

    version: 1
    operation: plan
    provider: vercel-gateway or openrouter
    model
    apiKey
    input:
      today
      dailyCapacityMinutes
      remainingMinutes
      todayTasks
      candidates
      planningInstruction

The sidecar output is deliberately narrower than the native proposal:

    taskIds: ordered string array, maximum 50
    rationale: nullable string, maximum 500 characters

The model may rank candidates and explain the suggestion. It must not return dates, scopes, positions, estimates, arbitrary task fields, or instructions that change persistence behavior.

The native layer converts selected IDs into safe proposal items containing:

- Stable task ID.
- Current task title.
- Current estimate.
- Current source date/section.
- Today’s resulting date.
- Total proposed minutes.
- Remaining capacity after the proposal.
- Optional rationale.

If the provider returns no IDs, the native result becomes an explicit empty proposal rather than an ambiguous success.

## Provider and prompt rules

- Use the selected Settings provider; never fall back to another provider.
- Use the existing JavaScript AI SDK structured-output path.
- Make one bounded request with no automatic SDK retry.
- Keep the provider timeout inside the native sidecar timeout.
- Delimit task titles and planning instructions as untrusted data, not instructions.
- Tell the model that candidate IDs are the only selectable values.
- Tell the model that existing Today commitments are fixed.
- Tell the model to prefer the current Backlog order as a soft signal, not an absolute priority.
- Tell the model not to select tasks whose estimates exceed remaining capacity unless a complete plan policy explicitly permits over-capacity; this slice does not permit it.
- Never log prompts, API keys, authorization headers, raw provider bodies, or model output outside the validated response.

## Native acceptance boundary

Do not let the renderer submit dates, scopes, or positions as the authority for acceptance. Add a dedicated native accept command with a narrow payload containing the selected task IDs plus the expected candidate snapshots used for stale detection.

The preferred command shape is:

    accept_daily_plan(items)

Each item contains:

- task ID
- expected title
- expected estimate
- expected scheduled date

The native transaction must:

1. Re-read Settings, current local date, Today tasks, and every proposed task.
2. Confirm the expected candidate snapshot still matches the stored task.
3. Confirm every task is still incomplete, positively estimated, not Today, and unscheduled or overdue.
4. Confirm every ID is unique and exists.
5. Confirm the current Today commitments and persisted order are unchanged in the relevant acceptance dimensions.
6. Recalculate remaining capacity from the current database state.
7. Reject the entire proposal if the total no longer fits.
8. Assign today’s date and append selected tasks after the existing Today order.
9. Commit all task-date and order writes in one SQLite transaction.
10. Emit exactly one planner change event after a successful commit.

If any validation fails, roll back the transaction and return a stable stale-plan error. The renderer should retain the proposal and offer Redo; it must not try to apply a subset.

The existing generic planner-plan path should not be trusted as an AI acceptance boundary until it enforces these rules. Either narrow it to the same native-authoritative contract or keep Plan My Day on the dedicated accept command.

## Renderer and review tray

Extend the existing transient AI review owner rather than creating a second plan-specific state system.

Plan states should distinguish:

- plan-loading
- plan-result
- plan-empty
- plan-unavailable
- plan-error

The plan proposal state contains only safe task summaries, IDs, capacity numbers, rationale, and a request ID. It never contains a key, prompt, raw response, or process detail.

When Plan My Day starts:

1. Clear task selection.
2. Keep the visible composer empty.
3. Show the review tray in a loading state.
4. Request a fresh native plan.
5. Ignore late results after dismissal, route change, or a newer request.

The review tray shows:

- A concise explanation of the plan.
- Proposed task titles and estimates.
- Total proposed minutes.
- Remaining capacity after acceptance.
- Optional short rationale.
- Accept plan, Redo, and Dismiss.

The first slice does not allow freeform editing or reordering of individual plan items. If the user wants a different plan, Redo uses fresh local context. This keeps the acceptance contract narrow and prevents a second planning editor from appearing in the compact popover.

Empty states must be explicit:

- No remaining capacity: “Today is already at capacity.”
- No eligible candidates: “There are no estimated unscheduled or overdue tasks to add.”
- No provider-selected tasks: “Nothing fits the remaining capacity.”

Unavailable and provider errors use the existing concise error categories and Settings/retry actions. Manual Save remains independent.

## UI and accessibility constraints

- Reuse the current footer-adjacent tray placement and task-detail dismissal behavior.
- Keep the tray bounded and scroll only the proposed task list at 360 × 520.
- Preserve the Today/Backlog visual hierarchy; Plan My Day is a review surface, not a dashboard.
- Use semantic tokens from src/styles.css.
- Use the existing flat tinted transient panel treatment with quiet borders and no decorative shadow.
- Keep task data and controls in the sans-serif UI font.
- Reserve teal for the explicit acceptance action and meaningful ready state.
- Provide visible keyboard focus, Escape dismissal, outside-click behavior, reduced-motion behavior, and light/dark theme support.
- Use semantic labels and aria-live status for loading, empty, error, and unavailable states.
- Never make the plan appear autonomous or already committed.

## Implementation steps

### 1. Add the plan context and protocol

Files:

- src-tauri/src/persistence.rs
- src-tauri/src/ai.rs
- sidecar/src/protocol.ts
- sidecar/src/plan.ts
- sidecar/src/main.ts

Add a bounded planning-context reader that returns only the deterministic fields above. Add the plan request schema, candidate schema, selected-ID output schema, and stable error mapping. Preserve Assist, health, and SDK-load behavior.

### 2. Implement structured Plan My Day generation

Files:

- sidecar/src/plan.ts
- src-tauri/src/ai.rs
- src-tauri/src/lib.rs

Implement the plan prompt and provider call. Native code handles local no-capacity/no-candidate short circuits, Keychain access, sidecar execution, response parsing, candidate validation, and conversion to safe proposal items.

### 3. Implement stale-safe atomic acceptance

Files:

- src-tauri/src/persistence.rs
- src-tauri/src/ai.rs
- src/lib/planner.ts
- src/lib/planner-query.tsx

Add native transaction validation, append-only Today assignment, expected-snapshot checks, rollback tests, and a typed renderer mutation. The mutation should invalidate the planner query only after the native commit succeeds.

### 4. Integrate Plan My Day into the existing review flow

Files:

- src/components/ai-review.tsx
- src/components/ai-review-tray.tsx
- src/components/task-composer-footer.tsx
- src/routes/__root.tsx

Replace the current Plan My Day unavailable-only state with loading, result, empty, error, retry, and acceptance states. Preserve all AI Assist behavior and route/focus dismissal rules.

### 5. Document and manually accept the slice

Files:

- README.md
- docs/product-brief.md
- docs/ai-actions-brief.md
- docs/roadmap.md

Update status only after implementation and manual acceptance. Keep Plan My Day’s non-goals visible: no automatic commits, no future-task rescheduling, no freeform plan editor, no chat, and no backlog mutation outside accepted Today assignments.

## Test plan

Sidecar tests:

- plan request parsing and unknown-field rejection
- candidate and instruction bounds
- maximum 50 candidate IDs
- duplicate/unknown selected-ID rejection at the native boundary
- structured output and rationale validation
- provider failure normalization
- no secret output
- no-provider-call empty cases where testable at the native dispatcher boundary

Rust tests:

- eligible candidate construction and ordering
- exclusion of completed, unsized, Today, and future-dated tasks
- 50-candidate bound
- zero-capacity and no-eligible short circuits
- selected IDs converted to safe Today assignments
- duplicate, unknown, changed-estimate, changed-date, completed, future-dated, and already-Today rejection
- capacity recalculation at acceptance
- append-only order preservation
- stale acceptance rolls back all writes
- successful acceptance emits one planner change
- Assist behavior remains unchanged

Manual acceptance:

1. Empty composer opens Plan My Day rather than Assist.
2. No-capacity and no-eligible states appear without a provider request.
3. A configured provider proposes only unscheduled/overdue estimated Backlog tasks.
4. Existing Today tasks remain unchanged and proposed tasks fit remaining capacity.
5. Accept plan moves every selected task together into Today and preserves existing order.
6. Dismiss and Redo do not mutate tasks; Redo reads fresh state.
7. Change a candidate or Today commitment before acceptance; acceptance fails atomically and offers Redo.
8. Remove the key or network; manual Save still works and the tray gives a concise retry/Settings path.
9. Verify the plan tray at 360 × 520, full window, keyboard focus, Escape, outside click, reduced motion, and both themes.
10. Verify both configured providers in the packaged macOS application.

## Validation commands

    npm run build
    npm --prefix sidecar test
    cargo test --manifest-path src-tauri/Cargo.toml
    npm run tauri -- build

## Done criteria

- [ ] Empty composer invokes Plan My Day through the native sidecar boundary.
- [ ] Candidate context is deterministic, bounded, and excludes ineligible tasks.
- [ ] Plan My Day never changes SQLite during generation, retry, redo, empty-state display, or dismissal.
- [ ] The result is a reviewable additive plan with task summaries, totals, and capacity impact.
- [ ] Existing Today commitments remain unchanged.
- [ ] Acceptance is native-authoritative, atomic, append-only, and stale-safe.
- [ ] Invalid provider output cannot create partial writes.
- [ ] Loading, empty, unavailable, error, retry, result, and dismiss states work in the compact window.
- [ ] Manual Save and ordinary task management work without AI.
- [ ] Both configured providers work through the packaged sidecar.
- [ ] README, product brief, AI actions brief, and roadmap accurately describe the shipped state.
- [ ] Native, sidecar, and packaged acceptance checks pass.

## References

- [Product brief](../product-brief.md)
- [AI actions brief](../ai-actions-brief.md)
- [AI Assist and Plan My Day review tray plan](006-ai-assist-plan-my-day-review-tray.md)
- [AI SDK Node sidecar plan](007-ai-sdk-node-sidecar.md)
- [Completed AI Assist sidecar vertical slice](011-ai-assist-sidecar-vertical-slice.md)
- [Sidecar packaging spike](010-ai-sidecar-packaging-spike.md)
- [Slate design system](../../DESIGN.md)
- [Code quality guide](../../CODE-QUALITY.md)

## Planned at

Branch codex/ai-sidecar-packaging-spike, 2026-07-23.

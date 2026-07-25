# Implementation plan: AI boundary hardening and cleanup

## Objective

Harden the shipped AI boundary without expanding product scope:

1. Make AI Assist capture-first by removing task-list context.
2. Distinguish a missing API key from an unavailable macOS Keychain.
3. Give probes and live provider calls deliberate, separately bounded timeouts.
4. Keep the curated provider/model list consistent across renderer, native code, and sidecar.
5. Remove obsolete spike-only sidecar code introduced on this branch.

Plan My Day's Today and Backlog context remains unchanged. It needs that context to propose additions that fit the remaining daily capacity.

## Status

- Priority: P1 reliability and maintainability follow-up.
- Scope: AI Assist, AI configuration, native Keychain availability, sidecar lifecycle, and branch-introduced cleanup only.
- No model discovery, custom model IDs, provider fallback, AI chat, background jobs, or changes to the manual task workflow.

## Source-of-truth constraints

This plan follows:

- AGENTS.md: API keys remain in Keychain and never enter SQLite, snapshots, renderer state, logs, or change events.
- docs/product-brief.md: AI is optional and reviewable; Plan My Day alone uses planner context to make planning decisions.
- docs/ai-actions-brief.md: AI Assist improves a capture; Plan My Day uses existing commitments and eligible Backlog tasks.
- The native sidecar boundary owns credentials, process lifecycle, and safe response validation; the renderer never knows about the sidecar.
- docs/plans/011-ai-assist-sidecar-vertical-slice.md: explicit dates remain authoritative and Assist results remain transient until accepted.
- CODE-QUALITY.md: preserve strict typed boundaries, explicit domain ownership, and the smallest native surface that solves the problem.

## Product decisions

1. AI Assist receives the capture, local today date, and explicit scheduled date only. It does not receive Today tasks, Backlog tasks, planning instructions, or other planner context.
2. Retaining the local today date is allowed so Assist can cautiously interpret a relative date such as “tomorrow.”
3. Plan My Day continues to receive fixed Today commitments, eligible Backlog candidates, remaining capacity, and the planning instruction.
4. The provider/model list stays curated and static. There is no model discovery or custom model field.
5. A Keychain access failure is not represented as a missing credential. It is a separate safe availability state with retry guidance.
6. Live AI requests have a larger native deadline than the SDK provider timeout. Development/package probes, if retained in automated verification, have their own short deadline.
7. The health, sdk-load, and environment-triggered startup-probe code were packaging-spike scaffolding. They are removed from the product runtime now that Assist and Plan My Day exercise the real sidecar path.

## Current issues

### Assist sends unnecessary task context

AssistRequest currently contains up to 50 Today tasks, and the Assist prompt includes them. This increases provider context and cost without being needed to transform one capture into a task proposal.

### Keychain failures are misclassified

has_api_key returns a boolean based on whether reading Keychain succeeds. A locked, denied, or otherwise inaccessible Keychain therefore looks identical to a provider with no saved key. The footer and Settings direct the user to enter a key even when retrying Keychain access is the correct recovery.

### The timeout name and budget are misleading

The native sidecar runner uses a single PROBE_TIMEOUT for both package probes and real provider requests. The sidecar's provider timeout consumes most of that budget, leaving little allowance for process startup and IPC.

### Static configuration is duplicated

Provider IDs and model IDs are repeated in the renderer dropdown, TypeScript types, Keychain validation, native settings validation/defaults, and sidecar protocol. A future curated-list update can drift across these boundaries.

### Spike code remains in the product path

The sidecar previously exposed health and sdk-load, and Tauri could launch them through SLATE_SIDECAR_PROBE on application startup. Those paths were packaging-spike scaffolding and have now been removed from the product runtime.

## Implementation plan

### 1. Add a curated shared AI catalog

Files:

- Add shared/ai-catalog.json.
- Update src/lib/planner.ts.
- Add src/lib/ai-catalog.ts.
- Update src/routes/settings.tsx.
- Update src-tauri/src/credentials.rs.
- Update src-tauri/src/persistence.rs.
- Update src-tauri/src/ai.rs.
- Update sidecar/src/protocol.ts and sidecar/src/provider.ts.

Create one checked-in JSON catalog that defines:

- Provider IDs and display labels: vercel-gateway and openrouter.
- The curated global model IDs and display labels currently offered by Settings.
- The default provider/model pair.

Consume the catalog in each layer rather than maintaining separate literals:

- Renderer: typed Settings options and type guards.
- Rust: parse the catalog with include_str! and validate persisted/default settings and credential provider IDs from it.
- Sidecar: validate the provider/model request against the same catalog before choosing the explicit provider factory.

Provider execution stays explicit: the sidecar retains an exhaustive branch for OpenRouter and AI Gateway. The catalog controls allowed values; it does not introduce a generic provider abstraction, discovery, or fallback.

Add tests that prove every renderer-visible provider/model is accepted by the native and sidecar validation boundaries. Do not add a user-entered model field.

### 2. Remove planner task context from AI Assist

Files:

- Update src-tauri/src/persistence.rs.
- Update src-tauri/src/ai.rs.
- Update sidecar/src/protocol.ts.
- Update sidecar/src/assist.ts.
- Update related Rust and sidecar tests.

Change the Assist request input to capture, today, and scheduledDate only.

Implementation details:

1. Remove todayTasks from the Assist protocol schema and request DTO.
2. Simplify the native Assist context reader so it loads the selected provider, model, and local today date without loading, ordering, or truncating tasks.
3. Delete Assist-only task-context formatting from the prompt. Keep capture clearly delimited as user data and keep the explicit-date rule.
4. Remove the Assist test that expects Today commitments in context.
5. Add request-shape and prompt tests proving no task title, estimate, or planner instruction is included in an Assist request.
6. Leave Plan My Day context structs, candidate selection, capacity checks, and prompt unchanged.

### 3. Model Keychain availability explicitly

Files:

- Update src-tauri/src/credentials.rs.
- Update src-tauri/src/persistence.rs.
- Update src-tauri/src/ai.rs.
- Update src/lib/planner.ts.
- Update src/lib/settings-draft.ts and its tests.
- Update src/routes/settings.tsx.
- Update src/components/task-composer-footer.tsx.
- Update src/components/ai-review.tsx and src/components/ai-review-tray.tsx.

Replace the boolean credential check with an internal safe availability result:

- configured: a non-empty credential can be read.
- unconfigured: no Keychain item exists for the provider.
- unavailable: Keychain access failed for another reason.

Rules:

1. Only keyring Error::NoEntry becomes unconfigured.
2. Locked, denied, malformed, and other Keychain errors become unavailable with no raw native diagnostic exposed to the renderer.
3. Planner snapshots return only the safe status for each provider and the active provider. They never return Keychain metadata or error details.
4. AI commands map a missing key to unavailable-key and an inaccessible Keychain to a new safe credentials-unavailable category.
5. Settings shows Required for AI only for unconfigured. For unavailable, it shows concise Keychain-retry guidance without destructive missing-key styling.
6. The footer disables AI for both states. Missing-key tooltip opens Settings guidance; Keychain-unavailable tooltip and review state provide Retry.
7. Saving a key retains the current generic, non-secret save error if the Keychain write itself fails.

Add unit tests for NoEntry, a generic Keychain error, configured credentials, safe snapshot mapping, and renderer draft/footer state. Tests must use a fake or narrow credential boundary; automated tests must not write to a developer's Keychain.

### 4. Separate sidecar time budgets and error typing

Files:

- Update src-tauri/src/sidecar.rs.
- Update src-tauri/src/ai.rs.
- Update sidecar/src/assist.ts.
- Update sidecar/src/plan.ts.
- Update native and sidecar tests.

Introduce named, intentionally ordered limits:

- Provider SDK timeout: 12 seconds.
- Native AI process timeout: 16 seconds.
- Package/probe timeout: 10 seconds, for test tooling only if needed.

The exact constants may change after packaged-app measurement, but the native AI deadline must always exceed the SDK timeout by enough time for sidecar launch, JSON serialization, and process termination.

Implementation details:

1. Replace PROBE_TIMEOUT with a request deadline passed explicitly to the sidecar runner.
2. Return a small native SidecarFailure enum internally (timeout, spawn, write, malformed-output, non-zero-exit, and so on) instead of inspecting an error string for “timed out.”
3. Map only the timeout variant to the existing retryable timeout UI category; map other process failures to safe internal unless they already come from a validated sidecar error envelope.
4. Preserve output-size limits, one stdin request, one stdout response, no provider retries, child termination on failure, and no raw stderr propagation.
5. Add tests for timeout selection/mapping, non-zero exit, malformed output, oversized output, and child cleanup where testable without a live provider.

### 5. Delete packaging-spike runtime scaffolding

Files to remove:

- sidecar/src/sdk-load.ts.
- sidecar/src/sdk-load.test.ts.

Files to simplify:

- sidecar/src/protocol.ts.
- sidecar/src/main.ts.
- sidecar/src/protocol.test.ts.
- src-tauri/src/sidecar.rs.
- src-tauri/src/lib.rs.
- the historical sidecar plans 007 and 010.

Remove:

- The health and sdk-load operations and their response shapes.
- runSdkLoadProbe and its imports.
- SLATE_SIDECAR_PROBE and start_probe_if_requested.
- Native startup invocation of the probe.
- Probe-only native response parsing/tests that no longer serve Assist or Plan My Day.

Keep:

- The packaged sidecar build and staleness scripts.
- The sidecar's production assist and plan protocol validation.
- Production response limits, child-process cleanup, and safe error normalization.
- Existing sidecar operation tests.

Before deleting any other branch-added code, run a branch-only reference audit. Only remove code with no production or test caller. Specifically retain local-date, useSaveSettings, the repository update_settings helper used by the unified save command, and all Plan My Day context code.

### 6. Update documentation and acceptance coverage

Files:

- Update docs/ai-actions-brief.md.
- Update docs/product-brief.md only if its Assist-context wording requires it.
- Remove the historical packaging-spike plans after the branch-only reference audit.
- Update docs/plans/011-ai-assist-sidecar-vertical-slice.md.
- Update README.md if its configuration or verification wording changes.

Document:

- AI Assist's capture-first request contract.
- Curated static provider/model policy.
- Missing-key versus Keychain-unavailable recovery behavior.
- Production AI timeout boundaries.
- Removal of package-spike startup probes.

Mark the old probe behavior as historical rather than leaving it implied as a runtime requirement.

## Validation

Automated checks:

~~~
npm run build
npm --prefix sidecar test
node --experimental-strip-types --test src/lib/settings-draft.test.mjs
cargo test --manifest-path src-tauri/Cargo.toml
git diff --check
~~~

Release check:

~~~
npm run tauri -- build
~~~

Manual packaged-app acceptance:

1. AI Assist with a configured key produces a proposal without sending existing task titles or estimates to the provider.
2. AI Assist preserves an explicit Today date and can safely interpret a relative date using the local date.
3. Plan My Day still receives Today constraints and Backlog candidates, preserves current Today commitments, and accepts atomically.
4. A provider with no key keeps AI disabled and directs the user to Settings.
5. A Keychain access failure gives retry guidance rather than claiming the key is missing; manual task Save remains available.
6. A provider timeout reaches the retryable timeout state after the intended native deadline, with no lingering sidecar process.
7. Settings lists only the catalog's providers/models and persists each allowed choice.
8. Both configured providers work from the packaged application.
9. The compact 360 × 520 popover remains usable for Settings, unavailable/error states, AI Assist, and Plan My Day.

## Done criteria

- [x] AI Assist sends no task-list or planning-instruction context.
- [x] Plan My Day context and acceptance behavior are unchanged.
- [x] Missing credentials and inaccessible Keychain states are distinct, safe, and recoverable.
- [x] Provider SDK and native process timeouts are explicitly named, ordered, and tested.
- [x] The curated provider/model catalog has no renderer/native/sidecar drift.
- [x] Spike-only health, sdk-load, and environment startup-probe code is removed.
- [x] No other branch-added code is removed without proving it has no caller.
- [ ] Automated checks, packaged build, and the manual acceptance matrix pass.

## Planned at

Branch codex/ai-sidecar-packaging-spike, 2026-07-23.

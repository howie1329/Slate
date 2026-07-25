# Plan 016: Bound task context before sending it to the AI sidecar

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `docs/plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b5dbb37..HEAD -- src-tauri/src/persistence.rs docs/plans/README.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `b5dbb37`, 2026-07-23

## Why this matters

The SQLite task API accepts a non-empty title of any length, but the sidecar protocol rejects every contextual task title longer than 240 characters. One legal long Today task therefore prevents AI Assist from generating, and one legal long Backlog candidate can prevent Plan My Day from generating. The failure is particularly confusing because the native error mapper converts the sidecar's `invalid-request` result to the generic `internal` category. Bound only the display/context copy sent to the AI; preserve the original SQLite title so review, stale-plan validation, and user data remain exact.

## Current state

- `src-tauri/src/persistence.rs` owns SQLite reads and constructs native-authoritative AI context.
- `src-tauri/src/ai.rs` serializes that context to the sidecar and validates returned proposals.
- `sidecar/src/protocol.ts` is the strict process-boundary contract.

The sidecar applies a 240-character maximum to all task titles sent in AI requests (`sidecar/src/protocol.ts:16-21` and `37-44`):

```ts
const assistTaskContextSchema = z.object({
  id: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(240),
  estimateMinutes: z.number().int().positive().max(1440).nullable(),
  scheduledDate: localDateSchema.nullable(),
}).strict();
```

The persistence boundary does not impose the corresponding title maximum (`src-tauri/src/persistence.rs:1070-1078`):

```rust
fn validate_task_input(input: &TaskInput) -> Result<(), String> {
    if input.title.trim().is_empty() {
        return Err("Task title is required.".into());
    }
    if input.estimate_minutes.is_some_and(|minutes| minutes <= 0) {
        return Err("Task estimate must be a positive number of minutes.".into());
    }
    validate_scheduled_date(input.scheduled_date.as_deref())
}
```

It forwards full stored titles into both kinds of AI context (`src-tauri/src/persistence.rs:968-1004`):

```rust
title: task.title.clone(),
```

The native command sends that context unchanged (`src-tauri/src/ai.rs:203-218`), while unknown sidecar categories, including `invalid-request`, become `internal` (`src-tauri/src/ai.rs:481-491`).

Slate's product contract requires AI changes to remain reviewable and the native layer to own structured-result validation. The plan must preserve that: only the prompt-context representation is shortened; accepted task data and SQLite values must not be modified.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Native tests | `cargo test` from `src-tauri/` | 24 passing tests and the existing Keychain test remains ignored |
| Sidecar protocol tests | `npm --prefix sidecar test` | all tests pass |
| Renderer type/build check | `npm run build` | exits 0 after Vite and TypeScript complete |
| Diff check | `git diff --check` | no output and exit 0 |

## Scope

**In scope**:

- `src-tauri/src/persistence.rs` — production context projection and its existing unit-test module
- `docs/plans/README.md` — status row only

**Out of scope**:

- `sidecar/src/protocol.ts`. The 240-character protocol limit is intentional and remains the boundary contract.
- `src-tauri/src/ai.rs`. Do not weaken proposal validation or change generic error mapping as a substitute for making the outgoing context valid.
- Task creation, editing, SQLite migrations, and user-visible task title limits. Existing long titles must remain valid local data.
- The renderer, review tray, provider prompts, API-key storage, and sidecar byte-limit policy.

## Git workflow

- Branch: `codex/016-bound-ai-context-title-length`
- Use one focused commit after all validations pass. Match the repository's imperative commit style, for example: `Centralize provider credential and settings persistence`.
- Do not push or open a pull request unless the operator asks.

## Steps

### Step 1: Add a context-only title projection helper

In `src-tauri/src/persistence.rs`, define one small private helper adjacent to the AI-context functions or validation helpers. It must return the first 240 Unicode scalar values of a task title using `.chars().take(240).collect::<String>()`. Name the constant and helper for their single purpose, such as `MAX_AI_CONTEXT_TITLE_CHARS` and `ai_context_title`.

Do not trim, mutate, or persist the original task title. The helper exists only to ensure strings copied across the native-to-sidecar boundary satisfy the existing Zod schema.

**Verify**: `rg -n "MAX_AI_CONTEXT_TITLE_CHARS|ai_context_title|take\(MAX_AI_CONTEXT_TITLE_CHARS\)" src-tauri/src/persistence.rs` → finds exactly one bounded context helper and its use sites.

### Step 2: Apply the projection to both context builders

In `ordered_ai_context`, replace the direct `task.title.clone()` assignment with the helper. In `ordered_plan_context`, do the same replacement. Do not change task IDs, estimates, scheduled dates, source scopes, ordering positions, candidate eligibility, or the original title carried later through `AiPlanItem` and stale-plan acceptance.

This makes every task title placed in a Plan `todayTasks`/`candidates` payload conform to the sidecar's 240-character contract while preserving original local data for acceptance. AI Assist is capture-first and no longer copies task titles across the boundary.

**Verify**: `rg -n "title: task\.title\.clone\(\)" src-tauri/src/persistence.rs` → returns no context-builder assignments; inspect the two context builders to confirm both use the helper.

### Step 3: Add characterization tests for long stored titles

In the existing `#[cfg(test)] mod tests` in `src-tauri/src/persistence.rs`, add tests using a title with 241 characters:

1. Create a Today task with that title, call `ai_assist_context`, and assert the context title has exactly 240 characters while the task retrieved from `repository.tasks()` still has 241 characters.
2. Create an eligible unscheduled Backlog task with that title, call `ai_plan_context`, locate that candidate, and assert its context title has exactly 240 characters while the stored task still has 241 characters.

Use the existing `TestDatabase`, `create_task`, and `local_today` patterns in the same module. Do not use a live provider, Keychain credential, or sidecar process in these tests.

**Verify**: `cargo test` from `src-tauri/` → all native tests pass, including the two new long-title regressions.

### Step 4: Run cross-boundary regression gates and update plan status

Run the sidecar protocol suite to ensure its strict schema still passes expected requests, then run the root build. Finally, change only plan 016's status in `docs/plans/README.md` to `DONE`.

**Verify**: run `npm --prefix sidecar test`, `npm run build`, and `git diff --check` in that order → tests/build pass and the diff check emits no output.

## Test plan

- New Rust unit test: long stored Today title is safely bounded only in `AiAssistContext`.
- New Rust unit test: long stored Backlog title is safely bounded only in `AiPlanContext`.
- Both tests must assert the database's original title is unchanged; this guards against accidental user-data truncation.
- Follow existing context tests in `src-tauri/src/persistence.rs`, especially `ai_assist_context_includes_active_today_commitments` and `daily_plan_acceptance_appends_backlog_tasks_to_today`.
- Run `cargo test` from `src-tauri/`, `npm --prefix sidecar test`, and `npm run build`.

## Done criteria

- [ ] All task titles sent in Assist and Plan context are at most 240 Unicode scalar values.
- [ ] Existing stored titles longer than 240 characters remain unchanged in SQLite.
- [ ] Both new long-title regression tests pass under `cargo test`.
- [ ] `npm --prefix sidecar test` passes.
- [ ] `npm run build` exits 0.
- [ ] `git diff --check` produces no output.
- [ ] No files outside the in-scope list are modified.
- [ ] Plan 016 is marked `DONE` in `docs/plans/README.md`.

## STOP conditions

Stop and report instead of improvising if:

- The live sidecar contract no longer limits contextual titles to 240 characters.
- The code path that builds `AiPlanItem` is found to reuse the shortened context title rather than the original SQLite title; preserving stale-plan equality would need a different design.
- A valid local title can be empty after the proposed context projection.
- The fix appears to require a SQLite schema migration, a user-visible title limit, or a change to the sidecar protocol.

## Maintenance notes

- If a new sidecar operation sends task titles, it must use the same bounded context projection before serialization.
- Reviewers should check that truncation happens only at the prompt boundary and does not leak into task updates, proposal acceptance, snapshots, or UI state.
- API-key and total-request-byte limits are intentionally deferred; this plan fixes the demonstrated mismatch in persisted task titles without broadening credential policy.

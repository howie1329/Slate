# Plan 019: Fix long-title Plan My Day acceptance

## Objective

Allow Plan My Day proposals containing task titles longer than 240 characters to be accepted without weakening stale-plan validation.

The native layer must preserve the full SQLite title for review and acceptance while sending only the existing 240-character projection to the AI sidecar.

## Root cause

`ordered_plan_context` currently stores only the truncated provider-context title in `AiPlanTaskContext`. When the sidecar returns a selected task ID, `parse_plan_response` reuses that truncated title in the review proposal. Acceptance then compares the truncated proposal title against the full SQLite title and rejects the unchanged task as `stale-plan`.

The title has three distinct roles that must not share one lossy representation:

1. Provider context: bounded to 240 Unicode scalar values.
2. Review proposal: the complete user-visible title.
3. Acceptance snapshot: the complete title compared with SQLite for stale detection.

## Scope

### In scope

- `src-tauri/src/persistence.rs`
  - Preserve both the full title and bounded provider-context title for Plan My Day candidates.
  - Add persistence-level regression coverage for accepting a long-title task.
- `src-tauri/src/ai.rs`
  - Send only the bounded title to the sidecar.
  - Build the native proposal from the full title.
  - Add request and proposal-mapping regression coverage.

### Out of scope

- SQLite migrations or a user-visible task-title limit.
- Changes to `sidecar/src/protocol.ts` or its 240-character title boundary.
- Renderer, review-tray, or TypeScript contract changes.
- Removing title equality from stale-plan validation.
- Changes to candidate eligibility, ordering, capacity calculations, or atomic acceptance.

## Implementation steps

### 1. Separate full and provider-context titles

In `src-tauri/src/persistence.rs`, extend `AiPlanTaskContext` with two explicit representations:

- `title`: the complete title read from SQLite.
- `context_title`: the first 240 Unicode scalar values, produced by the existing `ai_context_title` helper.

Update `ordered_plan_context` to populate both fields:

- Copy `task.title` unchanged into `title`.
- Apply `ai_context_title(&task.title)` only to `context_title`.

Keep Today-task provider context bounded as it is today. Do not trim, modify, or persist the original title.

### 2. Keep the sidecar payload bounded

In `src-tauri/src/ai.rs`, map `AiPlanTaskContext.context_title` to `PlanCandidate.title` when constructing the sidecar request.

Do not serialize the complete title into the provider request. Leave the sidecar schema and its 240-character maximum unchanged.

Prefer a small explicit conversion helper if it makes the distinction testable without duplicating request-building logic.

### 3. Build proposals from the full native snapshot

In `parse_plan_response`, continue resolving provider-selected task IDs against the native candidate list, but populate `AiPlanItem.title` from the complete `candidate.title`.

The resulting review proposal and acceptance payload will carry the exact SQLite snapshot. Keep the existing native equality check so a title genuinely changed after generation still rejects the entire proposal as stale.

### 4. Add regression tests

Update the existing long-title context test in `src-tauri/src/persistence.rs` to assert:

- `context_title` contains exactly 240 Unicode scalar values.
- `title` contains the complete stored value.
- The SQLite task remains unchanged.

Add a persistence acceptance test that:

1. Creates an eligible Backlog task with a title longer than 240 characters.
2. Builds the Plan My Day context.
3. Accepts the task using the full candidate title.
4. Confirms acceptance succeeds, the complete title remains unchanged, and the task moves to Today.

Add AI-boundary tests in `src-tauri/src/ai.rs` proving:

- The serialized Plan candidate contains only the bounded context title.
- A returned candidate ID produces an `AiPlanItem` containing the complete title.

Use a multibyte Unicode title in at least one test so the regression verifies character-count truncation rather than byte-count truncation.

Retain the existing stale-title test to prove that changing a task title after proposal generation still returns `stale-plan` and performs no writes.

## Validation

Run these commands in order:

```sh
cd src-tauri && cargo test
npm --prefix sidecar test
npm run build
git diff --check
```

Expected results:

- All native tests pass, including long-title proposal and acceptance regressions.
- The sidecar protocol suite continues enforcing its existing request boundary.
- The renderer builds and type-checks without contract changes.
- `git diff --check` emits no output.

## Done criteria

- [ ] Plan My Day sends at most 240 Unicode scalar values per task title to the sidecar.
- [ ] A selected task's proposal contains its complete SQLite title.
- [ ] An unchanged task with a title longer than 240 characters can be accepted.
- [ ] The complete title remains unchanged in SQLite and appears unchanged in Today.
- [ ] A task whose title changes after generation is still rejected atomically as stale.
- [ ] No renderer, sidecar protocol, schema migration, or user-visible title-limit changes are introduced.
- [ ] Native tests, sidecar tests, the root build, and the diff check pass.

## Source guidance

- `AGENTS.md`
- `CODE-QUALITY.md`
- `docs/product-brief.md`
- `docs/ai-actions-brief.md`
- `docs/plans/012-plan-my-day-sidecar-vertical-slice.md`
- `docs/plans/016-bound-ai-context-title-length.md`

# Plan 031: Deepen the planning workspace boundary

> **Executor instructions:** Implement this as a behavior-preserving architecture change. Move planning semantics behind one native boundary before deleting compatibility paths. Do not ship a state where renderer and native classification remain competing authorities.

## Status

- **Implementation status:** Complete
- **Parent:** Plan 026 — Unified Daily workspace
- **Follows:** Plan 030 — Daily workspace polish and cleanup
- **Priority:** P1 architecture / domain integrity
- **Effort:** L
- **Risk:** HIGH — the planner snapshot, every task mutation, scoped ordering, capacity, and AI planning context are affected
- **Planned at:** 2026-08-09

## Objective

Make one native, SQLite-backed planning module authoritative for:

1. Today and Backlog classification.
2. Active and completed task ordering.
3. Capacity, unsized commitments, overage, and overflow selection.
4. Order reconciliation after task lifecycle changes.
5. Revision-safe reordering and accepted-plan mutations.
6. AI Today identity, candidate eligibility, candidate ordering, and remaining capacity.

The renderer should receive a complete semantic projection and expose it through a small caller-oriented hook. It should retain only presentation concerns such as local search, badge copy and tone, animation, optimistic feedback, and query-cache reconciliation.

This plan does not change user-visible planning behavior. It deepens the module boundary underneath the shipped Daily workspace.

## Problem

Planning semantics are currently split between renderer selectors and native persistence helpers.

The renderer derives the Daily workspace from raw tasks and `orderByScope`, constructs scope strings for reordering, gathers revision preconditions, and calculates capacity. The native layer independently classifies tasks to maintain order rows, validate movements, build AI context, and accept plans atomically.

These implementations co-own one product concept:

- Today membership, including the rule that Today wins for an unsized task scheduled today.
- Backlog classification into needs-estimate, overdue, upcoming, and unscheduled scopes.
- Backlog display precedence.
- Stored active ordering and deterministic fallback ordering.
- Completed ordering.
- Capacity contribution, unsized counts, overage, and overflow-task identity.
- Destination placement after create, update, scheduling, completion, reopen, and accepted plans.
- AI planning eligibility and stale-plan identity.

The duplication creates correctness and maintenance risk. A rule change must be synchronized across languages, persistence scope keys leak into presentation code, and existing tests characterize helpers without proving that rendered state, mutations, and AI context share one definition.

## Product invariants

- SQLite remains the local source of truth.
- Today and Backlog remain derived concepts; do not add a persistent task-status field.
- An incomplete task scheduled for the current local date belongs to Today even when its estimate is null.
- Unsized Today tasks remain visible, consume no known capacity, and remain part of stale-plan identity.
- Backlog display order remains needs estimate, overdue, upcoming, then unscheduled.
- Plan My Day considers only eligible estimated Backlog tasks under the existing product contract.
- Completed ordering remains distinct from active scoped ordering.
- Existing revision checks, Planner Events, atomic acceptance, cross-window refresh, Keychain boundaries, and review-before-commit behavior remain intact.
- The compact popover and full window continue to render the same Daily workspace behavior.

## Proposed architecture

### Native planning module

Create one Rust-owned `PlanningWorkspace` over facts loaded from the active SQLite connection and an explicit local date. Its mutation operation receives the caller's active transaction so planning-order changes remain atomic with task revisions and Planner Events:

```rust
pub(crate) struct PlanningWorkspace<'a> {
    tasks: &'a [Task],
    order_by_scope: &'a HashMap<String, Vec<String>>,
    today: &'a str,
    effective_capacity_minutes: i64,
}

impl PlanningWorkspace<'_> {
    pub fn view(&self) -> PlanningView;

    pub fn apply(
        transaction: &Transaction<'_>,
        command: PlanningCommand,
    ) -> Result<(), String>;

    pub fn plan_context(&self) -> PlanningContext;
}
```

Keep the public native surface limited to these three operations. Private helpers may classify tasks, load order records, build an internal planning state, reconcile scopes, write events, and construct projections without becoming caller contracts.

`PlanningCommand` owns every accepted operation that can affect planning membership or order:

```rust
pub enum PlanningCommand<'a> {
    CreateTask,
    DeleteTask { task_id: &'a str },
    ReconcileTask {
        task_id: &'a str,
        previous_scope: &'a str,
        destination_scope: &'a str,
        active_before: bool,
        active_after: bool,
    },
    ReplaceOrder { scope: &'a str, task_ids: &'a [String] },
}
```

Each command must read current state, validate revisions and membership, mutate task and order data, increment revisions, and write Planner Events in one SQLite transaction where the existing contract requires those effects.

Existing Tauri command names remain transport adapters during the migration. They deserialize command-specific DTOs, invoke `PlanningWorkspace::apply`, emit the existing refresh event after a successful commit, and map stable errors. They must not retain planning classification or ordering rules.

### Authoritative planning projection

Add `planning: PlanningView` to `PlannerSnapshot`.

```ts
type PlanningView = {
  today: {
    active: TaskSection;
    completed: PlanningTask[];
    capacity: CapacityView;
    unsizedTaskCount: number;
    totalTaskCount: number;
  };
  backlog: {
    active: TaskSection;
    completed: PlanningTask[];
    activeTaskCount: number;
    totalTaskCount: number;
  };
};

type TaskSection = {
  tasks: PlanningTask[];
  reorder: ReorderGuard;
};

type PlanningTask = Task & {
  badges: WorkspaceBadge[];
};
```

The projection is exhaustive for tasks displayed or edited by the current workspace. Semantic badges may include needs-estimate, unscheduled, overdue, and upcoming. User-facing label text, tone, accessibility copy, and visual treatment remain renderer concerns.

The reorder guard is opaque to the renderer. It carries the authoritative scope, date, membership, and task revisions required to validate a reorder. Renderer code echoes the guard but does not construct or interpret persistence scope keys.

After all consumers migrate:

- Remove `orderByScope` from the renderer contract.
- Remove renderer-derived `effectiveCapacityMinutes` in favor of the projected capacity limit.
- Remove the top-level raw task list if task detail and selection can read from the exhaustive projection without creating a second task source.
- Remove renderer helpers that independently classify, order, or calculate capacity.

### Renderer adapter

Expose one deliberately thin hook for the common Daily workspace caller:

```ts
type DailyWorkspaceController = {
  view: FilteredPlanningView;
  reorderToday(taskIds: string[]): void;
  isReordering: boolean;
};

function useDailyWorkspace(query: string): DailyWorkspaceController;
```

The hook may own:

- Local title filtering over already ordered sections.
- `hasQuery` and `hasMatches` presentation state.
- Semantic badge conversion to label and tone.
- Optimistic reorder presentation and rollback.
- Query invalidation, authoritative reconciliation, and pending state.

The hook must not own:

- Today or Backlog classification.
- Active or completed ordering rules.
- Capacity or overflow calculation.
- Scope strings or ordering membership.
- Revision-guard construction.
- AI eligibility or stale-plan identity.

Do not add Daily-specific snapshot commands alongside the existing planner snapshot. Reuse the current query and planner-change event architecture.

## Internal ownership

The native planning module hides:

- Priority-sensitive scope classification.
- Stored-order lookup and deterministic fallback order.
- Completed-task order.
- Destination-scope placement and obsolete order-row cleanup.
- Capacity accumulation, unsized behavior, remaining minutes, overage, and overflow selection.
- Reorder uniqueness, exact membership, date, and revision validation.
- Atomic task, order, revision, and event-history writes.
- AI Today task identity, candidate source scopes, candidate order, bounded context, and remaining capacity.
- Accepted-plan stale guards and atomic application.

Settings persistence, credential access, sidecar execution, provider calls, Tauri event transport, and platform window behavior remain outside this module.

## Dependency strategy

This is a **local-substitutable** boundary.

Production uses the existing local SQLite database. Boundary tests use the real schema and transactions in a temporary or in-memory SQLite database with a fixed local date. Do not introduce a repository trait or mocked persistence implementation; SQLite constraints, order rows, revisions, and transactions are behavior that must be exercised.

AI providers and Keychain access remain outside the planning module. `plan_context()` produces deterministic provider-ready facts without external I/O.

## Implementation sequence

### Phase 1: Characterize the boundary

- Add a fixed-date temporary SQLite fixture around the proposed module boundary.
- Capture current classification, ordering, capacity, mutation, and AI-context behavior before moving implementation.
- Record stable planning error categories needed by the renderer and Tauri adapters.

### Phase 2: Introduce the native read model

- Add the private planning state and `view()` implementation.
- Build `PlanningView` from the same task and order facts used by native persistence.
- Add `planning` to `PlannerSnapshot` while retaining compatibility fields temporarily.
- Compare the native projection with the existing renderer selector in characterization tests during migration.

### Phase 3: Migrate the renderer

- Add `useDailyWorkspace(query)` over `planner.planning`.
- Migrate Daily rendering, task selection, task detail lookup, capacity, badges, and reorder guards.
- Preserve local filtering, motion, compact layout, and query-cache behavior.
- Stop reading raw scope maps in renderer code.

### Phase 4: Centralize mutations

- Route create, update, completion, scheduling, deletion, and reordering through `apply()`.
- Move scope reconciliation, destination placement, revision changes, and Planner Event writes behind the module.
- Preserve existing Tauri command names as thin adapters.
- Ensure notification failure is not confused with transaction failure or retried as a duplicate mutation.

### Phase 5: Centralize AI planning facts

- Build AI Today identity, candidates, capacity, and stale guards through `plan_context()`.
- Route accepted plans through `PlanningCommand::AcceptPlan`.
- Preserve reviewability, bounded context, provider orchestration, and atomic stale rejection.

### Phase 6: Remove compatibility paths

- Remove renderer classification, ordering, and capacity helpers.
- Remove native helpers superseded by the planning module.
- Remove `orderByScope` and duplicated capacity fields from IPC.
- Remove the raw top-level task list only after every task consumer uses the exhaustive projection.
- Delete redundant helper-level tests after equivalent boundary tests pass.
- Update architecture and domain documentation to identify the native planning module as authoritative.

## Test plan

### Native boundary tests

- Unsized Today tasks remain in Today, consume no capacity, and remain in stale-plan identity.
- Backlog classification and display precedence match the current product contract.
- Active and completed ordering remain deterministic.
- Create, update, schedule, complete, reopen, delete, reorder, and accepted-plan operations reconcile scopes atomically.
- Tasks entering a destination scope receive the defined position.
- Reorder rejects duplicate IDs, changed membership, stale dates, and stale revisions without partial writes.
- Capacity, overage, remaining minutes, and overflow identity use authoritative Today order.
- AI candidates remain eligible, correctly ordered, bounded, and constrained by the same remaining capacity as the renderer projection.
- Accepted plans reject changed Today membership, revisions, capacity, or candidate facts atomically.
- Reopening the database preserves the observable projection and ordering.

### Renderer tests

- Local query filtering preserves native order and projected metadata.
- Badge codes map to the correct accessible copy and tone.
- Reordering is unavailable while filtered.
- Optimistic reorder rolls back and refreshes after stale or persistence failures.
- Native planner-change events reconcile the same authoritative projection across windows.

### Tests to replace

Once equivalent boundary coverage exists, delete or collapse tests that independently characterize:

- Renderer scope classification, active ordering, completed ordering, and capacity calculation.
- Native scope, order, and AI-context helpers now private to the module.
- Repository mutation tests fully superseded by `apply()` plus `view()` assertions.

Retain migration tests, platform-adapter tests, sidecar protocol and resource-limit tests, and focused transport serialization tests where they protect a real boundary.

## Acceptance criteria

- [x] One native module is the sole owner of planning classification, ordering, capacity, scope reconciliation, and AI planning facts.
- [x] `PlannerSnapshot` exposes an authoritative `PlanningView` consumed by the Daily workspace.
- [x] The renderer no longer constructs or interprets persistence scope keys.
- [x] Every scope-affecting mutation passes through `PlanningWorkspace::apply` and remains atomic with revisions, ordering, and Planner Events.
- [x] Plan My Day generation and acceptance use the same planning state as the renderer projection.
- [x] `useDailyWorkspace(query)` contains presentation behavior only.
- [x] Compatibility fields and duplicated helpers are removed after all consumers migrate.
- [x] Boundary tests replace redundant shallow tests instead of layering duplicate coverage.
- [x] No persistent task status, generic projection DSL, repository trait, or new renderer test framework is introduced.
- [x] The compact popover and full window preserve current behavior at their supported sizes.
- [x] `npm run build` passes.
- [x] `cargo test --manifest-path src-tauri/Cargo.toml` passes.
- [x] Route generation output is not hand-edited.
- [x] The final diff contains no unrelated dependency, permission, credential, or product-scope changes.

## Out of scope

- User-visible Daily workspace redesign.
- New task states, scopes, statuses, priorities, tags, projects, or sections.
- A generic predicate DSL or configurable projection engine.
- Calendar or time-blocking behavior.
- New AI provider behavior or autonomous plan acceptance.
- Settings, Keychain, shortcut, window, or sidecar architecture changes unrelated to consuming planning facts.
- Cloud sync, collaboration, integrations, mobile, or external task sources.

## Handoff expectations

The implementation handoff must identify the user-visible behavior preserved, the native and renderer boundaries migrated, compatibility paths removed, old tests replaced, validation commands run, and any intentionally deferred cleanup. If implementation must pause before compatibility paths are removed, keep the old path explicitly marked and do not describe the native module as authoritative yet.

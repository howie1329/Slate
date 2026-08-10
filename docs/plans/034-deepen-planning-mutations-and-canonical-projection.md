# Plan 034: Deepen Planning mutations and canonicalize the projection

> **Status:** Complete
>
> **Parents:** Plan 031 — Planning workspace boundary; Plan 033 — Authoritative Planning lane projection
>
> **Type:** Behavior-preserving architecture hardening

## Problem Statement

Slate users expect the Daily workspace and the full Planning workspace to show the same tasks, Lane order, capacity, and movement results at all times. The current implementation derives the correct Planning lanes natively, but mutation behavior remains split between the Planning workspace module and persistence callers. Callers still calculate persistence scopes, coordinate task writes and revisions, select Planner Event kinds, reconcile ordering, and repeat accepted-plan checks.

The planner snapshot also publishes the same task state twice: once as the exhaustive Capture, Ready, Today, and Done lanes, and again as Today and Backlog compatibility sections. Daily and Board callers read different representations. That duplication increases the chance of inconsistent cache updates and currently makes optimistic reordering unsafe outside Today.

The result is architectural friction rather than a new product capability: planning rules have weak locality, callers must understand too much of the implementation, and tests do not have one authoritative seam that proves facts, Lane order, capacity, revisions, and Planner Events change together.

## Solution

Deepen the existing native Planning workspace module so accepted planning mutations are fully applied and verified through its SQLite-backed seam. Persistence and Tauri code remain adapters: they translate transport input, open the transaction, invoke the Planning workspace module, commit successful work, and emit the existing refresh event.

Make the exhaustive Capture, Ready, Today, and Done lane projection the only authoritative planning representation in the planner snapshot. Migrate the Daily workspace to reshape that projection in the renderer without recreating commitment rules, then remove the duplicated Today and Backlog compatibility sections.

This work preserves the current user-visible workflow. It improves consistency across Daily and Planning views, keeps mutations atomic and revision-safe, and ensures all ordered lanes reconcile through the same canonical projection.

## User Stories

1. As a Slate user, I want the Daily workspace and Planning workspace to show the same task membership, so that I can trust either surface.
2. As a Slate user, I want Capture, Ready, Today, and Done to remain derived from task facts, so that Slate does not introduce a hidden stored status.
3. As a Slate user, I want moving a task to Today to update its facts, Lane order, revision, and history atomically, so that a partial commitment cannot be saved.
4. As a Slate user, I want returning a task from Today to place it in the correct active Lane, so that the task remains available without losing its planning context.
5. As a Slate user, I want an unsized task to remain eligible for a deliberate Today commitment, so that I can commit work before estimating it.
6. As a Slate user, I want an unsized Today commitment to leave known capacity unchanged, so that Slate never invents a duration.
7. As a Slate user, I want Ready to continue requiring an estimate, so that readiness retains its current meaning.
8. As a Slate user, I want completing a task to move it to Done while retaining its estimate and date, so that completed history stays accurate.
9. As a Slate user, I want reopening a task to rederive its active Lane from retained facts, so that Slate does not restore a stale remembered Lane.
10. As a Slate user, I want deleting a task to remove obsolete order data in the same transaction, so that deleted work cannot affect later ordering.
11. As a Slate user, I want Capture, Ready, and Today ordering to persist independently, so that organizing one Lane does not disturb another.
12. As a Slate user, I want Board reordering to update the visible target Lane immediately and safely, so that drag-and-drop feedback matches the saved result.
13. As a Slate user, I want a failed or stale reorder to restore the last authoritative state, so that optimistic feedback cannot corrupt the visible plan.
14. As a Slate user, I want stale task changes to be rejected without partial writes, so that edits from another window are never overwritten silently.
15. As a Slate user, I want capacity and overflow identity to be calculated from the same ordered Today lane shown on screen, so that the capacity display remains explainable.
16. As a Slate user, I want Plan My Day to use the same Ready and Today facts as the manual workspace, so that AI proposals cannot disagree with manual planning.
17. As a Slate user, I want accepting a Plan My Day proposal to remain all-or-nothing, so that stale or over-capacity proposals cannot partially commit tasks.
18. As a Slate user, I want future-dated Ready work to remain visible but ineligible for Plan My Day, so that date context keeps its current meaning.
19. As a Slate user, I want opening Slate on a new local day to rederive Lane membership without silently changing task facts, so that unfinished work remains honest.
20. As a Slate user, I want planner changes in one window to refresh every other window, so that the popover and full app converge on the same local state.
21. As a Slate user, I want all manual planning behavior to remain available offline, so that architectural changes do not weaken Slate's local-first contract.
22. As a Slate user, I want existing task titles, estimates, dates, completion state, and history to survive this migration unchanged, so that the refactor is behavior-preserving.
23. As a Slate user, I want search and presentation filters to affect visibility only, so that they never change Lane membership or persisted order.
24. As a Slate user, I want errors to retain their current understandable behavior, so that a deeper implementation does not expose native persistence details.

## Implementation Decisions

- The native Planning workspace module is the authoritative module for Planning projection and accepted Planning mutations.
- The highest test seam is the Planning workspace module running against the real schema in a temporary or in-memory SQLite database with an explicit local date.
- Production and tests use SQLite adapters. Do not add a repository trait, mocked database, or speculative persistence seam.
- Persistence and Tauri modules remain adapters. They may deserialize transport input, acquire the connection, create a transaction, invoke the Planning workspace module, commit, map stable errors, and emit the existing planner-change event. They must not derive Lane scopes or duplicate planning rules.
- The Planning mutation implementation owns task-fact writes, expected-revision validation, active Lane derivation, Lane-order reconciliation, task revision increments, Planner Event selection and insertion, and transaction-level invariants.
- Accepted Plan My Day validation uses the same Planning implementation for Today identity, Ready candidate eligibility, candidate order, remaining capacity, and stale checks. Persistence must not recompute those facts independently with separate queries.
- Planning commands express semantic intent and expected state. Persistence scope strings, previous/destination scopes, and active-before/active-after flags become private implementation details rather than caller knowledge.
- Create, edit, schedule, complete, reopen, delete, reorder, and accepted-plan paths all cross the same Planning workspace seam before commit.
- Every accepted mutation preserves the existing Planner Event kind, source, operation grouping, before/after facts, and revision behavior.
- The planner snapshot publishes one authoritative exhaustive projection: Capture, Ready, Today, and Done, their counts, their ordered tasks, their reorder guards where applicable, and Today capacity.
- The duplicated Today and Backlog compatibility sections are removed only after every renderer consumer has migrated. Do not ship an intermediate state with two independently maintained authorities.
- The Daily workspace uses a renderer adapter that reshapes the canonical lanes into its flat Today and Backlog presentation. Capture precedes Ready in Daily Backlog. The adapter may filter and format metadata but must not reclassify tasks, recalculate capacity, construct persistence scopes, or interpret reorder guards.
- Board and Daily task lookup use the same canonical task set. A task appears exactly once in the exhaustive projection.
- Reorder guards remain opaque native validation data. Renderer cache reconciliation also receives the semantic target Lane as presentation context, so it can update the correct canonical Lane without parsing a persistence scope.
- Optimistic reordering is supported consistently for Capture, Ready, and Today. Success converges on the next native snapshot; failure restores the previous snapshot; settlement refreshes authoritative state.
- Search, filter, and alternate sort modes remain presentation-only. Persisted reordering remains available only when the caller is displaying canonical Planning order.
- The explicit local date continues to enter at the outer native seam. No broad clock abstraction is introduced.
- Today continues to outrank estimate readiness, preserving unsized commitments. Done continues to outrank every active Lane. Reopen continues to derive the destination from retained estimate and scheduled date facts.
- Lane order remains shared by Planning views and Daily. Date metadata does not create hidden order groups.
- SQLite remains the local source of truth. This work requires no schema migration and adds no persistent status field.
- The transport command names and cross-window refresh event remain stable unless a smaller semantic input is required to remove persistence-scope knowledge. Any transport change must remain additive during renderer migration and remove the old path in the same plan.
- Existing raw compatibility helpers and exported scope helpers are deleted after callers migrate. Do not retain pass-through modules or duplicate representations as fallbacks.
- Documentation describing Plans 031 and 033 as complete foundations must be updated at handoff to distinguish their shipped read projection from this final write-depth and renderer migration slice.

## Testing Decisions

- Good tests assert observable planning behavior through the highest seam: serialized Lane membership and order, persisted task facts, revisions, capacity, reorder guards, AI planning facts, Planner Events, and transaction rollback. They do not assert private helper names, SQL statement shape, collection types, or persistence scope strings.
- Native Planning workspace tests use a real temporary or in-memory SQLite database initialized through the normal schema path and an explicit fixed local date.
- Characterization coverage is written before moving mutation ownership. Existing persistence behavior for create, update, scheduling, completion, reopen, delete, reorder, and accepted plans is the prior art.
- Mutation coverage verifies that task facts, revision increments, order reconciliation, and Planner Events commit together and roll back together.
- Classification coverage includes completed work, sized and unsized Today commitments, estimated and unestimated Backlog work, overdue work, future-dated work, unscheduled work, and deleted-task absence.
- Movement coverage includes Capture to Today, Capture to Ready after estimation, Ready to Capture, Ready to Today, Today to Capture, Today to Ready, completion, and reopen into Capture, Ready, or Today as current facts require.
- Ordering coverage includes independent Capture, Ready, and Today order; entry position after movement; exact membership; deterministic fallback; deletion cleanup; and persistence after database reopen.
- Stale coverage includes changed task revisions, changed Lane membership, duplicate task IDs, stale reorder guards, stale local date, stale Plan My Day facts, and changed capacity. Every rejection must leave tasks, order rows, and Planner Events unchanged.
- Day-boundary coverage loads unchanged stored facts with consecutive local dates and verifies rederived Lane membership, retained dates, stable active Lane order, no task revision changes, and no synthetic Planner Events.
- Capacity coverage verifies sized commitment totals, unsized commitment behavior, overage, overflow-task identity, completion, reopening, and movement into or out of Today.
- AI coverage verifies that Plan My Day reads candidates from canonical Ready order, excludes future-dated and unsized tasks, preserves existing Today commitments, and accepts valid changes atomically.
- Projection coverage verifies exhaustiveness: every non-deleted task appears exactly once across Capture, Ready, Today, and Done; counts match membership; and no compatibility Today/Backlog representation remains in the serialized contract.
- Daily adapter tests verify that Today maps from the canonical Today lane, Backlog is Capture followed by Ready, completed history remains correct for the compact surface, search only changes visibility, and metadata remains presentation-only.
- Renderer cache tests exercise optimistic reorder success, rollback, and authoritative refresh separately for Capture, Ready, and Today. These tests use an in-memory query cache and do not recreate native Lane rules.
- Existing pure renderer tests that rederive Planning Lane membership are deleted or rewritten to exercise presentation behavior over authoritative lane fixtures.
- Native adapter tests retain serialization, stable error mapping, transaction commit, and planner-change emission coverage without duplicating Planning implementation tests.
- Validation includes the native Rust test suite and `npm run build`. The repository still has no standard JavaScript test script; focused Node test files may be run directly when added or changed.

## Out of Scope

- User-visible changes to Board, List, Daily workspace, toolbar, Task inspector, or animation design.
- A persistent Planning status or Lane column.
- New Planning lanes, custom workflows, projects, subtasks, dependencies, tags, priorities, or assignees.
- Cross-lane destination-index redesign beyond preserving current movement and order semantics.
- Multi-select, batch movement, Fit into Today, Make This Fit, Focus mode, horizon views, or Needs Attention expansion.
- Changes to Plan My Day product eligibility, prompting, provider behavior, or review-before-commit requirements.
- New SQLite tables, columns, migrations, repositories, or database abstractions.
- Cloud sync, accounts, mobile, integrations, MCP, or network-backed planning state.
- Keychain, sidecar transport, credential, native window, shortcut, or quick-capture changes.
- Reworking the Workspace inspector or consolidating the two current task-editing presentations; that is a separate architecture candidate.
- General persistence decomposition outside Planning ownership.

## Further Notes

- This plan closes implementation drift discovered after Plans 031 and 033: the native read projection is deep, but write orchestration and compatibility output remain distributed.
- ADR-0001 remains authoritative: Daily is a derived presentation of task facts, not a separate planning model.
- ADR-0002 remains authoritative: an unsized task may be deliberately committed to Today and contributes no guessed minutes.
- The sequence matters: characterize current behavior, deepen native writes, migrate renderer consumers to canonical lanes, make optimistic reorder lane-safe, remove compatibility output and exported scope knowledge, then run the full validation set.
- If the native Planning workspace interface cannot absorb event selection without coupling to transport-only concerns, keep transport emission outside but retain event facts and insertion inside the SQLite transaction. Do not split atomic planning history from the accepted mutation.

## Comments

- Implemented on 2026-08-10. The native Planning workspace module now owns semantic Lane reconciliation, reorder validation and revision updates, Today acceptance facts, and task Planner Event insertion through a real SQLite seam. The renderer consumes one exhaustive lane projection, derives the Daily presentation locally, and reconciles optimistic ordering against the explicit target Lane.

# Plan 033: Build the authoritative Planning lane projection

> **Status:** Implemented; historical implementation record
>
> **Parent:** Stage 3 — Full-window planning workspace, 2.0 foundation
>
> **Scope:** Original backend-only slice; later plans now provide Planning UI and cross-lane interaction

> **Current-tree note:** The authoritative four-lane projection, shared ordering, migration, and compatibility boundary described here are implemented. Plan 034 deepened the mutation seam, and Plans 035–038 added the current Board/List, inspector, and Task finder surfaces. The deferred UI language below describes the original slice boundary, not the current tree.

## Problem Statement

Slate's native Planning projection currently exposes Today and a flat Backlog assembled from hidden Needs estimate, Overdue, Upcoming, and Unscheduled persistence scopes. That contract is authoritative for the Daily workspace, but it cannot yet supply the Stage 3 Board and List with one exhaustive Capture / Ready / Today / Done interpretation or one shared user-controlled order per visible lane.

Building Board and List directly over the current shape would force renderer code to reclassify tasks, combine incompatible scope orders, and decide edge cases such as unsized Today commitments, future-dated work, completed history, reopening, and local midnight. Different Slate surfaces could then disagree about the same task. The user needs the complete native lane contract established before any Planning workspace UI is built.

## Solution

Extend the existing native Planning workspace boundary so every non-deleted task belongs to exactly one derived **Planning lane**: Capture, Ready, Today, or Done. Membership follows one explicit precedence: completed work is Done; active work dated today is Today even when unsized; remaining active unsized work is Capture; remaining active estimated work is Ready.

Create one user-controlled **Lane order** for Capture, Ready, and Today. Board, List, and the Daily workspace's flat Backlog consume those same authoritative orders. Date meaning remains task metadata rather than hidden ordering groups. Done is ordered by completion recency and has no manual order.

Publish the lane projection through the existing planner snapshot boundary while keeping the current renderer operational until its later UI migration. Both compatibility output and lane output must be composed from one internal planning state; they must not become competing classification implementations.

Use a forward SQLite migration to translate existing order records into the canonical Capture and Ready orders without adding a persistent task-status field. Keep the task facts, capacity model, event history, stale-state rules, and Plan My Day eligibility intact.

## User Stories

1. As a Slate user, I want every task to have one understandable Planning lane, so that Board and List never disagree about where it belongs.
2. As a Slate user, I want lane membership derived from task facts, so that Slate does not create a second hidden workflow status.
3. As a Slate user, I want completed work to belong to Done, so that completion has one consistent meaning across Planning views.
4. As a Slate user, I want an active task dated today to belong to Today, so that explicit current-day commitments remain visible.
5. As a Slate user, I want an unsized task dated today to remain in Today, so that committing work does not require Slate to invent an estimate.
6. As a Slate user, I want an active unestimated task outside Today to belong to Capture, so that work needing clarification has a clear home.
7. As a Slate user, I want Capture to include older unestimated work as well as new captures, so that the lane represents readiness rather than recency.
8. As a Slate user, I want an active estimated task outside Today to belong to Ready, so that work I could manually commit is easy to find.
9. As a Slate user, I want unscheduled estimated work in Ready, so that a missing date does not prevent deliberate planning.
10. As a Slate user, I want overdue estimated work in Ready with Overdue context, so that Slate does not silently roll it into Today.
11. As a Slate user, I want future-dated estimated work in Ready with Upcoming context, so that its date remains visible without creating another lane.
12. As a Slate user, I want overdue and future-dated unestimated work in Capture with date context, so that estimate readiness remains the lane boundary.
13. As a Slate user, I want date context shown as metadata rather than hidden subgroups, so that each visible lane behaves as one lane.
14. As a Slate user, I want filtering or collapsing to affect visibility but not membership, so that a task's meaning does not change when the interface changes.
15. As a Slate user, I want Capture to have one manual order, so that I can shape unready work deliberately.
16. As a Slate user, I want Ready to have one manual order, so that overdue, future, and unscheduled tasks do not fight an automatic urgency sort.
17. As a Slate user, I want Today to preserve its existing manual order, so that the full Planning workspace matches my compact daily plan.
18. As a Slate user, I want Board and List to share the same lane orders, so that switching views does not rearrange my work.
19. As a Slate user, I want the popover Backlog to use Capture followed by Ready in their authoritative orders, so that the popover does not maintain a competing task sequence.
20. As a Slate user, I want existing order choices preserved through the migration where possible, so that upgrading Slate does not arbitrarily scramble my work.
21. As a Slate user, I want tasks without prior order records placed deterministically, so that reopening Slate produces stable results.
22. As a Slate user, I want a task entering a lane through an accepted mutation to receive a predictable position, so that it does not disappear into the middle of the lane.
23. As a Slate user, I want work rederived only because the local date changed to avoid disrupting existing manual order, so that midnight does not reprioritize unrelated tasks.
24. As a Slate user, I want unfinished work from yesterday to leave Today after midnight, so that yesterday's commitment does not silently become today's commitment.
25. As a Slate user, I want yesterday's estimated unfinished work to appear in Ready as overdue, so that I can decide what to do with it.
26. As a Slate user, I want yesterday's unestimated unfinished work to appear in Capture as overdue, so that I can clarify it before recommitting.
27. As a Slate user, I want local-day rederivation to retain the scheduled date, so that Slate does not erase historical intent.
28. As a Slate user, I want local-day rederivation to avoid synthetic history events, so that the event ledger records accepted actions rather than interpretations of time.
29. As a Slate user, I want Done to include every completed non-deleted task, so that completed work does not fall outside the Planning model.
30. As a Slate user, I want Done ordered with the most recently completed task first, so that recent history is easiest to inspect.
31. As a Slate user, I want reopening a task to retain its estimate and scheduled date, so that reopening does not discard task facts.
32. As a Slate user, I want a reopened task dated today to return to Today, so that its current commitment remains explicit.
33. As a Slate user, I want another reopened estimated task to return to Ready, so that it becomes active without being recommitted automatically.
34. As a Slate user, I want another reopened unestimated task to return to Capture, so that Slate does not pretend it is ready.
35. As a Slate user, I want to move an unsized Capture task directly into Today through later manual UI, so that the backend preserves the existing unsized-commitment contract.
36. As a Slate user, I want unsized Today work excluded from known committed minutes, so that capacity never treats missing information as zero-duration certainty.
37. As a Slate user, I want future-dated Ready work excluded from Plan My Day, so that AI does not override a date I deliberately chose.
38. As a Slate user, I want Plan My Day to continue considering eligible unscheduled and overdue Ready tasks, so that the new lane name does not change AI planning semantics.
39. As a Slate user, I want Plan My Day candidates to respect Ready's authoritative order, so that AI context does not use a hidden competing sequence.
40. As a Slate user, I want stale reorder attempts rejected without partial writes, so that concurrent windows cannot corrupt lane order.
41. As a Slate user, I want lane order to persist after closing and reopening Slate, so that the Planning workspace remains stable.
42. As a Slate user, I want lane projection to refresh across the popover and full app, so that both windows reflect accepted changes.
43. As a Slate user, I want deleting a task to remove it from lane order while retaining existing event-history behavior, so that order data does not become orphaned.
44. As a Slate user, I want migration to preserve my tasks, estimates, dates, completion state, and revisions, so that a backend upgrade cannot alter task meaning.
45. As a Slate user, I want migration to avoid fabricating Planner Events, so that internal storage changes are not presented as my actions.
46. As a Slate user, I want manual planning to remain fully local and offline, so that lane projection does not depend on AI or network access.
47. As a maintainer, I want one native classification function to own lane meaning, so that renderer code cannot drift from SQLite behavior.
48. As a maintainer, I want compatibility and new snapshot views built from one internal state, so that the backend does not contain two definitions of planning.
49. As a maintainer, I want lane order guards opaque to the renderer, so that persistence scope names do not leak into UI code.
50. As a maintainer, I want an explicit local date at the planning boundary, so that midnight and date-sensitive behavior are deterministic under test.

## Implementation Decisions

- The existing native Planning workspace remains the single authority. Extend it rather than introducing a second board-specific classifier, repository, snapshot command, or renderer selector.
- Every non-deleted task belongs to exactly one lane using this precedence: completed becomes Done; otherwise scheduled for the current local date becomes Today; otherwise missing an estimate becomes Capture; otherwise becomes Ready.
- Lane membership remains derived from completion, scheduled date, estimate, and the explicit local date. No persistent lane, kanban status, workflow column, or previous-lane field is added to the task schema.
- Capture means all active unestimated work outside Today. It is not limited by creation source, capture recency, scheduled-date state, or age.
- Ready means all active estimated work outside Today. Unscheduled, overdue, and future-dated are semantic badges or task context, not separate lanes or ordering groups.
- Today continues to take precedence over estimate readiness. Unsized Today commitments remain visible, contribute no known capacity minutes, and remain excluded from AI planning.
- Done is exhaustive for completed non-deleted tasks and is ordered by completion time descending, followed by deterministic creation-time and identity tie-breakers. Done has no manual reorder guard.
- Reopening retains estimate and scheduled date, clears completion through the existing revision-safe mutation, and derives the active destination lane from current facts. No hidden previous-lane state is stored.
- Capture, Ready, and Today each expose one authoritative, opaque reorder guard and one persisted Lane order. Board and List will consume these same sections later.
- The Daily workspace's flat Backlog converges on Capture followed by Ready, preserving each lane's order. It continues to show Needs estimate, Overdue, Upcoming, and Unscheduled metadata without using those states as hidden order groups.
- Use the existing order table and native reconciliation boundary rather than adding a parallel ordering store. Canonical Capture and Ready order scopes replace legacy Backlog classification scopes as ordering authority; scope identifiers remain private to the native layer.
- Add a forward database migration for canonical lane orders. Capture inherits the legacy Needs estimate order. Ready is initialized by concatenating the legacy Overdue, Upcoming, and Unscheduled orders in their previously visible precedence while preserving relative order within each source scope. Today date scopes remain authoritative for existing Today order.
- The migration is idempotent, transactional, advances the schema version once, removes obsolete legacy order rows only after canonical rows are written, and does not modify tasks or append Planner Events.
- Tasks missing from a canonical lane order use a deterministic fallback after already ordered members. The fallback is stable across snapshots and database reopen.
- An accepted mutation that moves an active task into another lane without an explicit destination index places it at the start of the destination lane, preserving the current visible-entry convention. A later cross-lane movement contract may supply an explicit destination position atomically.
- A task whose lane changes only because the explicit local date changes is not written during snapshot loading and creates no event. If it has no canonical destination order record, it uses the deterministic fallback so midnight does not reorder existing members.
- The serialized planner snapshot gains an exhaustive lane projection suitable for later renderer consumption. It includes Capture, Ready, Today, and Done sections, lane counts, existing task metadata, reorder guards for active lanes, and the authoritative Today capacity view.
- Keep the current Daily-workspace-compatible snapshot shape until renderer migration is complete, but derive it from the same internal lane state. Compatibility output may reshape or concatenate sections; it must not reimplement membership or order rules.
- Update shared renderer transport types for the additive snapshot contract so the application continues to type-check before UI work begins. Do not render the new lane projection in this backend slice.
- Plan My Day eligibility remains narrower than Ready membership. Candidates are estimated Ready tasks that are unscheduled or overdue; future-dated Ready tasks remain excluded.
- Plan My Day candidate sequence is a filtered projection of authoritative Ready order. Candidate eligibility does not introduce another hidden ordering authority.
- Existing Today identity, revision checks, capacity checks, accepted-plan transactionality, task event behavior, and cross-window invalidation remain unchanged.
- Existing task mutations reconcile canonical lane orders in the same transaction as task facts, revisions, and Planner Events. Create, update, schedule, complete, reopen, delete, accepted plan, and reorder paths must not leave stale order rows.
- The existing reorder transport remains the public mutation boundary for within-lane ordering. It echoes an opaque native guard, validates exact membership and expected revisions, applies one transaction, and rejects stale input without partial writes.
- Capture-to-Today remains a valid future manual movement because Today outranks estimate readiness. This spec prepares the projection and reconciliation rules but does not add the later semantic cross-lane movement command.
- Planning logic receives an explicit local date. Production still obtains the actual local date at the outer native boundary; tests pass fixed dates directly without introducing a broad clock abstraction.
- Existing task rows, settings, credentials, sidecar behavior, permissions, and Keychain boundaries are unchanged.

## Testing Decisions

- The single automated seam is the native Planning workspace boundary backed by a real temporary SQLite database and an explicit local date. Exercise snapshots and accepted mutations through this boundary rather than testing private classification helpers independently.
- Reuse the existing temporary-database and persistence boundary test patterns. SQLite constraints, migrations, transactions, revisions, order rows, and database reopen are observable behavior and must not be mocked.
- Classification coverage includes every precedence branch: completed estimated and unestimated tasks; sized and unsized Today tasks; unscheduled, overdue, future, and today-dated active tasks; and deleted-task absence.
- Ordering coverage includes Capture, Ready, and Today manual order; Done completion-recency order; deterministic fallback; canonical migration from every legacy scope; exact relative-order preservation; deletion cleanup; and persistence after reopen.
- Day-boundary coverage loads the same stored facts with consecutive explicit local dates and verifies rederived lanes, retained scheduled dates, stable existing Lane order, no task writes, and no synthetic Planner Events.
- Reopen coverage completes and reopens tasks representing Today, Ready, and Capture outcomes and verifies retained facts, revision changes, destination placement, and accepted event history.
- Unsized-commitment coverage verifies that an unsized task dated today projects into Today, contributes no known capacity minutes, retains Needs estimate context, and remains absent from Plan My Day candidates.
- AI coverage verifies that Ready includes future-dated work while Plan My Day excludes it, that unscheduled and overdue estimated work remains eligible, and that candidate sequence filters the authoritative Ready order.
- Stale-order coverage verifies duplicate IDs, changed membership, stale revisions, stale date context, and obsolete guards all reject atomically without changing task or order rows.
- Compatibility coverage verifies that the current Daily workspace projection is a reshape of the same lane state: Today matches the Today lane, Backlog is Capture followed by Ready, metadata remains accurate, and no task appears twice or disappears.
- Migration coverage starts from the previous schema version with representative legacy order rows, runs migration through normal database setup, verifies canonical orders and unchanged task facts, reopens the database, and verifies idempotence and schema version.
- Event coverage verifies accepted fact mutations retain their existing event kinds and sources, while migration and date-only rederivation append no Planner Events.
- Good tests assert persisted and serialized planning behavior: lane membership, order, guards, capacity, candidates, events, and reopen results. They do not assert helper names, SQL statement shape, private scope strings, or internal collection choices.
- Run the existing Rust test suite for native validation and `npm run build` for the additive renderer transport contract. The repository still has no standard JavaScript test script, so this plan does not invent one.

## Out of Scope

- Planning workspace shell implementation from Plan 032.
- Board, List, lane, card, toolbar, inspector, status-bar, empty-state, or responsive UI.
- Board/List view selection or persistence of that renderer preference.
- Cross-lane drag-and-drop, keyboard movement, drop indicators, capacity preview, over-capacity confirmation, or Undo presentation.
- A new public semantic cross-lane movement command or reviewed batch change-set API; those belong to the later movement-boundary slice.
- Final destination-index behavior for pointer or keyboard cross-lane drops beyond preserving a backend seam for an explicit position.
- Filters, multi-select, Fit into Today, horizon views, Needs Attention, Focus mode, Make This Fit, or history inspection.
- Unfinished-day review, changed-day recovery, Anchor product decisions, or other conditional 2.3 work.
- Changes to Plan My Day eligibility beyond deriving the existing eligible set and sequence from Ready.
- A persistent status field, projects, subtasks, dependencies, tags, assignees, custom lanes, custom workflows, or generic In Progress state.
- Automatic rollover, automatic date clearing, synthetic midnight events, or silent task mutation caused by opening a new day.
- Sync, integrations, MCP, mobile, accounts, or network-backed planning state.

## Further Notes

- This plan is the second backend foundation beneath the Stage 3 2.0 workspace. Plan 031 established the authoritative Today/Backlog boundary; Plan 033 deepens that same boundary into the exhaustive lane contract required before Board and List.
- Plan 032 and Plan 033 are complementary: the former establishes the full-app UI frame, while this plan establishes the native facts that later Planning views will render. Neither implements the Board or List itself.
- Replacing legacy Backlog ordering with shared Lane order is an intentional product change. Date states remain visible metadata, but they no longer act as hidden user-order partitions.
- The roadmap's Stage 2 validation gate remains relevant to shipping the broader Stage 3 experience. This backend slice can be implemented and tested independently without claiming that the complete Planning workspace has earned release.

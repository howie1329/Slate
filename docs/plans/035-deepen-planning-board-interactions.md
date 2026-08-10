# Plan 035: Deepen Planning Board interactions

> **Status:** Complete
>
> **Parent:** Plan 034 — Deepen Planning mutations and canonicalize the projection
>
> **Type:** Behavior-preserving renderer architecture hardening

## Problem Statement

Slate users expect pointer dragging, keyboard dragging, and Task inspector Lane changes to express the same Planning intent. Today those interactions work, but their decisions are distributed across rendering callbacks and local draft handlers. The Board independently finds source and destination Lanes, validates targets, calculates capacity previews, chooses a mutation path, manages pending feedback, and decides when to open task detail. The Task inspector separately rewrites estimate and scheduled-date facts when its Lane choice changes.

This weak locality makes interaction sequences hard to verify. Existing tests prove that authoritative Planning lanes can be filtered and displayed, but they do not prove the full sequence from drag start through hover, drop, feedback, and returned mutation intent. A change to movement semantics can therefore require synchronized edits across callbacks and still leave pointer, keyboard, and Task inspector behavior subtly inconsistent.

## Solution

Create one deep, in-process Planning interaction module with a small domain-shaped interface. It receives authoritative Planning state plus interaction intents such as drag start, hover, cancel, drop, or Task inspector Lane selection. It returns the next interaction state and any observable decision: no action, reorder, task mutation intent, capacity preview, feedback, or task inspection.

The Board remains responsible for rendering, translating DnD events into domain intents, and executing returned effects through the existing mutation adapters. The Task inspector remains responsible for rendering and form submission, but uses the same Planning interaction implementation to transform Lane intent into draft facts. Native Planning remains authoritative for accepted mutations, revisions, Lane order, capacity, and Planner Events.

The result preserves current behavior while making the interaction interface the test surface. Pointer, keyboard, and inspector decisions gain leverage from one implementation, and the render tree no longer owns Planning movement rules.

## User Stories

1. As a Slate user, I want pointer and keyboard dragging to follow the same movement rules, so that Planning behavior is consistent regardless of input method.
2. As a Slate user, I want starting a drag to identify the task and its authoritative source Lane, so that subsequent feedback reflects the task I am moving.
3. As a Slate user, I want hovering a Lane to show whether it is a valid destination, so that I can understand the result before dropping.
4. As a Slate user, I want cancelling a drag to clear all transient movement state, so that stale targeting feedback does not remain visible.
5. As a Slate user, I want dropping outside a valid task or Lane target to make no change, so that an imprecise gesture is safe.
6. As a Slate user, I want dropping a task onto itself to make no change, so that accidental no-op movement does not create history.
7. As a Slate user, I want same-Lane dragging to reorder tasks only while canonical Planning order is visible, so that filtered or alternate sorting cannot persist a misleading order.
8. As a Slate user, I want Capture, Ready, and Today reordering to preserve the authoritative reorder guard, so that stale movement remains revision-safe.
9. As a Slate user, I want Done work to remain non-draggable, so that completion history is not treated as active planning work.
10. As a Slate user, I want dropping an unsized Capture task into Ready to explain that an estimate is required, so that Ready retains its current meaning.
11. As a Slate user, I want an invalid Ready drop to open the task for estimation, so that I can resolve the blocked movement immediately.
12. As a Slate user, I want dropping a sized task into Ready to keep its estimate and remove only a current-Today commitment, so that available work retains useful context.
13. As a Slate user, I want dropping a task into Capture to clear its estimate and remove only a current-Today commitment, so that Capture remains the place for unshaped work without discarding unrelated date context.
14. As a Slate user, I want dropping a task into Today to commit it to the current local day, so that movement has the same meaning as other explicit commitment actions.
15. As a Slate user, I want an unsized task to remain movable directly into Today, so that manual commitment continues to follow ADR-0002.
16. As a Slate user, I want dropping active work into Done to complete it, so that Board movement and explicit completion remain equivalent.
17. As a Slate user, I want hovering a sized task over Today to preview the resulting known capacity, so that I can see the cost before committing it.
18. As a Slate user, I want hovering a sized Today task over another active Lane to preview the recovered capacity, so that I can understand the effect of returning work.
19. As a Slate user, I want moving an unsized commitment into or out of Today to leave known minutes unchanged, so that Slate never invents an estimate.
20. As a Slate user, I want the capacity preview to distinguish remaining time from overage, so that a proposed movement is understandable before acceptance.
21. As a Slate user, I want Task inspector Lane choices to transform estimate and date drafts using the same rules as Board movement, so that the two surfaces cannot disagree.
22. As a Slate user, I want choosing Capture in the Task inspector to clear the estimate and any current-Today commitment, so that the form reflects Capture semantics immediately.
23. As a Slate user, I want choosing Ready in the Task inspector to retain a valid estimate and leave Today, so that the draft reflects available estimated work.
24. As a Slate user, I want choosing Today in the Task inspector to select the current local date, so that the draft reflects a deliberate commitment.
25. As a Slate user, I want an invalid Ready draft to remain visibly actionable before save, so that the form never silently fabricates an estimate.
26. As a Slate user, I want movement feedback to clear after the existing short interval, so that transient guidance does not become permanent clutter.
27. As a Slate user, I want a task being moved to show a pending state until the native result returns, so that duplicate movement is prevented.
28. As a Slate user, I want a failed movement to clear pending state and show the current understandable error, so that I can recover without reloading.
29. As a Slate user, I want a successful movement to converge on the refreshed canonical Planning projection, so that the Board never becomes a second authority.
30. As a Slate user, I want search, filters, and alternate sorting to affect visibility and reorder availability only, so that they never change Planning Lane semantics.

## Implementation Decisions

- Add one in-process Planning interaction module. It has no I/O dependency and requires no port or adapter abstraction inside its implementation.
- The Planning interaction interface accepts domain intents rather than React events or DnD library objects. Pointer and keyboard events are translated before crossing the seam.
- The interface receives only authoritative Planning facts required for the decision: current local date, canonical visible Lanes, task identity and facts, canonical-order visibility, capacity, reorder guards, and current interaction state.
- The interface returns the complete next interaction state plus at most one observable effect. Effects are explicit and finite: no action, reorder, task inspection, task fact mutation, or completion mutation.
- Drag state includes the active task, source Lane, hovered Lane, hovered task, and derived capacity preview. Rendering reads this state instead of recomputing the same relationships in multiple descendants.
- The interaction module owns source-Lane lookup, destination validity, same-Lane reorder position, exact reordered IDs, Ready estimate requirements, Today capacity preview, user-facing Lane feedback intent, and movement-to-task-facts decisions.
- The interaction module consumes Lane membership from the canonical Planning projection. It must not reclassify a task from estimate, scheduled date, or completion facts.
- The Board is a renderer adapter. It owns sensor configuration, collision detection, DOM refs, visual styling, focus, live-region placement, feedback timeout, toast display, and execution of returned effects through existing mutation adapters.
- The Board no longer chooses among completion, scheduled-date, update, and reorder mutations inside drag callbacks. That choice is returned by the Planning interaction implementation and mapped mechanically to the existing mutation adapters.
- The Task inspector uses the same interaction module for Lane draft transformations. It retains form ownership, text input, numeric parsing, dirty state, stale-state recovery, delete confirmation, and submission.
- Task inspector draft transformation is behavior-preserving: Capture clears estimate and clears only a date equal to the current local day; Ready leaves the current local day and requires a positive estimate before save; Today sets the current local day; Done remains unavailable for incomplete draft movement and active Lanes remain unavailable until completed work is reopened.
- Native Planning remains the authority for accepted task facts, revisions, Lane order, capacity, and Planner Events. The renderer interaction module proposes an effect; it does not commit or optimistically reclassify tasks.
- Existing native transport commands and the lane-safe reorder cache from Plan 034 remain unchanged unless a mechanical renderer adapter type is needed. Do not add a new native movement command in this plan.
- Reorder effects carry the authoritative reorder guard, semantic Lane identity for cache reconciliation, and the exact ordered task IDs.
- Task mutation effects carry the current expected revision and only the task facts required by the existing transport contract. They do not expose persistence scope strings.
- The existing pending-task behavior remains one movement at a time. Async success and failure stay in the renderer adapter rather than entering the pure interaction state machine.
- The existing feedback duration, drop animation, keyboard coordinate strategy, pointer activation threshold, accessibility labels, live-region messages, and reduced-motion behavior remain unchanged.
- Do not add a generic reducer framework, global state library, event bus, or broad command abstraction. The module is specific to Planning interaction decisions.
- Remove superseded callback helpers and their tests after the interaction interface covers the same observable behavior. Do not retain parallel decision paths as fallbacks.

## Testing Decisions

- The primary test seam is the Planning interaction interface. Tests feed authoritative Planning fixtures and ordered interaction-intent sequences into the module, then assert returned state and effects.
- Good tests assert observable decisions: active/hover state, valid destination, feedback intent, capacity preview, reordered IDs, task inspection, or mutation intent. They do not assert private helper names, reducer branch order, internal collections, React state calls, or DnD library details.
- Sequence tests cover drag start, multiple hover changes, cancel, valid drop, invalid drop, self-drop, and drop without a target. This replaces isolated helper tests that miss call order.
- Input-parity tests send equivalent pointer-translated and keyboard-translated domain intents and assert identical Planning decisions.
- Reorder tests cover Capture, Ready, and Today; movement to the first, middle, and last positions; stale or absent guards; filtered results; alternate sorts; query-active state; and Done rejection.
- Cross-Lane tests cover every active source and destination combination, including Capture to Ready without an estimate, Capture to Today while unsized, Ready to Capture, Ready to Today, Today to Capture, Today to Ready, and active work to Done.
- Capacity-preview tests cover sized movement into Today, sized movement out of Today, exact-capacity results, over-capacity results, zero remaining minutes, unsized movement in both directions, and movement unrelated to Today.
- Task inspector tests cover Lane draft transformations independently of React rendering: estimate clearing, Today-date clearing, unrelated-date retention, Ready estimate requirement, Today-date assignment, completed-task restrictions, and unchanged Lane selection.
- Effect tests verify that returned update intents preserve title, anchor date, estimate, scheduled date, task ID, and expected revision exactly where current behavior requires them.
- Adapter tests remain narrow. They verify that DnD events are translated into domain intents, returned effects invoke the correct existing mutation adapter once, pending state clears on success or failure, errors use the current message mapping, and inspection effects select the task.
- Presentation tests verify the current live-region text and valid-target visual state without duplicating Planning decisions.
- Existing Planning projection tests remain focused on filtering and sorting. They must not absorb interaction rules.
- Native Planning and persistence tests remain unchanged because this plan does not alter accepted mutation semantics or transport contracts.
- Validation includes all JavaScript tests and `npm run build`. The native Rust suite should also run as a regression check because renderer effects still cross the native Planning seam.
- The repository still has no standard JavaScript test script; focused Node test files may be run directly until one is intentionally added to the package manifest.

## Out of Scope

- User-visible redesign of the Planning Board, cards, Lanes, Task inspector, toolbar, feedback, capacity meter, empty states, or animations.
- New Planning movement semantics or changes to Capture, Ready, Today, Done, Reopen, Lane order, or unsized commitments.
- A new native semantic cross-Lane movement command.
- Destination-index behavior changes for cross-Lane drops.
- Optimistic cross-Lane task movement or renderer-owned Lane reclassification.
- Consolidating the Daily task-detail surface and full-app Task inspector into one presentation.
- Replacing the current DnD library or changing pointer and keyboard sensor behavior.
- Multi-select, batch movement, drag between filtered results, arbitrary manual order under alternate sorts, or dragging completed work.
- Board/List parity, a new List view, keyboard navigation outside the existing drag interaction, or focus-mode work.
- Native persistence, SQLite schema, Planner Event, capacity, AI planning, Keychain, sidecar, window, shortcut, or permission changes.
- New global state, reducer, command, or form libraries.

## Further Notes

- This is Candidate 03 from the 2026-08-10 architecture review.
- Plan 034 is a prerequisite: the interaction module must consume its canonical lane projection and lane-safe reorder adapter rather than restoring compatibility representations.
- ADR-0001 remains authoritative: renderer interaction code presents and proposes changes but does not create a parallel Planning model.
- ADR-0002 remains authoritative: unsized Capture work may move directly into Today and known capacity remains unchanged.
- The deletion test for the new module is decisive: removing it should spread movement validity, capacity preview, reorder intent, mutation selection, and Task inspector Lane transformation back across multiple callers.
- Implementation order: characterize current interaction sequences, introduce the domain intent/state/effect interface, migrate Board drag lifecycle, migrate Task inspector Lane drafting, delete superseded helpers, then run the complete validation set.

## Comments

- Implemented on 2026-08-10. One pure Planning interaction module now owns drag lifecycle state, target validity, capacity previews, exact Lane reorder effects, cross-Lane mutation selection, and Task inspector Lane draft transformations. The Board translates DnD events and executes returned effects through the existing adapters; native Planning contracts and visible interaction behavior are unchanged.

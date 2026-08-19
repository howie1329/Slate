# 039 — Build a richer UI-only Full-window Plan review

**Status:** planned

**Priority:** Stage 3 / 2.1 planning acceleration

**Scope:** Full-app renderer UI only; native generation and acceptance connection deferred

## Problem Statement

Slate's compact Plan My Day review is designed for the menu-bar popover. It shows a generated set of additions and aggregate capacity, but it does not give the full-window user enough room to compare those additions with existing Today commitments or remove individual additions before acceptance.

The Full app already provides a Planning workspace and a right-side Workspace inspector, but its Plan My Day result currently reuses the compact review content. The empty inspector also presents Plan My Day as a disabled future action. As a result, the spacious desktop surface does not yet provide a meaningfully richer planning review.

This slice builds and validates the richer interface directly in the Full app without connecting it to native generation, acceptance, SQLite, or the packaged sidecar. Slate has no users to migrate, so the UI can be established in the real Workspace inspector with development fixtures and connected to the authoritative planning boundary later.

## Solution

Add a UI-only **Full-window Plan review** to the Full app's Workspace inspector while preserving the compact Plan My Day review in the Daily workspace.

The empty Workspace inspector becomes a real entry surface. It shows current remaining capacity, a concise explanation, and an enabled **Plan My Day** action. Starting the action fills the same inspector with a fixture-backed review.

The review presents:

- A compact capacity progression from current commitments, through selected proposed additions, to remaining capacity after acceptance.
- A short, visually secondary plan-level rationale.
- An open, read-only **Already in Today** section.
- A **Proposed additions** section whose rows begin selected and may be independently included or excluded.
- **Accept selected**, **Redo**, and **Dismiss** actions.
- Loading, result, empty, error, stale, accepting, and success-preview states.

The Full-window Plan review uses a controlled presentational boundary and development fixtures. It performs no native request or persistence mutation. Selection and state transitions behave locally so the interface can be evaluated now. Acceptance ends with an explicit **UI preview—no tasks changed** notice.

The richer inspector docks at 480px when the Planning workspace has at least 960px of available width. Below that threshold, it overlays the right side at a width bounded by the viewport rather than crushing the Board. This remains the Workspace inspector, not a modal or separate route.

## User Stories

1. As a person planning in Slate's Full app, I want a richer Plan My Day review, so that I can make a deliberate commitment decision with enough space and context.
2. As a person using the compact Daily workspace, I want its existing Plan My Day review to remain available, so that ordinary daily planning still works from the menu-bar popover.
3. As a person viewing an empty Workspace inspector, I want to see an enabled Plan My Day action, so that the inspector provides a useful next step instead of disabled future controls.
4. As a person opening the empty inspector, I want to see today's remaining capacity, so that I understand the constraint before generating a proposal.
5. As a person starting Plan My Day, I want the review to fill the same right inspector, so that I do not lose the surrounding Planning workspace.
6. As a person who has selected a task, I want the toolbar Plan My Day shortcut to remain available, so that I do not have to manually clear task detail before planning.
7. As a person starting Plan My Day from the toolbar, I want task selection to clear and the review to replace task detail, so that the Workspace inspector has one unambiguous mode.
8. As a person starting Plan My Day from the empty inspector, I want the same review as the toolbar entry, so that entry point does not change behavior.
9. As a person waiting for a proposal, I want a clear loading state, so that I know Slate is preparing a review.
10. As a person reviewing a plan, I want to see my current committed minutes, so that the proposal starts from the real cost of Today.
11. As a person reviewing a plan, I want to see the minutes represented by selected additions, so that I understand the incremental commitment.
12. As a person reviewing a plan, I want to see remaining capacity after the selected additions, so that I can judge whether the reviewed plan fits.
13. As a person reviewing a plan, I want capacity values to use aligned whole-minute formatting, so that changes are easy to scan.
14. As a person reviewing a plan, I want capacity to remain a quiet planning signal rather than an analytics dashboard, so that Slate stays calm and focused.
15. As a person reviewing a plan, I want existing Today commitments shown separately from proposed additions, so that fixed work is never mistaken for an AI change.
16. As a person reviewing a plan, I want the Already in Today section open by default, so that the full-height inspector uses its space to make existing commitments visible.
17. As a person reviewing existing Today commitments, I want those rows to be read-only, so that Plan My Day cannot silently remove or reorder them.
18. As a person with an unsized Today commitment, I want it shown as needing an estimate rather than assigned a guessed duration, so that the capacity display remains honest.
19. As a person reviewing proposed additions, I want every proposed task selected initially, so that the generated plan is the starting recommendation.
20. As a person reviewing proposed additions, I want to include or exclude each row independently, so that I retain control over the final selection.
21. As a keyboard user, I want each proposed row to expose ordinary checkbox semantics and visible focus, so that selection is predictable and accessible.
22. As a pointer user, I want clicking the selectable row to toggle its checkbox, so that reviewing several additions is efficient.
23. As a person changing selections, I want selected minutes and remaining capacity to update immediately, so that the consequence of each choice is visible.
24. As a person who deselects every addition, I want Accept selected disabled, so that an empty acceptance cannot appear meaningful.
25. As a person reviewing an addition, I want to see its title and estimate, so that I understand its cost.
26. As a person reviewing an addition, I want to see whether it is Unscheduled or Overdue with its date, so that I understand why it was eligible.
27. As a person reviewing a plan, I want one short plan-level rationale, so that I understand the proposal without entering a chat or reasoning view.
28. As a person reconsidering a proposal, I want Redo to replace it after a visible loading state, so that I can explore another fixture-backed result.
29. As a person using Redo, I expect prior deselections to reset, so that the replacement proposal starts as a fresh recommendation.
30. As a person dismissing the review, I want to return to the empty Workspace inspector, so that no proposal appears to remain active.
31. As a person previewing acceptance, I want to see an accepting state and completion feedback, so that the intended future interaction can be evaluated.
32. As a person previewing acceptance, I want explicit confirmation that no tasks changed, so that fixture behavior cannot be mistaken for persistence.
33. As a person whose generated proposal has no additions, I want a specific empty explanation, so that I can distinguish no capacity, no eligible tasks, and nothing fitting.
34. As a person encountering a generation failure, I want a concise error state with Redo and Dismiss, so that recovery is obvious.
35. As a person whose proposal becomes stale, I want Slate to explain that current planning facts changed and offer regeneration, so that partial acceptance is never implied.
36. As a person using a wide Planning workspace, I want the review docked beside the Board, so that I can preserve spatial context.
37. As a person using a narrow application window, I want the inspector to overlay the right side instead of reducing the Board to an unusable strip, so that the review remains usable at Slate's minimum window size.
38. As a person closing an overlaid review, I want the unchanged Board revealed, so that temporary review state does not alter Board filtering, sorting, or placement.
39. As a keyboard user, I want Escape to dismiss the review and restore focus to the initiating control, so that focus never becomes stranded.
40. As a person using Reduced Motion, I want state and inspector changes to remain understandable without spatial animation, so that motion preferences do not remove feedback.
41. As a person using light or dark appearance, I want the review to use Slate's semantic tokens, so that it remains readable and visually consistent.
42. As a maintainer, I want the Full-window Plan review isolated from the compact review, so that desktop richness does not expand the popover.
43. As a maintainer, I want fixture data kept at a controlled presentation seam, so that UI work does not fake native planner commands or contaminate SQLite state.
44. As a maintainer, I want a development-only state selector, so that every review state can be inspected without adding a disposable route.
45. As a maintainer, I want the development selector excluded from production builds, so that test controls cannot become product UI.
46. As a future implementer, I want the UI's subset-selection requirement documented, so that the later native acceptance contract can be designed deliberately and remain stale-safe and atomic.
47. As a future implementer, I want current Today commitments treated as fixed context, so that backend connection cannot reinterpret them as move candidates.
48. As a future implementer, I want the accepted selection to remain additive, so that Plan My Day never removes or reorders existing Today work.

## Implementation Decisions

### Product and domain boundaries

- The richer experience is named **Full-window Plan review**.
- The Full-window Plan review exists only in the Full app's Planning workspace.
- The compact Daily workspace retains its existing Plan My Day trigger and compact accept-all review.
- The richer review is a mode of the existing Workspace inspector. It is not a modal, route, Planning Session, chat surface, bottom tray, or separate planning model.
- Task detail and the Full-window Plan review remain mutually exclusive Workspace inspector modes.
- Existing Today commitments are fixed context. Proposed additions are additive Plan candidates.
- The UI allows proposed additions to be included or excluded. It does not allow reordering, title editing, estimate editing, date editing, or changes to fixed Today commitments.
- No persistent status or new planning concept is introduced.

### Entry and dismissal

- Replace the empty inspector's disabled Plan My Day placeholder with an enabled primary action.
- The empty inspector shows current remaining capacity and concise copy describing a reviewable plan built from estimated Ready work.
- Retain the Planning toolbar's context-sensitive AI action as an always-available shortcut.
- Starting from either entry clears task selection and opens the same Full-window Plan review.
- Dismiss returns to the empty inspector rather than removing the inspector entirely.
- Escape and the inspector close control dismiss review state and restore focus to the initiating control when it remains available.
- Board/List view, Filter, Sort, Lane order, finder state, and task placement are not modified by entering or leaving the review.

### Presentational review contract

- Introduce one controlled presentational Full-window Plan review boundary with explicit state, Today context, proposal content, selection, and callbacks supplied by its owner.
- Keep fixture generation and preview-only transitions outside the presentational component.
- Model loading, result, empty, error, stale, accepting, and success-preview states.
- Keep unavailable-provider configuration outside this UI-only slice; the existing connected compact flow remains authoritative for provider settings.
- Fixture proposal rows contain the fields the UI can truthfully display: stable identity, title, positive whole-minute estimate, source date context, and revision-like fixture identity where needed for realistic state.
- Fixture Today rows include title, optional estimate, and any Needs estimate state required to represent an unsized commitment.
- All proposed additions begin selected on each new or regenerated proposal.
- Selected IDs are transient local review state. Changing selection recalculates selected minutes and remaining-after-acceptance without modifying the proposal fixture.
- Accept selected is disabled when zero additions are selected.
- The capacity progression presents current committed minutes, selected addition minutes, and remaining minutes after acceptance. It reuses Slate's existing capacity vocabulary and rail treatment without adding dashboard metrics.
- The optional rationale is one compact plan-level paragraph. Do not invent per-task rationales, priorities, energy scores, or model reasoning.
- Already in Today is open by default and read-only.
- Proposed additions are selectable. Each row uses a checkbox, title, estimate, and Unscheduled or Overdue date context.
- Only the proposed list becomes independently scrollable when vertical space is constrained; the summary and actions remain reachable.
- Redo requires no confirmation because the proposal is transient and unaccepted. It shows loading and replaces the complete fixture proposal, resetting selection.
- Accept selected simulates accepting and success locally, writes nothing, and returns to the empty inspector with an explicit **UI preview—no tasks changed** notice.
- A development-only state selector exposes every fixture state from the real inspector. It must be omitted from production builds.
- The ordinary Plan My Day action follows the representative loading-to-result fixture path without exposing implementation controls.

### Responsive and visual behavior

- The richer review uses a 480px docked inspector when the Planning workspace has at least 960px of available width.
- Below 960px, the inspector overlays from the right at a width no greater than 480px and no greater than the viewport minus a small visible edge.
- Responsive behavior is based on available shell width rather than assuming the native window is always full-screen.
- The 560 by 620 configured minimum window remains an acceptance boundary.
- The overlay is still the semantic Workspace inspector and does not use a centered dialog or modal backdrop.
- Static surfaces use tonal separation and hairline boundaries. Avoid nested decorative cards, broad shadows, gradients, and competing accent colors.
- AI content remains visually secondary until the explicit acceptance action.
- Use existing semantic color, typography, spacing, focus, and motion tokens.
- Capacity, error, stale, selection, and disabled states are communicated through text and structure as well as color.
- Respect Reduced Motion and preserve clear state changes when spatial transitions are removed.

### UI-only boundary and later connection

- This slice does not call Plan My Day generation or acceptance from the Full-window Plan review.
- Do not add or modify Tauri commands, sidecar protocol, provider prompts, Keychain handling, SQLite schema, planner mutations, or cross-window invalidation.
- Do not route fixture data through the existing native planner APIs.
- Preserve the existing connected compact Plan My Day implementation.
- The later connection slice must define native-authoritative subset acceptance. It must revalidate every selected assignment against current SQLite state, current Today revisions, capacity, eligibility, and task revisions, then apply the selected set atomically or apply nothing.
- The later connection must decide whether generation returns only recommended additions or a broader selectable candidate set. This UI-only slice assumes selection is limited to items in the generated proposal.
- The later connection must replace fixture Today context with the authoritative Planning projection.
- No ADR is required for this slice because the presentational and fixture choices are reversible. Any future acceptance-boundary change should be evaluated independently.

## Testing Decisions

- Prefer the highest practical automated seam: render the controlled Full-window Plan review with representative fixtures and assert externally visible behavior.
- At the review seam, test loading, populated result, empty reasons, error, stale, accepting, and success-preview states.
- Test that fixed Today commitments and proposed additions have distinct accessible sections.
- Test that Today rows are read-only and proposed rows expose checkbox semantics.
- Test that all proposal rows begin selected.
- Test that toggling rows updates selected minutes, remaining capacity, and Accept selected availability.
- Test that zero selected additions disables acceptance.
- Test that Redo enters loading, replaces the fixture, and resets selections.
- Test that Dismiss returns to the empty inspector without modifying Board or List presentation state.
- Test that preview acceptance performs no planner mutation and exposes the no-tasks-changed notice.
- Test accessible names, section labels, live status, busy state, alerts, focus restoration, and keyboard dismissal through observable output and interaction.
- Extend the existing presentational Planning workspace frame seam for responsive inspector contracts instead of adding a second shell abstraction.
- Test or assert the wide docked and narrow overlay presentation states at the frame/layout boundary.
- Use the repository's lightweight Node test style and existing React dependencies. Do not add Storybook, a broad browser-testing framework, or a large UI testing dependency solely for this slice.
- Keep tests focused on user-visible content and behavior rather than component names, hook internals, state object shape, or implementation-heavy snapshots.
- Manual desktop acceptance covers full-screen docked layout, windowed overlay layout, the 560 by 620 minimum, Board and List context preservation, toolbar and empty-inspector entry, focus order, Escape, light theme, dark theme, Reduced Motion, long titles, many Today commitments, and enough proposal rows to require scrolling.
- Manual regression acceptance confirms that compact Plan My Day generation, review, acceptance, and dismissal remain unchanged.
- Run the existing focused Node tests directly, then run `npm run build`. This repository does not define a standard root test script.

## Out of Scope

- Connecting the Full-window Plan review to native Plan My Day generation.
- Persisting accepted selections.
- Changing the native atomic acceptance command or sidecar protocol.
- Provider configuration, model selection, prompts, Keychain behavior, or network handling.
- Removing or redesigning the compact Daily workspace's Plan My Day flow.
- Reordering proposed additions.
- Editing proposed titles, estimates, or dates.
- Modifying, removing, completing, or reordering existing Today commitments from this review.
- Showing alternative Ready tasks that were not part of the generated proposal.
- Per-task AI explanations, chain-of-thought, freeform chat, or conversation history.
- Planning Session, Make This Fit, unfinished-day review, changed-day recovery, or broader batch planning.
- Calendar grids, time blocking, priorities, energy, tags, projects, subtasks, dependencies, analytics, scores, or productivity metrics.
- New routes, Storybook, new UI-test infrastructure, native window changes, migrations, or dependency upgrades.

## Further Notes

- The current Full app reuses the compact Plan My Day result and the empty inspector already contains a disabled Plan My Day placeholder. This slice promotes that placeholder into the real fixture-backed entry and establishes a separate full-window presentation.
- The existing connected proposal contract does not carry per-task rationale, alternate candidates, or editable-selection semantics. The UI must not suggest that those capabilities are already available.
- Current shell styling uses a fixed inspector and does not implement the earlier documented docked/overlay rule. This slice should reconcile the responsive inspector behavior while preserving the Workspace inspector as the shell's single contextual region.
- The open Already in Today section is deliberate because the review occupies the full inspector height and comparison with fixed commitments is central to the richer experience.
- Slate's authoritative planning rules remain unchanged: only estimated unscheduled or overdue Ready tasks are Plan candidates; future-dated, completed, unsized, and existing Today tasks are not candidates; accepted plans remain additive and capacity-aware.
- Update the product, design, roadmap, plan index, and domain glossary only where implementation makes their current statements inaccurate. Do not describe native connection as complete.

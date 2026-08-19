# Plan 038: Task finder filters, enriched creation, and quick actions

> **Status:** Complete
>
> **Parent:** Plan 037 — Create tasks from the Planning toolbar Task finder
>
> **Scope:** Desktop-only finder filters, creation details, direct creation shortcut, task quick actions, guidance, and empty states

## Problem Statement

The Planning toolbar Task finder can locate current tasks and create a title-only manual task, but it still makes users leave the finder for several common follow-up decisions. Users cannot narrow a busy result set by Planning lane or attention state, add an estimate or date before creation, explicitly commit the new task to Today, or perform a small common action on an existing result. The keyboard behavior is capable but largely invisible, and the popup gives little guidance before typing or when no task matches.

These gaps make the finder feel like a narrow lookup field instead of the efficient search-and-capture surface defined by the Planning toolbar. Users need more leverage without turning it into a command palette, adding opaque query syntax, or allowing task mutations to happen accidentally. Every change must preserve Slate's derived Planning lanes, explicit Today commitments, revision-safe mutations, local-first behavior, and reviewable task history.

## Solution

Evolve the existing desktop Task finder into a focused task switcher and capture surface with six coordinated improvements:

1. Add visible, removable filters for Capture, Ready, Today, Done, Overdue, and Needs estimate. Filters narrow only finder results and never modify the Board's Filter or Sort state.
2. Let the Create task option expand into lightweight optional creation details for estimate, date, and an explicit Today commitment. Default creation remains unestimated, unscheduled Backlog work, which the authoritative Planning projection derives into Capture.
3. Add `Command-Enter` as a direct create shortcut for the current non-empty query and selected creation details, even when an existing task result is active.
4. Add a separate contextual quick-action strip for the active existing task. It exposes only valid actions such as Open, Move to Today, Complete, Return to Capture, or Reopen, while keeping Enter on the result itself equivalent to Open.
5. Open a small instructional popup when the empty field receives focus and replace the generic no-match message with a clear explanation plus the existing Create task option.
6. Add a quiet, context-sensitive shortcut footer describing the keyboard actions currently available.

The result popup remains bounded, non-modal, and anchored below the expanding Planning toolbar field. Search, filters, create details, and active selection remain ephemeral renderer state. Task writes continue through the existing native command boundary and refresh from the authoritative Planner snapshot.

## User Stories

1. As a Planning workspace user, I want the Task finder to handle common retrieval and capture decisions, so that I can stay in one focused workflow.
2. As a user, I want existing task results to remain the primary content, so that the finder does not feel like a generic action launcher.
3. As a user, I want all finder enhancements available only in the full app, so that the compact Daily workspace remains unchanged.
4. As a user, I want the finder to remain local-first, so that search, creation, and task actions work without AI or network access.
5. As a user, I want finder state to remain temporary, so that old filters and unfinished creation details do not unexpectedly return later.
6. As a user, I want finder use to leave Board Filter and Sort unchanged, so that my Planning view does not move underneath me.
7. As a user, I want filters presented as visible controls, so that I do not need to memorize query syntax.
8. As a user, I want to filter results to Capture, so that I can focus on work that still needs shaping.
9. As a user, I want to filter results to Ready, so that I can focus on estimated work outside Today.
10. As a user, I want to filter results to Today, so that I can focus on current commitments.
11. As a user, I want to filter results to Done, so that I can find completed work without changing the Board.
12. As a user, I want to filter results to Overdue, so that I can retrieve work needing a date decision.
13. As a user, I want to filter results to Needs estimate, so that I can retrieve unsized work quickly.
14. As a user, I want only one Planning lane filter active at a time, so that contradictory lane choices are impossible.
15. As a user, I want Overdue and Needs estimate filters independently toggleable, so that I can combine attention criteria when useful.
16. As a user, I want lane and attention filters combined with AND semantics, so that narrowing behavior remains predictable.
17. As a user, I want title words and active filters combined with AND semantics, so that every visible result satisfies my full request.
18. As a user, I want filter chips removable individually, so that broadening a search is quick.
19. As a user, I want a single Clear filters action when filters are active, so that I can reset the finder efficiently.
20. As a user, I want the visible result count to reflect active filters, so that I understand the narrowed result set.
21. As a VoiceOver user, I want every filter's active state announced, so that filter meaning does not depend on appearance.
22. As a keyboard user, I want filter controls reachable without leaving the finder, so that pointer use remains optional.
23. As a user, I want the Create task option to remain available when filters hide every existing task, so that filters never block capture.
24. As a user, I want active filters to affect existing task results but not the new task payload, so that filtering and creation remain separate concepts.
25. As a user, I want Create task to preserve the current trimmed title, so that the task matches what I typed.
26. As a user, I want estimate to remain optional, so that capture does not require false precision.
27. As a user, I want to enter a positive whole-minute estimate, so that a new task can be ready for planning immediately.
28. As a user, I want invalid, zero, negative, fractional, or non-numeric estimates rejected before creation, so that duration remains valid.
29. As a user, I want date to remain optional, so that unscheduled capture stays fast.
30. As a user, I want to choose a calendar date without specifying a time, so that creation follows Slate's date-only model.
31. As a user, I want an explicit Add to Today control, so that committing new work is a deliberate decision.
32. As a user, I want Add to Today to use Slate's current local date, so that the commitment enters Today correctly.
33. As a user, I want Add to Today to work without an estimate, so that Slate continues to support unsized commitments.
34. As a user, I want Add to Today to override another draft date visibly, so that the resulting commitment is unambiguous.
35. As a user, I want turning Add to Today off to restore the prior optional draft date when practical, so that experimenting does not erase input unexpectedly.
36. As a user, I want default creation to remain unestimated and unscheduled in Backlog, so that capture does not silently create a commitment.
37. As a user, I want an estimated non-Today task to be derived into Ready, so that the finder respects Slate's authoritative Planning projection.
38. As a user, I want an unestimated non-Today task to be derived into Capture, so that the finder does not store a fake Lane status.
39. As a user, I want the creation controls to summarize the final estimate, date, and Today decision, so that I can verify the payload before saving.
40. As a user, I want creation details to reset after successful creation, Escape, pointer dismissal, or clearing the finder, so that stale metadata does not leak into the next task.
41. As a user, I want failed creation to preserve the title and creation details, so that retrying does not require re-entry.
42. As a user, I want creation to remain available when an exact task title already exists, so that duplicate titles follow Slate's current behavior.
43. As a keyboard-oriented user, I want `Command-Enter` to create the current non-empty query immediately, so that I do not need to navigate to the Create task option.
44. As a keyboard-oriented user, I want `Command-Enter` to use the selected creation details, so that the shortcut and visible Create task action agree.
45. As a keyboard-oriented user, I want `Command-Enter` to create even when an existing task result is active, so that direct creation is deterministic.
46. As a user, I want plain Enter on an existing task result to keep opening that task, so that the new shortcut does not cause accidental duplicates.
47. As a user, I want plain Enter on the Create task option to create the task, so that existing behavior remains intact.
48. As a user, I want repeated Enter or `Command-Enter` input blocked while creation is pending, so that one action creates exactly one task.
49. As a user, I want direct creation disabled for an empty or whitespace-only query, so that Slate never creates an empty task.
50. As a user, I want the `Command-Enter` shortcut shown near the Create task action, so that the behavior is discoverable.
51. As a user, I want the active task result to expose a small set of valid quick actions, so that common planning changes take fewer steps.
52. As a user, I want Open to remain the default result action, so that search never mutates a task merely because I pressed Enter.
53. As a user, I want to move a Capture or Ready task to Today, so that I can commit found work immediately.
54. As a user, I want moving a task to Today to preserve its estimate, so that known capacity remains accurate.
55. As a user, I want moving an unsized Capture task to Today to remain allowed, so that the finder respects Slate's unsized commitment contract.
56. As a user, I want to complete an active task from the finder, so that a small finished item does not require opening its inspector.
57. As a user, I want to return active work to Capture, so that I can explicitly remove its estimate and Today or date commitment when it needs reshaping.
58. As a user, I want Return to Capture labeled clearly as clearing estimate and date context, so that its consequences are not hidden.
59. As a user, I want to reopen a Done task, so that completed work can return to the active Planning lane derived from its retained estimate and date.
60. As a user, I want invalid quick actions omitted rather than disabled without explanation, so that the action set remains concise.
61. As a user, I want a pending quick action to disable competing finder actions, so that task revisions cannot race.
62. As a user, I want a successful quick action to refresh results from the authoritative Planner snapshot, so that Lane and metadata changes appear correctly.
63. As a user, I want the query and filters preserved after a successful task quick action, so that I can continue working through the same result set.
64. As a user, I want the updated task to disappear when it no longer satisfies the active filters, so that filtered results remain truthful.
65. As a user, I want active selection to move to the next remaining result after an action removes a task, so that keyboard flow continues safely.
66. As a user, I want a failed quick action to keep the finder open and preserve selection, so that I can understand and retry the operation.
67. As a user, I want stale revision errors explained with Slate's existing refresh guidance, so that conflicting changes are recoverable.
68. As a user, I want quick actions recorded through existing Planner Events, so that the Task inspector activity trace remains complete.
69. As a VoiceOver user, I want quick actions exposed separately from task result options, so that opening and mutating a task are not semantically mixed.
70. As a Full Keyboard Access user, I want to enter and leave the contextual action strip predictably, so that every quick action is reachable.
71. As a user, I want focusing an empty finder to open a small instructional state, so that the expanded field does not lead to an unexplained blank popup.
72. As a user, I want the empty state to say that I can find or create a task, so that both purposes are apparent.
73. As a user, I want the empty state to avoid recent tasks or suggestions, so that this slice remains deterministic and private.
74. As a user, I want a no-match state to say **No matching tasks**, so that search failure is explicit.
75. As a user, I want the no-match state to present **Create “title”** immediately below it, so that the next useful action is obvious.
76. As a user, I want a filtered no-match state to distinguish between no title matches and no matches under the active filters, so that I know whether to remove a filter.
77. As a user, I want the empty and no-match states to stay compact, so that the popup does not become an onboarding panel.
78. As a keyboard user, I want a quiet shortcut footer showing Arrow keys, Enter, `Command-Enter`, and Escape, so that the interaction is learnable.
79. As a keyboard user, I want the shortcut footer to mention the quick-action entry key only when an existing task is active, so that guidance stays contextual.
80. As a user, I want shortcut hints to update when Create task or a task quick action is active, so that labels describe the action Enter will perform.
81. As a VoiceOver user, I want shortcut hints excluded from repetitive announcements unless their context changes, so that guidance does not become noise.
82. As a user with Reduced Motion enabled, I want filter, creation-detail, action-strip, and guidance changes to appear without unnecessary movement, so that the finder remains comfortable.
83. As a user, I want Escape to close an action menu or creation-detail control before it closes the entire finder, so that dismissal follows visual depth.
84. As a user, I want pointer dismissal to close the finder without applying unsaved creation details or quick actions, so that incidental clicks never mutate tasks.
85. As a Settings user, I want the Settings toolbar unchanged, so that finder capabilities remain scoped to Planning.
86. As a Daily workspace user, I want the existing search, capture, and AI workflow unchanged, so that the full-app finder does not alter the compact surface.
87. As a Quick Capture user, I want its draft and revision-safe Undo contract unchanged, so that enriched finder creation remains normal manual creation rather than a second quick-capture mode.

## Implementation Decisions

- Extend the existing Planning toolbar Task finder and its pure interaction model. Do not add a second search field, modal, route, native window, command palette, or external search dependency.
- Keep current title normalization and canonical result ordering. Apply filters after title matching without relevance scoring or renderer-owned task reclassification.
- Represent finder filters as ephemeral state with one optional Lane value—Capture, Ready, Today, or Done—and independent Overdue and Needs estimate booleans.
- Use AND semantics across query tokens, the selected Lane, and enabled attention filters. A task must satisfy every active criterion.
- Derive filter facts only from each result's authoritative Lane, badges, estimate, scheduled date, and completion facts already present in the Planner snapshot.
- Keep finder filters independent of Board Filter and Sort. Changing either set never reads from or writes to the other.
- Show filters in a compact row within the popup. Active filters use accessible pressed or selected semantics, remain removable, and expose Clear filters when any filter is active.
- Open the popup on field focus even when the query is empty. In this state, show concise instructions and filter controls but no task results, recent tasks, or Create task option.
- Continue to show the Create task option only for a non-empty trimmed query. It remains the final option after existing results and remains available regardless of active filters or duplicate titles.
- Expand Create task into an inline creation-detail region rather than opening a modal. Keep the proposed title visible and add optional estimate, date, and Add to Today controls.
- Treat creation destination as Backlog by default, not a stored Capture Lane. An unestimated Backlog task derives into Capture and an estimated Backlog task derives into Ready.
- Make Add to Today an explicit boolean decision that schedules the new task for the current local date. It may be used without an estimate, preserving the unsized commitment ADR.
- While Add to Today is active, make its effective date unambiguous and prevent a conflicting separate date from being submitted. Preserve the prior draft date locally if the user turns Add to Today off before creation.
- Accept only positive whole-minute estimates. Validate creation details in the renderer for immediate feedback and continue relying on the existing native validation boundary as authoritative.
- Create tasks through the existing ordinary manual task command with the trimmed title, optional estimate, effective date, and source `manual`. Do not use quick-capture draft, source, or Undo semantics.
- Add `Command-Enter` within the focused Planning finder as an explicit direct-create shortcut. It creates the current query with the current creation details regardless of which result is active.
- Preserve plain Enter semantics: open an active task result or create only when Create task is active. Do not overload Enter based on match count beyond the existing no-match selection behavior.
- Keep a synchronous submission guard in addition to mutation pending state so rapid keyboard and pointer activation cannot submit duplicate writes.
- On successful creation, clear all finder state and open the returned task identity in the existing Task inspector. On failure, retain query, filters, and creation details and show the existing planner mutation error vocabulary.
- Present quick actions in a separate contextual action strip associated with the active task, not as nested buttons inside a `listbox` option. This preserves valid combobox/listbox semantics.
- Keep Open as the default action. Use a deliberate keyboard transition such as Right Arrow to enter the action strip and Left Arrow or Escape to return to result navigation; pointer and Full Keyboard Access activation remain supported.
- Derive available task actions from current task facts and Lane. The bounded action vocabulary is Open, Move to Today, Complete, Return to Capture, and Reopen.
- Move to Today uses the existing revision-safe scheduled-date mutation with the current local date and preserves estimate.
- Complete uses the existing revision-safe completion mutation.
- Return to Capture reuses the existing Planning interaction semantics: clear estimate and scheduled date together so the native projection derives Capture. Label the data-clearing consequence in the action description; never present it as a harmless visual move.
- Reopen uses the existing revision-safe completion mutation and lets retained estimate and date facts determine the resulting active Lane.
- Execute task actions through the existing planner mutations and invalidation path. Do not optimistically rewrite the snapshot or introduce a parallel task state.
- Disable competing create, open, filter, and task-action interactions while any finder mutation is pending. Preserve query and filters after task actions, but clear the finder after successful creation or Open.
- When snapshot invalidation changes the result set, retain the active task by identity when still present; otherwise select the first remaining task or Create task when no tasks remain.
- Replace the generic no-match copy with context-aware text: **No matching tasks** without filters and **No tasks match these filters** when filters exclude all title matches. Keep the explicit Create task row adjacent.
- Add a quiet popup footer with context-sensitive keyboard guidance. At minimum expose Arrow navigation, Enter's current action, `Command-Enter` Create, Escape, and the action-strip entry key when applicable.
- Keep screen-reader announcements bounded to result counts, filter changes, pending mutations, errors, and successful action outcomes. Visual shortcut text should not be repeatedly announced on every navigation step.
- Keep the popup bounded and scrollable at the existing desktop dimensions. Filter controls, creation details, contextual actions, and keyboard guidance remain fixed or sticky around the scrollable result region so essential actions do not scroll out of reach.
- Preserve Reduced Motion behavior and the existing active-width expansion. New panels may crossfade or appear instantly but must not animate layout with bounce or spring effects.
- Do not change SQLite schema, native commands, Planner Event kinds or sources, permissions, Keychain behavior, AI sidecar behavior, or network access.
- Update product and design documentation to describe filters, explicit Today creation, direct creation, quick actions, empty states, and keyboard guidance after implementation.

## Testing Decisions

- Use one primary pure finder interaction seam by extending the current task-finder interaction model. It should accept authoritative task results, query, filters, creation draft, active identity, and user intent, then return the visible option model plus explicit effects for Open, Create, and task mutations.
- At this seam, test externally meaningful state transitions and effects: filter combinations, result order, counts, active selection fallback, empty and no-match presentation state, create-detail validation, effective date resolution, `Command-Enter`, plain Enter, action availability, action-strip navigation, Escape depth, and exact mutation payloads.
- Keep the existing pure title-projection tests focused on case-insensitive all-token matching, metadata, and canonical Lane order. Do not duplicate those assertions in interaction tests.
- Reuse existing Planning interaction tests for Return to Capture and Move to Today semantics where possible. Add finder-specific assertions only for selecting the correct existing effect and preserving finder state around it.
- Reuse existing planner mutation and native persistence coverage for revision guards, stale-write rejection, event attribution, task creation validation, completion, scheduling, and update behavior. No new native tests are required unless implementation changes those boundaries.
- Add a narrow rendered accessibility test only if the repository gains an appropriate React DOM harness. It should assert combobox/listbox relationships, filter selected states, separation of the contextual action strip, create-detail labels, live regions, and keyboard guidance—not component structure or CSS utilities.
- Good tests assert what the user can observe and which domain effect is requested. Avoid asserting hook names, internal state field names, temporary arrays, event-listener implementation, DOM nesting beyond accessibility contracts, animation frames, or class ordering.
- Manual keyboard acceptance covers empty focus, filters, result navigation, Create task details, plain Enter, `Command-Enter`, action-strip entry and exit, every task action, nested Escape behavior, pending guards, errors, and inspector handoff.
- Manual visual acceptance covers ordinary and minimum full-app widths, many results, long titles, active filter wrapping, creation-detail validation, fixed contextual controls, light and dark themes, visible focus, and Reduced Motion.
- Manual accessibility acceptance covers VoiceOver naming, filtered result counts, active descendants, creation-detail errors, contextual task actions, pending and success announcements, and non-repetitive shortcut guidance.
- Regression acceptance confirms Board Filter and Sort never change, authoritative Lane ordering remains intact, quick actions write Planner Events through existing sources, Settings is unchanged, and the Daily workspace and Quick Capture window retain their current behavior.
- Run the focused Node tests and required production build. Native test execution remains unnecessary unless implementation unexpectedly modifies native behavior.

## Out of Scope

- Recent tasks, search history, persisted filters, saved searches, pinned searches, suggested tasks, or personalized ranking.
- Free-form query syntax, Lane prefixes, boolean expressions, quoted operators, fuzzy matching, typo tolerance, stemming, synonyms, or relevance scoring.
- Searching notes, event history, previous titles, deleted tasks, Settings, AI content, or fields other than the current title.
- Creating from an empty query, templates, recurring tasks, multiple tasks from one query, or batch creation.
- Natural-language parsing of estimates or dates from the title. Creation details use explicit controls and never remove tokens from the title automatically.
- Creation metadata beyond estimate, date, and explicit Today commitment, including priority, tags, notes, projects, Spaces, assignees, attachments, dependencies, or recurrence.
- Direct creation into a stored Planning Lane, automatic commitment to Today, default estimates, or guessed dates.
- AI Assist, title rewriting, estimate suggestions, date suggestions, Plan My Day, or any network-backed enrichment.
- Delete, duplicate, edit-title, change-estimate, arbitrary reschedule, reorder, or batch actions from task results.
- Undo for finder actions beyond the repository's existing behavior, quick-capture draft persistence, quick-capture source attribution, or the dedicated five-second quick-capture Undo contract.
- Optimistic synthetic task or Lane state, direct SQLite queries, new native commands, schema changes, new Planner Event kinds or sources, permissions, credentials, sidecar work, or network access.
- Changes to Board card layout, Board Filter or Sort controls, Workspace status bar, Settings toolbar, menu-bar popover, Daily workspace, or dedicated Quick Capture window.
- Mobile, web-only distribution, global Spotlight integration, system-wide search, separate native search windows, or new routes.

## Further Notes

- The selected scope combines ideas 2, 3, 4, 5, 7, and 8 from the Task finder improvement discussion: filter chips, enriched creation, direct keyboard creation, result quick actions, clearer empty/no-match states, and visible keyboard guidance. Recent tasks and previous-title search remain deliberately deferred.
- The Planning toolbar already owns search and capture in Slate's domain language. These additions deepen that responsibility without making the finder a general command palette.
- ADR-0001 remains authoritative: filters change visibility only, and creation or quick actions mutate task facts rather than assigning persistent Lane status.
- ADR-0002 remains authoritative: Add to Today and Move to Today may create an unsized commitment, which contributes no guessed minutes and remains excluded from AI planning until estimated.
- Return to Capture is materially different from Return to Backlog. It deliberately clears estimate and scheduled date so the task needs shaping again; the action must communicate that consequence before activation.
- Direct `Command-Enter` creation is intentionally deterministic even when an exact title match exists. Plain Enter remains the safer Open behavior whenever a task result is active.
- Keeping quick actions outside result options preserves accessible listbox semantics and makes mutations visually distinct from retrieval.

## Comments

- Specification synthesized from the implemented Plans 036–037 and the selected Task finder improvements on 2026-08-12.
- Implemented on 2026-08-12 through the existing renderer interaction model and Planner mutation hooks. The change adds ephemeral filters, enriched creation, `Command-Enter`, contextual revision-safe actions, empty-state guidance, and shortcut hints without changing native commands, persistence, Planner Event kinds, Board state, or the compact Daily workspace.

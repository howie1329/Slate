# Plan 037: Create tasks from the Planning toolbar Task finder

> **Status:** Complete
>
> **Parent:** Plan 036 — Planning toolbar Task finder MVP
>
> **Scope:** Desktop-only manual task creation from the existing Task finder

## Problem Statement

The Planning workspace Task finder gives users one fast place to retrieve current work, but a query that describes new work reaches a dead end. The user must abandon the query, move to another capture surface, and type the title again. That interruption is especially noticeable when a search returns no matches, because the text already expresses exactly what the user wants to capture.

Users need to turn the current finder query into a normal Slate task without leaving the keyboard flow or confusing creation with opening an existing result. The interaction must preserve Slate's local-first task model, Capture semantics, Board state, and existing event history rather than introducing a second quick-capture system.

## Solution

Extend the full-window Planning toolbar Task finder with one explicit **Create task** option derived from the current non-empty query. The option appears after existing task results and clearly shows the title that will be created. It remains available even when an exact or partial title match exists because Slate permits duplicate task titles.

When no task matches, the create option is selected automatically, so Enter creates the task immediately. When matches exist, the first task result remains selected so Enter continues to open existing work; users can reach the create option with Arrow Down or select it with the pointer.

Creation trims surrounding whitespace, preserves the user's title text, and uses Slate's existing normal manual task-creation boundary. The new task is unestimated and unscheduled, so the authoritative Planning projection places it in Capture. After creation succeeds, the finder closes and clears, the planner snapshot refreshes, and the existing Task inspector opens for the new task.

## User Stories

1. As a Planning workspace user, I want to create a task from the Task finder, so that I do not need to retype work in another surface.
2. As a keyboard-oriented user, I want a no-match query to become immediately creatable, so that I can type a title and press Enter.
3. As a pointer user, I want a visible Create task option, so that creation does not depend on discovering a keyboard shortcut.
4. As a user, I want the create option to display the title that will be saved, so that I can verify the action before committing it.
5. As a user, I want surrounding whitespace removed from a created title, so that accidental spaces do not become task content.
6. As a user, I want capitalization and meaningful internal spacing preserved, so that the created title reflects what I typed.
7. As a user, I want an empty or whitespace-only finder to remain idle, so that Slate never offers an empty task.
8. As a user, I want the create option available when there are no matching tasks, so that an unsuccessful search can become useful capture.
9. As a user, I want the create option available when partial matches exist, so that similar existing work does not prevent new capture.
10. As a user, I want the create option available when an exact title match exists, so that Slate's existing duplicate-title behavior remains consistent.
11. As a user, I want existing task results listed before the create option, so that retrieval remains the finder's primary behavior.
12. As a user, I want the first existing result selected when matches exist, so that Enter continues to open the likely task instead of creating a duplicate accidentally.
13. As a user, I want the create option selected when no task matches, so that Enter performs the only meaningful action.
14. As a keyboard-oriented user, I want Arrow Down to reach the create option after task results, so that I can choose creation without leaving the input.
15. As a keyboard-oriented user, I want Arrow Up to return from the create option to task results, so that I can reconsider creation.
16. As a keyboard-oriented user, I want navigation to clamp at the first task result and the create option, so that selection remains predictable.
17. As a keyboard-oriented user, I want focus to remain in the finder input while selecting the create option, so that editing the proposed title stays immediate.
18. As a user, I want Enter on an existing task result to keep opening that task, so that adding creation does not regress finder behavior.
19. As a user, I want Enter on the create option to create exactly one task, so that repeated submissions cannot create accidental duplicates.
20. As a pointer user, I want clicking the create option to create exactly one task, so that pointer and keyboard behavior agree.
21. As a user, I want the finder to indicate when creation is in progress, so that I understand why another submission is temporarily unavailable.
22. As a user, I want result opening and additional creation disabled while a create request is pending, so that one interaction cannot race another.
23. As a user, I want the finder to clear and close after successful creation, so that stale query state does not remain.
24. As a user, I want the newly created task to open in the existing Task inspector, so that I can immediately add an estimate, date, or other details.
25. As a user, I want the new task to appear in Capture, so that unshaped work retains Slate's existing readiness semantics.
26. As a user, I want a new finder-created task to start without an estimate, so that Slate does not invent a duration.
27. As a user, I want a new finder-created task to start without a scheduled date, so that capture does not silently create a Today commitment.
28. As a user, I want creating a task to leave the current Board Filter unchanged, so that capture does not alter my view preferences.
29. As a user, I want creating a task to leave the current Board Sort unchanged, so that capture does not alter my view preferences.
30. As a user, I want the authoritative Planning projection to decide where the task appears, so that the renderer does not invent a parallel Lane status.
31. As a user, I want a newly created task to remain findable as soon as the planner snapshot refreshes, so that search reflects current local data.
32. As a user, I want creation to succeed even when the active Board Filter would hide the new Capture task, so that finder behavior remains independent of Board presentation.
33. As a user, I want the new task inspector to open even when the active Board Filter hides its card, so that the creation result remains clear.
34. As a user, I want a failed creation to preserve my query, so that I can retry without retyping the title.
35. As a user, I want a failed creation to keep the create option available, so that recovery remains local to the finder.
36. As a user, I want a concise error message when creation fails, so that I understand that the task was not saved.
37. As a user, I want Escape before submission to clear and close the finder without creating anything, so that abandoning a draft is safe.
38. As a user, I want pointer dismissal before submission to clear the finder without creating anything, so that navigating away does not save unintended work.
39. As a VoiceOver user, I want the create option identified as an action distinct from task results, so that opening and creating are not ambiguous.
40. As a VoiceOver user, I want pending, success handoff, and failure states announced, so that creation is understandable without visual feedback.
41. As a Full Keyboard Access user, I want the create option included in the finder's active-descendant navigation, so that it behaves as part of the existing composite control.
42. As a user with Reduced Motion enabled, I want creation feedback and inspector handoff to respect existing reduced-motion behavior, so that the interaction remains comfortable.
43. As a user, I want finder-created tasks recorded in task activity as ordinary manual creation, so that event history remains complete and understandable.
44. As a user, I want creation to remain local-first and available without AI or network access, so that ordinary capture is always reliable.
45. As a menu-bar popover user, I want the Daily search-and-capture workflow unchanged, so that this desktop addition does not alter the compact surface.
46. As a Quick Capture user, I want its dedicated draft and Undo behavior unchanged, so that finder creation does not become a second global quick-capture mode.
47. As a Settings user, I want the Settings toolbar unchanged, so that task creation remains scoped to the Planning workspace.

## Implementation Decisions

- Extend the existing Task finder rather than adding a separate composer, dialog, route, window, or command palette.
- Change the idle copy to **Find or create a task…** and preserve the existing `Command-F` focus behavior, active-width expansion, result popup, clear control, and pointer dismissal.
- Derive one create option whenever the normalized query is non-empty. Its label uses **Create task** and presents the trimmed proposed title.
- Keep existing task results in canonical Capture, Ready, Today, and Done order. Append the create option after all task results; it does not participate in Lane ordering or fuzzy ranking.
- Continue to allow duplicate titles. Exact and partial task matches do not suppress or disable the create option.
- Treat task results and the create option as one keyboard navigation collection. Keep DOM focus in the input and expose the active item through the existing active-descendant pattern.
- When at least one task result exists, keep the first task result active after a query change. When no task result exists, make the create option active.
- Clamp Arrow Up and Arrow Down navigation across the combined collection. Do not wrap from the create option to the first task.
- Preserve Enter's current meaning for task results. Enter creates only when the create option is active; pointer selection of the create option also creates.
- Use the current trimmed query as the task title. Do not infer an estimate, date, Lane, priority, tags, notes, or AI-generated enrichment.
- Reuse the normal manual task-creation mutation with `source` equal to `manual`, `estimateMinutes` equal to `null`, and `scheduledDate` equal to `null`. Do not use the dedicated quick-capture source because finder creation has no quick-capture draft or Undo contract.
- Let the authoritative Planning projection classify the created task into Capture. Do not add a stored status, renderer-owned Lane assignment, or direct SQLite query.
- Reuse existing planner invalidation after mutation success so the Board and finder refresh from the local source of truth.
- On success, clear and close the finder, then select the returned task identity through the existing task-selection boundary so the Task inspector opens.
- Keep Board Filter and Sort state unchanged. The Task inspector opens even if the current Filter does not show the new Capture card.
- While creation is pending, expose a concise creating state and prevent repeat creation or result activation. Do not optimistically add a synthetic task to the Planning snapshot.
- On failure, keep the query and create option intact, restore interaction, and use the existing planner mutation error vocabulary to explain that the task was not saved.
- Escape and pointer dismissal before submission remain non-mutating. They clear the ephemeral query and active item exactly as the current finder does.
- Record creation through the existing `task-created` Planner Event with source `manual`. No new event kind, source value, schema migration, native command, permission, Keychain behavior, sidecar behavior, or network access is required.
- Keep the menu-bar Daily workspace, dedicated Quick Capture window, Settings toolbar, and Workspace status bar unchanged.

## Testing Decisions

- Use one high renderer behavior seam around the Task finder with the existing creation mutation and task-selection boundaries substituted. This seam should prove the externally visible sequence: a non-empty query exposes the create option, submission sends the correct title-only manual payload, success clears the finder, and the returned task identity opens in the Task inspector flow.
- At the same seam, cover matching and no-match queries, initial active-item behavior, combined Arrow navigation, Enter on a task result versus Enter on the create option, pointer creation, pending duplicate-submit prevention, failure retention, Escape, and pointer dismissal.
- Continue using the existing pure Task finder projection tests for title matching, normalization, metadata, and canonical task order. Do not move creation into that projection; the create option is interaction state derived from the query, not a persisted task result.
- Reuse existing native persistence coverage for ordinary manual task creation and `task-created` event attribution. Add native tests only if implementation changes the accepted payload or event boundary, which this plan explicitly avoids.
- Good tests assert user-visible behavior and command payloads rather than component nesting, hook names, temporary arrays, CSS utility ordering, animation frames, or private state representation.
- Manual keyboard acceptance covers `Command-F`, typing, active-width expansion, no-match Enter creation, navigating past matches to Create task, returning to a task result, pending behavior, failure retry, Escape, and inspector focus handoff.
- Manual visual and accessibility acceptance covers long titles, exact duplicate titles, many scrollable results plus the final create option, minimum full-app width, light and dark themes, visible focus, VoiceOver naming and announcements, and Reduced Motion.
- Run the focused renderer tests and the required production build. Native test execution is unnecessary unless the implementation unexpectedly changes native task creation.

## Out of Scope

- Creating tasks from an empty query, recent-task state, suggested task titles, templates, or saved drafts.
- Inline estimate, date, Lane, priority, tag, note, project, Space, assignee, recurrence, dependency, or attachment entry in the finder.
- Creating directly into Ready or Today, choosing a destination, or silently committing new work to Today.
- AI Assist, title rewriting, estimate suggestions, date suggestions, Plan My Day, or any network-backed enrichment.
- Quick Capture draft persistence, the global shortcut, the quick-capture source, five-second Undo, or quick-capture window changes.
- Optimistic synthetic tasks, offline queues beyond the current local persistence boundary, sync, accounts, collaboration, or sharing.
- Fuzzy matching, typo tolerance, ranking changes, advanced query syntax, command-palette actions, or batch creation.
- Blocking duplicate titles, merge suggestions, duplicate warnings, or automatic selection of an exact match instead of allowing creation.
- Board Filter or Sort changes, automatic scrolling to the new card, card highlighting, Lane reordering, or changing the Planning projection.
- New native commands, SQLite schema changes, Planner Event kinds or sources, permissions, Keychain access, sidecar work, or network access.
- Changes to the Daily workspace, Settings, Workspace status bar, dedicated Quick Capture window, or menu-bar popover.

## Further Notes

- The Planning toolbar is defined in Slate's domain language as supporting search and capture. This slice fulfills that existing responsibility without expanding the Task finder into a general command surface.
- ADR-0001 remains authoritative: an unestimated, unscheduled manual task is persisted as Backlog work and derived into Capture by the Planning projection rather than assigned a stored Lane status.
- ADR-0002 remains unchanged: the created task begins outside Today, but users may later move it into Today as an unsized commitment through the existing explicit movement flow.
- Ordinary manual creation is the correct event source. The dedicated quick-capture source carries additional draft and revision-safe Undo semantics that do not apply to the Planning toolbar.
- The create option is intentionally explicit even for no-match queries. Search text must never become a persisted task because the popup closed, focus changed, or the user merely paused typing.

## Comments

- Specification synthesized from the implemented Planning toolbar Task finder and the agreed create-from-search direction on 2026-08-12.
- Implemented on 2026-08-12. The Task finder now presents an explicit final Create task option for every non-empty query, selects it automatically when no task matches, and includes it in clamped active-descendant keyboard navigation. Creation reuses the ordinary manual mutation, retains the query on error, blocks racing interactions while pending, refreshes the authoritative Planning projection, and opens the returned task in the existing inspector. Focused interaction tests cover option ordering, no-match selection shape, navigation bounds, and the exact title-only manual payload; existing finder projection tests remain unchanged.

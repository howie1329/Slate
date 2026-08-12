# Plan 036: Planning toolbar task finder MVP

> **Status:** Complete
>
> **Parent:** Stage 3 — Full-window Planning workspace
>
> **Scope:** Desktop-only task finding and Task inspector handoff

## Problem Statement

The full-window Planning workspace currently keeps a persistent search field in the center of the Planning toolbar. Typing into it filters cards in place across the Board. This consumes the toolbar's strongest visual position, makes the Board rearrange while the user is trying to locate one task, and blurs the distinction between finding a specific task and changing the Board through its existing Filter control.

The user needs a quick, keyboard-friendly way to find any current task and open its Task inspector without changing the Board underneath them. The interaction should feel like a focused desktop utility, remain visually quiet while idle, and avoid growing into a general command palette or advanced query system.

## Solution

Replace the Planning toolbar's Board-filtering search behavior with a compact **Find a task** input in the same central header position. The field expands while focused or populated and remains available only on the Planning Board; the menu-bar popover and Settings surface remain unchanged.

Focusing the field by pointer or `Command-F` prepares it for input and expands the field. Once the user enters a non-empty query, a bounded, non-modal result popup opens directly below the header. It searches task titles across Capture, Ready, Today, and Done from the authoritative Planning snapshot. Matching is case-insensitive and word-based: every query word must appear somewhere in the title, but the words do not need to be adjacent.

Results preserve canonical Lane order and task order, show enough metadata to distinguish similarly named work, and support pointer or keyboard selection. Choosing a result closes the finder and opens that task in the existing Task inspector. Search does not filter, dim, reorder, or otherwise mutate the Board.

## User Stories

1. As a Slate user, I want task search available in the desktop header, so that finding work stays immediately accessible beside Board controls.
2. As a Slate user, I want the header finder to remain compact while idle and expand while active, so that it balances toolbar space with comfortable query entry.
3. As a Slate user, I want to click the header search field, so that I can start finding a task with the pointer.
4. As a keyboard-oriented Slate user, I want `Command-F` to focus and select the header search text, so that I can begin a new search without reaching for the pointer.
5. As a Slate user, I want entering text to open results immediately below the header, so that matches remain close to the field that controls them.
6. As a Slate user, I want an empty search field to leave the popup closed, so that focusing search does not introduce unnecessary content.
7. As a Slate user, I want search to include Capture tasks, so that unshaped work remains discoverable.
8. As a Slate user, I want search to include Ready tasks, so that estimated available work remains discoverable.
9. As a Slate user, I want search to include Today tasks, so that current commitments remain discoverable.
10. As a Slate user, I want search to include Done tasks, so that recently completed work remains discoverable without changing views.
11. As a Slate user, I want matching to ignore letter case, so that capitalization never prevents me from finding a task.
12. As a Slate user, I want separate query words to match anywhere in a title, so that `launch notes` can find `Prepare launch meeting notes`.
13. As a Slate user, I want every entered query word to match, so that adding a word narrows results predictably.
14. As a Slate user, I want leading, trailing, and repeated whitespace ignored, so that ordinary typing does not produce surprising misses.
15. As a Slate user, I want matches to preserve Slate's canonical Lane and task order, so that results are deterministic and do not invent an opaque relevance score.
16. As a Slate user, I want each result to show its title and Lane, so that I can distinguish similarly named tasks.
17. As a Slate user, I want each result to show an estimate when one exists, so that I can identify the intended task quickly.
18. As a Slate user, I want each result to show its useful date or exception state, such as Overdue, so that task context remains legible.
19. As a Slate user, I want matching words emphasized in result titles, so that I can understand why each task matched.
20. As a Slate user, I want the number of matching tasks announced and visible, so that I understand the scope of the result set.
21. As a keyboard-oriented Slate user, I want the first result selected when matches appear, so that pressing Enter can open the likely task immediately.
22. As a keyboard-oriented Slate user, I want Up and Down Arrow to move through results while focus remains in the search field, so that I can navigate efficiently.
23. As a keyboard-oriented Slate user, I want selection to remain within the first and last result rather than wrap unexpectedly, so that navigation stays predictable.
24. As a Slate user, I want Enter to open the selected result, so that finding a task leads directly to its existing detail workflow.
25. As a pointer user, I want clicking a result to open it, so that keyboard navigation is optional.
26. As a Slate user, I want opening a result to close and clear the finder, so that stale search state does not remain after I begin working on the task.
27. As a Slate user, I want Escape to close and clear the finder, so that I can abandon search in one action.
28. As a Slate user, I want closing the finder to return focus to a sensible Board target, so that keyboard flow is not stranded in a hidden surface.
29. As a Slate user, I want a clear control when text is present, so that I can reset the query without selecting its contents manually.
30. As a Slate user, I want a concise `No matching tasks` state when nothing matches, so that an empty popup is understandable.
31. As a Slate user, I want the result list to scroll when many tasks match, so that the popup remains bounded within the desktop window.
32. As a Slate user, I want the active result to stay visible while I navigate, so that keyboard selection never moves offscreen.
33. As a Slate user, I want the Board to remain unchanged while searching, so that finding one task does not disrupt my planning context.
34. As a Slate user, I want active Board Filter and Sort choices to remain unchanged, so that using the finder has no side effects on the current view.
35. As a Slate user, I want finder results to remain independent of the current Board Filter and Sort choices, so that hidden or differently sorted tasks are still findable.
36. As a Slate user, I want a task changed in another Slate window to refresh in the result set, so that the finder reflects the current local source of truth.
37. As a Slate user, I want a task removed while searching to disappear safely, so that I cannot open stale work.
38. As a VoiceOver user, I want the field, popup, result count, active result, and result metadata exposed semantically, so that I can use the finder without relying on visual position.
39. As a Full Keyboard Access user, I want visible focus and standard combobox behavior, so that the finder feels consistent with a desktop utility.
40. As a user with Reduced Motion enabled, I want the popup to appear and disappear without unnecessary movement, so that search remains comfortable.
41. As a menu-bar popover user, I want its existing search and capture workflow unchanged, so that this desktop improvement does not expand the compact surface.
42. As a Settings user, I want the Settings toolbar to remain unchanged without a task finder, so that search appears only where tasks can be opened.

## Implementation Decisions

- Treat this feature as a **Task finder**, not a Board filter and not a command palette. User-facing copy should use **Find a task** or **Search tasks** consistently.
- Keep one compact search field centered in the Planning toolbar when the full-window Planning Board is active. Preserve the existing date, Planning view, Filter, Sort, overflow, window-control, status-message, and Settings behavior.
- Keep the field around `14rem` while idle and expand it responsively up to about `28rem` while focused or populated. It may shrink at the configured minimum window width without overlapping the surrounding toolbar controls.
- Display a search icon, the placeholder **Find a task…**, a visible `⌘F` hint while empty, and a clear control while populated.
- Register `Command-F` only within the full-window Planning workspace. It focuses the header input and selects existing query text. It must not override native text-field Find behavior while another editable control, such as the Task inspector title, has focus.
- Render the result popup in a portal or fixed transient layer so that Board and shell overflow boundaries cannot clip it.
- Anchor the popup below the search field. Use a width around `28rem`, capped by the available viewport width, and a bounded height around `20rem`. The exact responsive values may use existing design tokens and must remain usable at the full app's configured minimum size.
- Use Slate's transient-layer vocabulary: semantic background, restrained boundary or ring, compact radius, and only the existing transient shadow treatment. Do not add a modal backdrop or decorative elevation.
- Open the popup only for a non-empty normalized query. The MVP has no recent-task or suggestion state while the query is empty.
- Build one pure renderer projection that accepts the authoritative Planner snapshot and query, and returns a flat ordered list of task-finder results with task identity, Lane, title, estimate, date, completion, and badge facts needed for presentation.
- Derive results from the canonical Capture, Ready, Today, and Done Lanes. Do not reclassify tasks from renderer-owned rules or query SQLite separately.
- Normalize the query by trimming it, lowercasing it with locale-aware behavior, and splitting on whitespace. A task matches only when every non-empty query token is contained in its normalized title.
- Preserve canonical Lane order—Capture, Ready, Today, Done—and the current task order within each Lane. Do not add fuzzy scoring, relevance weighting, or a search dependency in the MVP.
- Results are independent of active Board Filter and Sort state. Finder use must not modify those states or the Board projection.
- Result rows show title, Lane, estimate when present, and one concise date or exception cue when useful. Avoid duplicating full Task inspector content.
- Emphasize matched title substrings without changing the stored title or relying on color alone.
- Keep the query and active-result identity in ephemeral renderer state. Closing the finder clears both; no search history or preferences are persisted.
- Use standard combobox/listbox semantics. Keep DOM focus in the input while Arrow keys update `aria-activedescendant`; pointer interaction remains supported.
- Select the first result whenever a new query produces results. Up and Down Arrow clamp at the list bounds. Active navigation scrolls the selected option into view.
- Enter opens the active task through the existing task-selection boundary, closes and clears the finder, and allows the existing Task inspector to take over focus behavior.
- Escape closes and clears the finder. Pointer dismissal does the same. Closing without selecting returns focus to the search field or the existing sensible Board focus target according to the dismissal path.
- Refresh results from the existing planner snapshot invalidation flow. If the active task disappears, select the first remaining result or show the empty state.
- Do not add or change native commands, SQLite schema, Planner Events, task revisions, permissions, Keychain behavior, sidecar behavior, or network access.
- Keep the menu-bar popover's Daily command row and search/capture behavior unchanged.
- Keep Settings inside the stable Planning workspace shell, but omit the Task finder from the Settings toolbar.
- Update product and design documentation to distinguish desktop Task finding from Board filtering and compact-popover search/capture.

## Testing Decisions

- The primary automated test seam is the pure Task finder projection. This is the highest practical existing-style seam: it consumes an authoritative Planner snapshot and returns the complete user-visible result model without React, DOM, Tauri, or persistence dependencies.
- Good tests assert externally meaningful behavior: which tasks match, their order, their Lane and metadata, and how normalization changes results. They do not assert private helper names, iteration strategy, temporary arrays, CSS utility order, or component nesting.
- Projection tests cover every Lane, including Done; case-insensitive matching; one-word and multi-word queries; non-adjacent query words; all-token requirements; leading, trailing, and repeated whitespace; empty queries; no matches; duplicate titles; estimates; dates; badges; and canonical result order.
- Projection tests prove that results depend only on the authoritative snapshot and query, not active Board Filter or Sort state.
- Reuse the repository's focused Node test pattern used by Planning Board projection tests. Add a dedicated Task finder test only if keeping the behavior separate makes the public seam clearer than extending the existing Planning Board test.
- Add a narrow rendered-surface test at the existing React server-render seam where practical. It should assert accessible labels and the idle, populated-results, and no-results structures, not internal hooks or event handlers.
- Manual keyboard acceptance covers `Command-F`, text selection, query entry, first-result selection, Arrow navigation, clamped bounds, Enter handoff to the Task inspector, Escape dismissal, clear control, pointer selection, pointer dismissal, and focus restoration.
- Manual visual acceptance covers ordinary and minimum desktop widths, result scrolling, long titles, similar titles, all four Lane metadata variants, light and dark themes, visible focus, VoiceOver announcements, and Reduced Motion.
- Regression acceptance confirms the Board does not filter or reorder during finder use, Filter and Sort state survive search, Settings behavior is unchanged, and the menu-bar popover retains its existing Daily command row behavior.
- `npm run build` is the required production build and type-check validation. Focused Node tests should be run directly because the repository still does not define a standard JavaScript test command.
- Native Rust tests are not required for implementation-only iterations because the MVP does not change native behavior. Run them only if implementation unexpectedly touches the native boundary, which should be treated as a scope warning.

## Out of Scope

- Filtering, dimming, highlighting, scrolling, or rearranging cards on the Board while searching.
- Persisted search queries, search history, recent tasks, suggested tasks, saved searches, or pinned searches.
- Searching Planner Event history, past task titles, deleted tasks, Settings, planning instructions, or AI content.
- Searching fields other than the current task title.
- Fuzzy matching, typo tolerance, stemming, synonyms, ranking heuristics, relevance scores, or a third-party search dependency.
- Query syntax, operators, quoted phrases, Lane prefixes, dates, durations, filters, tokens, or removable filter chips.
- Task creation, inline editing, completion, movement, deletion, or batch actions from search results.
- Expanding the finder into a command menu, action launcher, navigation palette, or AI entry point.
- Multi-select, bulk operations, drag-and-drop from results, or result reordering.
- A separate native search window, global macOS shortcut, Spotlight integration, menu-bar search changes, or quick-capture changes.
- New routes, List or Week views, Spaces, projects, tags, notes, subtasks, integrations, sync, or mobile behavior.
- Native persistence, SQLite, Planner Event, Keychain, sidecar, credential, permission, or network changes.
- Changing the Workspace status bar or redesigning unrelated Board, Task inspector, or Settings controls.

## Further Notes

- This is a deliberately small desktop MVP. Its success criterion is faster retrieval and inspector access without disturbing the Board, not broader search power.
- The header placement keeps finding immediately accessible while its popup behavior preserves the distinction between opening a task and filtering the current Board.
- ADR-0001 remains authoritative. Finder results are derived from existing task facts and canonical Planning Lane membership; the feature must not add a persistent status or parallel task model.
- If real use shows demand for recent tasks, history search, query tokens, or commands, those should be evaluated as separate follow-up slices rather than hidden inside this MVP.

## Comments

- Specification synthesized from the desktop Board screenshot and refined to the agreed expanding header-popup direction on 2026-08-12.
- Implemented on 2026-08-12 and refined after review. The full-window Planning toolbar now hosts a compact Task finder that expands while active and opens its bounded results below the header. The finder projects ordered title matches from the authoritative Planning snapshot, supports accessible pointer and keyboard selection, opens the existing Task inspector, and leaves Board Filter, Sort, ordering, native persistence, Planner Events, the Workspace status bar, Settings, and the menu-bar popover unchanged.

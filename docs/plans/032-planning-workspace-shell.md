# Plan 032: Establish the Planning workspace shell

> **Status:** Implemented; historical implementation record
>
> **Parent:** Stage 3 — Full-window planning workspace, 2.0 foundation
>
> **Scope:** Original shell-only slice; later plans now provide the Planning view contents and interactions

> **Current-tree note:** The shell, toolbar, inspector boundary, status bar, and native window behavior described here are implemented. The original Coming Soon placeholder and “future views are not shipped yet” language describe the slice’s starting point and are retained as historical design context; the current full-window route now hosts Board and List views.

## Problem Statement

Slate's full app currently enlarges the same Daily workspace used by the menu-bar popover. It does not yet have a distinct full-screen composition for the future Planning workspace, so the application lacks a stable place for full-window navigation, a Planning toolbar, a responsive Workspace inspector, Settings, windowed controls, and global layers. Adding board or list content directly to the current root layout would entangle those features with popover-specific geometry and the compact footer.

The user needs the full app to feel like a deliberate macOS planning surface while the menu-bar popover remains the fast, compact Daily workspace. This first Stage 3 slice must establish that frame without inventing board behavior, duplicating planning rules, or expanding the task model.

## Solution

Create a distinct **Planning workspace shell** for Slate's full app. Opening the full app enters a frameless native macOS full-screen Space with square, edge-to-edge content. The shell provides a custom React **Planning toolbar**, a full-width content frame, an optional responsive **Workspace inspector**, a compact **Workspace status bar**, and ownership of global transient layers.

The menu-bar popover continues to render the existing Daily workspace and compact footer unchanged. Until later 2.0 work supplies Board and List, the full app shows a centered Coming Soon state rather than duplicating the Daily workspace. The shell remains the stable host for future Planning content and Settings without copying or rewriting popover-specific domain behavior.

The shell has no permanent sidebar in this slice and reserves no visible sidebar space. Its composition should permit a future sidebar to be added without replacing the shell boundary. Settings opens inside the stable shell and is accessible only from the Workspace status bar.

## Shaped Design Brief

### Feature summary and primary action

This slice creates the production-ready frame for Slate's future full-window Planning workspace. It is for one person who has opened Slate on a Mac to understand the surface while future Planning views are still being designed. The shell must make the Coming Soon state clear without making the full app feel unfinished or competing with the compact Daily workflow in the popover.

The primary user action in this slice is understanding that the full-window Planning views are not shipped yet. The shell should disappear around that message: the thin toolbar orients the user, the centered placeholder sets expectations, and Settings and quiet global feedback remain available without competing with future content.

### Design direction

- **Color strategy:** Restrained. Use Slate's semantic monochrome surfaces, hairline boundaries, and existing light/dark tokens. Primary contrast communicates action, focus, selection, or capacity state only.
- **Scene:** An individual knowledge worker opens Slate on a Mac in ordinary office or home ambient light, focused but wary of overcommitting; the surface should feel calm in the system-selected light or dark appearance rather than forcing either theme.
- **Anchors:** macOS Finder for toolbar discipline and window familiarity, Raycast for compact keyboard-first utility density, and Things for calm task hierarchy. These are behavioral and compositional references, not visual templates to copy.
- **Selected composition:** Use the approved light-theme direction probe: a thin full-width toolbar, a calm centered Coming Soon state in the main canvas, and a thin full-width status bar.
- **Probe refinement:** Make the toolbar and status bar visibly thinner than the probe. Target a `32px` toolbar and `24px` status bar, with `24px` toolbar controls. Do not reproduce the probe's speculative Weekly, Upcoming, notification, synchronization, focus, or metric controls.

### Scope

- **Fidelity:** Production-ready.
- **Breadth:** The complete full-app shell across Planning placeholder, Settings, and responsive window states; the popover is regression scope only.
- **Interactivity:** Shipped-quality renderer composition and native window behavior, not a static mockup.
- **Time intent:** Polish until the shell is implementation-ready and can safely host later Board and List work.

### Layout strategy

The shell is one edge-to-edge vertical composition: Planning toolbar, flexible workspace canvas, and Workspace status bar. It has square corners in native full-screen and uses the existing full-app window background in windowed mode.

Within the workspace canvas:

- Center the Coming Soon state in the full available canvas. It should remain calm and readable at both wide and minimum window sizes.
- Do not reserve space for the future sidebar or inspector in this placeholder state.
- At the configured `560 × 620` minimum, preserve toolbar navigation and Settings access while keeping the placeholder legible.
- Keep the canvas flat. The Coming Soon state uses the shell canvas directly; the shell must not wrap it in another card or add decorative elevation.

### Key states

| State | Required presentation and behavior |
| --- | --- |
| Planning, idle | A centered Coming Soon state is visible; the inspector is absent and no Daily content is duplicated into the full app. |
| Task detail / AI review | Deferred with the Daily workspace; these remain available in the menu-bar surface and are not composed into the desktop placeholder. |
| Settings | The toolbar and status bar remain stable, Settings replaces the main content, contextual inspector state closes, and a clear Back to Planning action is present. |
| Loading | Preserve shell geometry and show a bounded skeleton or existing loading treatment in the content region; do not replace the workspace with a centered spinner. |
| Persistence unavailable | Show the existing actionable local-data recovery treatment above or within the shell without implying data loss or network dependence. |
| Coming Soon | Center the concise **Coming soon** state in the Planning canvas; it is explanatory, not an action or a disabled control. |
| Inspector transition | Move or crossfade only to clarify the dock/overlay state; focus enters meaningful inspector content and returns to its trigger on close. |
| Native full-screen | Square edge-to-edge shell; no custom traffic lights or drag region. |
| Windowed | Frameless movable window with macOS-style close, minimize, and full-screen controls at the toolbar's leading edge. |
| Reduced Motion | Inspector and route state changes use an instant transition or short crossfade with no spatial choreography. |

### Interaction model

- Opening the full app closes the popover, focuses the main window, and enters native macOS full-screen. Leaving full-screen keeps a movable frameless Slate window open.
- The `32px` Planning toolbar is an orientation and command boundary, not a destination bar. This slice keeps it quiet while future Planning controls remain unearned; it must not expose speculative Planning views.
- The full-app placeholder has no active task or AI inspector. Those workflows remain available in the menu-bar Daily surface until a future Planning view composes them into this shell.
- The `24px` Workspace status bar provides one Settings entry and a reserved live region for concise persistence or operation feedback. It does not show task counts, capacity, synchronization theater, or a duplicate view selector.
- Keyboard order follows the visual structure: window controls when present, toolbar, main content, inspector when active, then status bar. Hidden or dismissed regions cannot retain focus.

### Content requirements

- Toolbar title: **Planning**.
- Coming Soon state: **Coming soon** with supporting copy **Planning views are on the way.** It is explanatory, not a disabled control or a call to action.
- Settings return action: **Back to Planning**.
- Status feedback should be event-driven and concise, such as **Saved locally** or an actionable persistence message. Do not show a permanent synchronization claim when no synchronization exists.
- Preserve current Daily, task-detail, AI-review, onboarding, and persistence-recovery copy unless this shell requires a spatially shorter label.
- Use the existing icon family and semantic labels. The Coming Soon state may use one quiet existing planning/view icon, but no generated illustration is required.

### Implementation references

During implementation, apply Impeccable's product register for familiar component behavior, `layout.md` for the responsive canvas and inspector geometry, `adapt.md` for the `560 × 620` minimum-window behavior, and `animate.md` only for inspector and route state transitions. `DESIGN.md` remains authoritative for tokens and component vocabulary.

## User Stories

1. As a Slate user, I want Open full app to enter a native macOS full-screen Space, so that the Planning workspace feels distinct from the menu-bar popover.
2. As a Slate user, I want the full app to be frameless in native full-screen, so that the workspace uses the screen without redundant window chrome.
3. As a Slate user, I want the full-screen surface to have square edge-to-edge corners, so that no rounded application mask interrupts the full-screen canvas.
4. As a Slate user, I want the popover to close when the full app opens, so that I do not have two competing Slate surfaces visible.
5. As a Slate user, I want leaving native full-screen to keep Slate open as a movable frameless window, so that macOS full-screen remains my choice rather than a forced state.
6. As a Slate user, I want standard window controls when Slate is windowed, so that I can close, minimize, or return to full-screen without relying on hidden shortcuts.
7. As a Slate user, I want windowed controls and the drag region hidden in native full-screen, so that redundant chrome does not consume space.
8. As a Slate user, I want the full app to have a stable Planning toolbar, so that future planning controls have a predictable home.
9. As a Slate user, I want the Planning toolbar to feel consistent with macOS while remaining visually consistent with Slate, so that it feels native without introducing a second UI system.
10. As a Slate user, I want the toolbar, content, inspector, and status bar to form one calm composition, so that the full app does not resemble a collection of unrelated panels.
11. As a Slate user, I want the shell canvas to use the available width without stretching the temporary Daily workspace into long task rows, so that the full app feels spacious without weakening scanability.
12. As a Slate user, I want contextual work to appear in a right-side Workspace inspector on wide windows, so that I can inspect it without losing the surrounding planning context.
13. As a Slate user, I want the Workspace inspector to overlay rather than crush content at narrow widths, so that the minimum-size window remains usable.
14. As a Slate user, I want task detail and AI review to share one inspector region, so that transient workflows do not compete for different parts of the shell.
15. As a Slate user, I want task detail and AI review to remain mutually exclusive, so that I always understand which contextual action is active.
16. As a Slate user, I want the inspector to disappear when no contextual interaction is active, so that the Planning workspace remains spacious and calm.
17. As a Slate user, I want a compact Workspace status bar, so that Settings and quiet global feedback have a consistent home without becoming a dashboard.
18. As a Slate user, I want Settings access in the status bar only, so that navigation is not duplicated across the shell.
19. As a Slate user, I want Settings to replace only the shell's main content, so that the application frame remains stable while I configure Slate.
20. As a Slate user, I want a clear return from Settings to Planning, so that Settings does not feel like a separate application.
21. As a Slate user, I want contextual inspectors to close when I enter Settings, so that task or AI state does not remain active behind a different destination.
22. As a Slate user, I want the existing planning workflow to remain usable while the shell is introduced, so that this structural change does not require the later Board or List work.
23. As a Slate user, I want the menu-bar Daily workspace to keep its existing compact command row, task layout, detail behavior, AI review, and footer, so that the fast daily loop does not regress.
24. As a Slate user, I want full-app and popover actions to use the same persisted task and capacity state, so that the new shell does not create a second planning system.
25. As a Slate user, I want the shell to preserve local-first behavior, so that opening the full app does not require an account, AI provider, or network connection.
26. As a keyboard user, I want every shell navigation and window action to have a visible focus state, so that the full app is operable without a pointer.
27. As a screen-reader user, I want the toolbar, main content, inspector, and status bar exposed as meaningful landmarks, so that I can understand and navigate the shell structure.
28. As a user with Reduced Motion enabled, I want shell state changes to avoid unnecessary movement, so that opening inspectors or changing routes remains comfortable.
29. As a light-theme user, I want the shell to use Slate's semantic surface and boundary tokens, so that it remains readable and cohesive.
30. As a dark-theme user, I want the same shell hierarchy and contrast to remain clear, so that full-screen presentation does not depend on a light canvas.
31. As a user with a narrow window, I want the shell to remain usable at the configured minimum dimensions, so that leaving native full-screen does not produce an unusable layout.
32. As a user with a large display, I want the content frame to expand deliberately without decorative empty panels, so that the full-screen workspace feels spacious rather than sparse.
33. As a Slate user, I want loading and persistence recovery to remain understandable within the full app, so that the shell never hides whether local data is available.
34. As a Slate user, I want accepted mutations and cross-window refreshes to behave exactly as before, so that introducing the shell does not weaken stale-state or persistence guarantees.
35. As a Slate user, I want onboarding and global notices to remain usable above the shell, so that structural layering does not obscure required interactions.
36. As a Slate user, I want the shell to avoid a permanent sidebar for now, so that the 2.0 foundation does not imply destinations Slate has not earned.
37. As a future Slate user, I want the shell's layout to support adding a sidebar later, so that validated navigation needs do not require replacing the entire full-app frame.
38. As a Slate user, I want Board and List to eventually feel like views inside one Planning workspace, so that the shell does not frame them as separate products or routes.
39. As a Slate user, I want no new project-management concepts introduced by the shell, so that Slate remains focused on realistic daily commitments.
40. As a maintainer, I want the shell to host existing features through explicit composition boundaries, so that future Board, List, inspector, and toolbar work can evolve independently.

## Implementation Decisions

- The full app and menu-bar popover are complementary surfaces. The full app receives the new Planning workspace shell and Coming Soon state; the popover retains the existing Daily workspace composition.
- The Planning workspace shell is a renderer-owned UI composition boundary. It owns the background, Planning toolbar, primary content frame, optional Workspace inspector region, Workspace status bar, and global transient-layer placement. It does not classify tasks, calculate capacity, or define mutation rules.
- The shell should be expressed as one small presentational composition with explicit content slots or similarly narrow inputs. It must not become a broad controller that owns task, AI, Settings, persistence, and window behavior internally.
- The full app uses a custom React Planning toolbar designed to feel native. A literal AppKit toolbar and a hybrid native/web toolbar are rejected for this slice.
- The 2.0 foundation has no permanent sidebar and no reserved empty sidebar rail. The shell canvas uses the full available width for the temporary Coming Soon state. The shell composition must still permit a future navigation region and inspector to be introduced without rewriting hosted content.
- The toolbar is the eventual home for search and capture, entry into reviewable AI actions, Planning view selection, and current capacity context. This spec establishes a `32px` toolbar region and does not define their final composition or add new actions.
- The `24px` Workspace status bar replaces the full app's inherited compact utility footer. It remains visually subordinate, contains Settings access only once, and reserves a quiet region for transient operation or persistence feedback. It must not display decorative metrics or task content.
- Settings remains a declarative route but renders inside the stable full-app shell. Entering Settings replaces the primary content and closes contextual inspector state. Settings does not open in a separate native window or beside planning content.
- The Workspace inspector is the shell's single right-side contextual region. Task detail and AI review are mutually exclusive modes of this region. Their existing internal behavior remains authoritative; this slice changes composition and geometry, not task editing or AI review contracts.
- The inspector is absent when idle. At shell widths of `960px` or greater it docks beside primary content at `320px`. Below `960px` it overlays the content at `min(360px, calc(100% - 24px))` rather than forcing both regions into an unusably small split.
- Responsive behavior must be based on available shell width, not an assumption that the main window is always full-screen. The configured 560 by 620 minimum window remains an acceptance boundary.
- The shell distinguishes the main application window from its actual native full-screen state. Main-window identity alone is insufficient because the user may leave native full-screen while remaining in the same window.
- In native full-screen, the main app remains frameless, square, and free of custom drag or window controls. In windowed mode, the shell exposes a drag region and standard macOS-style close, minimize, and full-screen controls at the toolbar's leading edge.
- Opening the full app continues to hide the popover, activate Slate as a regular macOS application, show and focus the main window, and enter native macOS full-screen. Closing the main window continues to hide rather than destroy Slate and restores menu-bar accessory behavior.
- Existing native commands, planning projection, SQLite source of truth, task revisions, atomic mutations, Planner Events, Keychain boundary, and cross-window invalidation remain unchanged.
- Until Board and List ship, the full-app Planning route uses a centered Coming Soon placeholder. The popover remains the sole surface for the existing Daily workspace in this slice.
- The shell uses the existing semantic color, typography, spacing, focus, and motion vocabulary. Static regions use tonal separation and hairline boundaries rather than decorative shadows or nested cards.
- The shell must provide semantic landmarks and predictable focus order. Opening or closing an inspector, entering Settings, and changing native window state must not strand focus in hidden content.
- Route additions, if any, are made through route source files and generated router output is never edited manually.
- This slice introduces no task schema, planning-status field, native planning command, API contract, or SQLite migration.

## Testing Decisions

- The single automated seam is the complete presentational Planning workspace shell contract. Render the real shell with representative slot content and assert externally visible semantics rather than internal component state.
- The shell contract covers: toolbar landmark presence; centered Coming Soon content placement; status-bar presence; Settings placement; inspector absence in the placeholder state; and semantic ordering of landmarks.
- The shell contract also covers the Settings state at the same seam: the outer shell remains present, planning content is replaced, and contextual inspector content is absent.
- Prefer the repository's lightweight Node-based test style and existing React dependencies. Do not introduce a broad browser-testing framework or large UI-test dependency solely for this shell.
- Responsive styling is validated at representative wide full-screen and `560 × 620` minimum-window dimensions. Acceptance verifies the `32px` toolbar, `24px` status bar, centered Coming Soon state, and Settings access. The automated component seam should assert state or class contracts only where those are externally meaningful; it should not snapshot implementation-heavy markup.
- Native macOS behavior is validated through packaged or development-app acceptance because the repository has no native-window UI harness. Acceptance covers opening from both the menu-bar command and popover button, entering a native full-screen Space, square full-screen corners, leaving full-screen, windowed drag behavior, window controls, hiding on close, and reopening into full-screen.
- Manual visual acceptance covers light and dark themes, Reduced Motion, visible keyboard focus, Coming Soon layout, Settings navigation, loading, persistence recovery, onboarding layering, and popover regression at its configured minimum size.
- `npm run build` is the required renderer build and type-check validation. Native changes require the existing Rust test suite. The repository still has no standard test script, so this spec does not invent or document one as a project command.
- Good tests assert what the user can perceive or do: which shell regions exist, which content is visible, whether focus remains usable, and how the window presents. They do not assert private hook names, DOM nesting unrelated to semantics, internal CSS utility ordering, or native implementation details.

## Out of Scope

- Board, List, Capture, Ready, Today, or Done view contents.
- Board/List switching behavior, final toggle design, or persistence of the selected Planning view.
- Final toolbar layout, dedicated search-versus-capture behavior, new-task composition, or command-menu behavior.
- Expanded Plan My Day review, new AI controls, AI Assist redesign, or any 2.1 planning-acceleration work.
- Redesigning task-detail fields, task mutations, AI-review contents, or review acceptance behavior.
- New status-bar metrics, task counts, capacity duplication, connection dashboards, or decorative local-storage indicators.
- A permanent sidebar, sidebar destinations, Spaces, projects, tags, or navigation for unearned future capabilities.
- Board lane derivation, cross-lane movement, drag-and-drop, capacity previews, keyboard movement, batch actions, or reviewed change sets.
- Changes to the task model, native planning projection, SQLite schema, event vocabulary, stale-state validation, or persistence boundaries.
- A native AppKit toolbar, separate Settings window, additional application windows, or non-macOS shell expansion.
- Stage 2.1–2.3 features including filters, multi-select, horizon views, Needs Attention, Focus mode, Make This Fit, history inspection, unfinished-day review, or changed-day recovery.

## Further Notes

- This plan is the first UI slice of the Stage 3 2.0 foundation. It creates the frame needed by later Planning views but does not claim that the Stage 3 evidence gate has been satisfied for the complete board experience.
- The domain glossary defines Daily workspace, Planning workspace, Planning workspace shell, Full app, Planning toolbar, Workspace status bar, Workspace inspector, Task inspector, and Planning view. Implementation and UI copy should use those terms consistently.
- The existing decision to derive planning state from task facts remains authoritative. The shell must not introduce a persistent kanban status or a parallel renderer-owned planning model.
- The popover remains Slate's primary surface and must continue supporting the normal daily loop independently of the full app.

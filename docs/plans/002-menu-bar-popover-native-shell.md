# Implementation plan: macOS menu-bar popover and full-app shell

## Objective

Make Slate a reliable menu-bar-first macOS application before task-domain work begins. The menu-bar icon opens a compact workspace that dismisses when focus moves away; **Open Full App** opens the same workspace in a larger normal window. Both surfaces remain available for every MVP workflow and will eventually read and write the same local data.

This plan intentionally establishes native window behavior and its frontend boundary only. SQLite, Keychain, task-domain logic, AI, and global shortcuts stay deferred to their respective MVP phases.

## Branch and starting point

- **Branch:** `feat/menu-bar-popover`
- **Base:** `main` at `cccda5c` (`Merge pull request #4 from howie1329/ui/today-screen`)
- The branch was created from a clean worktree before this plan was added.
- Keep the work limited to the native shell, shared frontend shell, native icon assets, and their supporting documentation. Do not edit `src/routeTree.gen.ts`.

## Product constraints

- The macOS menu-bar popover is the default Slate experience. It must show the same GUI and actions as the full app, not a shortcut-only subset.
- The compact workspace must remain usable at **440×640** and no smaller than **360×520**.
- The full app is additional room for the same workflow, not a second product with new behavior.
- Clicking outside the compact surface dismisses it. Closing either surface keeps Slate alive in the menu bar; only **Quit Slate** exits the application.
- Keep the UI quiet and compact-first: semantic design tokens, visible keyboard focus, normal controls, and no decorative window chrome.
- Do not add the eventual global capture shortcut, notifications, background agents, or cloud state in this work.

## Architecture decision

Use two Tauri webview windows, backed by one native application process:

| Surface | Label | Native characteristics | UI role |
| --- | --- | --- | --- |
| Menu-bar popover | `popover` | 440×640, minimum 360×520, initially hidden, undecorated, non-taskbar, transparent and rounded; displayed in the upper-right of the target display above normal apps | Default compact Slate workspace |
| Full app | `main` | Normal decorated/resizable window, roughly 760×820 with a practical minimum around 560×620 | The same workspace with more room |

The `popover` is a Tauri webview window presented and positioned as a popover panel, rather than a custom AppKit `NSPopover`. A minimal macOS window-level adjustment keeps it over normal apps, across spaces, and as a full-screen auxiliary window without taking on a custom Cocoa popover implementation.

Both windows load the same React entry point and routes. The frontend may use a presentation-mode value (`popover` or `full`) to tune density and expose **Open Full App**, but it must not branch task behavior by window.

Native code owns creation, placement, visibility, close behavior, and cross-window lifecycle. React requests the small native actions it needs through typed Tauri commands; components must not manipulate arbitrary window labels directly.

## Native interaction contract

### Tray icon

1. Create one tray icon during Tauri startup with a dedicated, small monochrome transparent template image.
2. Mark the icon as a macOS template image so macOS renders it appropriately in light and dark menu bars.
3. On left-button release:
   - Hide `popover` when it is already visible.
   - Otherwise resolve the display that owns the status-bar icon, place the popover at that display’s usable upper-right corner with a small inset, show it, and focus it.
4. Attach a minimal native context menu for right-click: **Open Full App** and **Quit Slate**. Do not expose task actions or duplicate application navigation in this system menu.

### Popover lifecycle

1. Create the `popover` once during setup, initially hidden. Reuse it for every toggle; do not create a new webview per click.
2. On loss of focus, hide only the popover. Ignore focus events that belong to the explicit show/hide transition so a tray click cannot immediately close the just-opened surface.
3. Treat a close request for `popover` as `prevent_close` + `hide`.
4. Keep normal keyboard focus inside the popover after opening. Escape should only dismiss an already-open transient UI first; when none is present it hides the popover.
5. Preserve no task state solely in this window. A later app restart should be able to recreate it from the shared local repository.
6. On macOS, use the popup-menu window level and all-spaces/full-screen-auxiliary behavior so the panel stays above the active app. The transparent window configuration relies on Tauri's `macOSPrivateApi` option and is therefore unsuitable for Mac App Store distribution.

### Full-app lifecycle

1. `open_full_app` shows, unminimizes, centers only if it has never been positioned, and focuses `main`.
2. It does **not** hide the popover automatically; this avoids losing a capture the user initiated. The frontend can close the popover after a successful explicit handoff only if no transient draft or review state would be lost.
3. Treat a close request for `main` as `prevent_close` + `hide`, leaving the tray icon active.
4. The native menu’s **Quit Slate** exits explicitly and is the only route that destroys windows during normal use.

## Shared-state contract for later app work

The current mock UI is sufficient to prove the shell, but it must not become the synchronization model. When SQLite-backed task/settings work arrives:

1. Route all reads and writes through the small Tauri repository boundary described in `docs/plans/001-mvp-daily-planning-loop.md`.
2. After every successful repository mutation, emit one typed `planner://changed` event with a monotonically increasing revision or a narrow invalidation scope.
3. Each open window refreshes its query state from the repository when it receives that event and when it becomes visible/focused.
4. A mutation is complete only after the repository write succeeds. Never use cross-window UI events as the source of truth.

This lets capturing in the popover, editing in the full app, and reopening either surface produce the same deterministic view of local data without duplicating a React store across webviews.

## Implementation sequence

### 1. Establish configuration and native assets

Files: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`

- Enable Tauri’s tray-icon feature at the existing major version; use the lockfile generated by Cargo rather than manually editing dependency versions.
- Keep `main` as the full app’s normal window and add a hidden `popover` window configuration with the compact dimensions, transparency, native shadow, and macOS-friendly flags above. Explicitly document the Mac App Store implication of enabling Tauri's `macOSPrivateApi` for transparent rounded corners.
- Scope the default capability to both `main` and `popover`; grant only the core window/invocation permissions needed by the frontend’s explicit native commands.
- Add a dedicated menu-bar template icon. Keep the existing application and bundle icons intact; a large colored app icon is not a tray icon. A small in-memory RGBA template is preferred when it avoids another image-decoding dependency.
- Decide the app’s macOS activation policy deliberately during implementation. Slate should remain discoverable via its tray icon and must not create duplicate Dock/window state when the compact panel is shown.

### 2. Implement the native tray controller

Files: `src-tauri/src/lib.rs` and, if it improves clarity, a small `src-tauri/src/window_controller.rs` module

- Create the tray icon in the Tauri `setup` hook and retain it for the whole process lifetime.
- Implement a small, typed controller with only `toggle_popover`, `hide_popover`, `open_full_app`, and `quit` responsibilities.
- Resolve the target display from the tray-click location, then position the panel at its upper-right usable-bound inset using Tauri’s desktop coordinate types correctly. Test the icon from a secondary display as well as the primary display.
- Register tray events, native context-menu events, `CloseRequested`, and focus events in this native boundary.
- Keep errors explicit in native logs and avoid `unwrap` for optional windows or tray locations. A missing popover must fail visibly during development rather than silently becoming an unresponsive menu-bar icon.

### 3. Add the shared frontend window bridge

Files: new `src/lib/window-mode.ts` (or equivalent focused module), `src/routes/__root.tsx`, relevant shared UI components

- Detect the current Tauri window label once at startup and expose a typed presentation mode to the shell.
- Add one in-app **Open Full App** action that invokes the narrowly scoped native command. It appears only in compact mode; it does not duplicate routes or task actions.
- Add keyboard handling for the compact panel without intercepting text input, dialogs, selects, or future AI review controls.
- Keep the existing route shell declarative and make the layout adapt through CSS classes/tokens, not separate popover route trees.
- Verify the footer, navigation, focus order, and scroll region remain usable in the compact panel before adding any full-app-only spacing enhancements.

### 4. Apply the compact/full visual treatment

Files: `src/routes/__root.tsx`, `src/styles.css`, and only the shared components that need mode-aware spacing

- In popover mode, preserve the existing dense 440×640 design, use the design tokens, and ensure the persistent footer stays visible without covering page content.
- In full mode, add room through width, page gutters, and available-height behavior only. Do not add a sidebar, dashboard panels, new navigation, or new feature controls.
- Use ordinary macOS-accessible buttons for Open Full App and Quit-adjacent actions; retain clear focus rings and reduced-motion behavior.
- Ensure undecorated compact-window edges, shadows, and rounded corners read as a quiet transient panel—not a decorative card inside a window.

### 5. Prepare the synchronization seam without implementing task storage

Files: native window bridge and a small shared frontend event interface only if required by the shell

- Define the `planner://changed` event name and payload type in one shared location, but do not add mock cross-window synchronization logic that later diverges from SQLite.
- Document that the repository implementation owns emitting this event after successful writes.
- Confirm opening both windows today does not cause route, mock-data, or focus errors; real-data synchronization is verified when persistence is introduced.

### 6. Verify macOS behavior and build output

- Run `npm run build` for the TypeScript/Vite build.
- Run `npm run tauri -- dev` and manually exercise the tray lifecycle on macOS.
- Run `npm run tauri -- build` only after the development lifecycle is sound, then verify the bundled app retains its tray behavior outside the development process.
- Do not add a test command to project documentation: no automated test command exists today.

## Manual acceptance matrix

| Scenario | Expected result |
| --- | --- |
| Launch Slate | The menu-bar icon is available; the chosen initial compact-surface behavior is consistent across launches. |
| Left-click hidden icon | One compact, rounded popover appears in the upper-right of the display that owns the clicked status item and receives keyboard focus. |
| Left-click visible icon | The same popover hides; no extra windows or webviews are created. |
| Show popover over another app or full-screen space | The compact popover remains above the active app while focused; the full app, if open, remains visible. |
| Right-click icon | Only the native Open Full App and Quit Slate menu is shown. |
| Open Full App from tray or popover | A normal larger `main` window is shown, focused, and renders the same current route and UI. |
| Close compact or full window | The surface hides and Slate continues running from the menu bar. |
| Quit Slate | All windows close and the menu-bar icon is removed. |
| Text input / dialog / select in popover | Keyboard interaction works; Escape does not discard input or close a child transient before that control handles it. |
| Primary and secondary displays | The popover opens under the clicked icon and remains wholly on that display. |
| 360×520 compact viewport | Navigation, route content, and persistent footer remain operable without obscured controls. |
| Release build | The packaged macOS app exhibits the same tray, hide, and full-app lifecycle as development. |

## Deferred work

- SQLite, Keychain, task repository commands, and the `planner://changed` emitter implementation.
- Today/Log/Settings task workflows and AI review tray.
- Global shortcut capture, notifications, launch-at-login, Dock-only behavior, and any cloud synchronization.
- Custom native AppKit popover integration. Revisit only if Tauri’s popover-window behavior fails the acceptance matrix; it is not a starting dependency.

## Completion criteria

- Slate runs as a stable menu-bar application with no duplicate windows on repeated toggles.
- The compact window dismisses reliably on outside interaction and leaves the full app alone.
- Full and compact surfaces share the same React shell and task capabilities.
- Close means hide; Quit means exit.
- The compact surface meets the 360×520 usability constraint and the full app merely provides more space.
- `npm run build` passes, development behavior is manually verified, and a release build is verified before this branch is handed off.

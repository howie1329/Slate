# Theme selector system research

Status: research recommendation, not an implementation plan  
Date: 2026-08-11

## Recommendation

Build the theme selector as a small Slate-owned preference system over the semantic CSS variables already in `src/styles.css`. Do not use shadcn/typeset as the theme engine, do not add `next-themes`, and do not add a second persistence package.

The first release should expose:

- **Appearance:** System, Light, Dark.
- **Palette:** a small curated set of complete neutral palettes, each with light and dark values. Keep the existing Slate palette as the default.
- **Text size:** Standard and Large only if accessibility testing shows it works throughout the compact window.
- **Density:** defer until Slate's hard-coded component dimensions have been normalized behind a few layout tokens. If shipped later, apply density to the full window while preserving the popover's compact contract.

This is extensible without asking users to design the product. It also stays compatible with Slate's design contract: a quiet, neutral desktop utility, one restrained contrast signal, semantic tokens, and a cohesive sans-serif UI.

## Is shadcn/typeset the right tool?

No—not for this job.

[shadcn/typeset](https://ui.shadcn.com/docs/typeset) styles the plain HTML produced by rendered Markdown: headings, paragraphs, lists, tables, code, and similar long-form content inside a `.typeset` container. Its presets tune three reading-rhythm controls (size, leading, and flow), inherit the application's theme tokens, and can support variants such as a roomy article or compact chat transcript. The [release announcement](https://ui.shadcn.com/docs/changelog/2026-07-typeset) is explicit that Typeset is one CSS file copied into the project and has no package or configuration layer.

That makes Typeset a good future option for a Markdown AI transcript, help article, release notes, or another long-form reading surface. It does not select light/dark mode, resolve the macOS appearance, define application palettes, persist user preferences, synchronize windows, or prevent a startup flash.

The relevant shadcn mechanism is its existing semantic-token model. [shadcn recommends CSS variables](https://ui.shadcn.com/docs/theming): components consume roles such as `background`, `foreground`, `primary`, `muted`, `accent`, `border`, `input`, and `ring`, so changing the variables restyles components without rewriting their classes. Slate already follows this model.

## Current Slate baseline

- `components.json` is already configured for shadcn `base-nova`, Base UI, Tailwind CSS variables, and `src/styles.css`.
- `src/styles.css` already maps shadcn semantic roles through Tailwind v4's `@theme inline`, then supplies complete `:root` and `.dark` token sets.
- `src/components/theme-provider.tsx` reads the persisted planner snapshot and toggles the `.dark` class, but supports only `light | dark` and defaults to light while the asynchronous snapshot loads.
- `src-tauri/src/persistence.rs` stores the theme in SQLite and validates only `light | dark`.
- Slate has three Tauri windows. A setting changed in one webview therefore needs deliberate cross-window synchronization.
- The design guide specifies the existing neutral palette and Inter/Intel One Mono typography. It rejects competing accent colors, decorative primary use, and serif type in controls and operational data.

This is a strong base. The weaknesses are the overloaded two-value `theme` field, no system mode, no pre-paint initialization, and no window synchronization—not a missing UI framework.

## Preference model

Keep requested preference separate from resolved appearance:

```ts
type ColorSchemePreference = "system" | "light" | "dark";
type ResolvedColorScheme = "light" | "dark";
type ThemePalette = "slate" | "warm" | "cool";
type ThemeDensity = "comfortable" | "compact";
type TextScale = "standard" | "large";

type ThemePreferences = {
  colorScheme: ColorSchemePreference;
  palette: ThemePalette;
  density: ThemeDensity;
  textScale: TextScale;
};
```

The names above are illustrative. Palette names should describe the visual character rather than expose implementation vocabulary such as `zinc-950`.

Do not encode combinations into strings such as `warm-dark-compact`. Independent fields allow system mode to resolve without changing the saved preference, keep validation understandable, and avoid a combinatorial migration problem.

For the first implementation, `density` and `textScale` can remain fixed defaults in the model until their end-to-end UI work is ready. Designing the schema for independent axes does not require exposing every axis immediately.

## CSS architecture

Continue using semantic roles in components. Palette selectors should only assign values to those roles:

```css
/* Existing Tailwind/shadcn mapping remains global. */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  /* ...the remaining semantic roles... */
}

:root[data-palette="slate"] {
  /* complete Slate light token set */
}

:root.dark[data-palette="slate"] {
  /* complete Slate dark token set */
}

:root[data-palette="warm"] {
  /* complete warm light token set */
}

:root.dark[data-palette="warm"] {
  /* complete warm dark token set */
}
```

Retaining the existing `.dark` selector is the lowest-risk path because Slate's Tailwind custom variant and any existing `dark:` utilities already use it. Add `data-palette`, `data-density`, and `data-text-scale` only for independent axes. Also set the root `color-scheme` property to the resolved value so browser-native controls and scrollbars use the correct appearance.

[Tailwind's dark-mode documentation](https://tailwindcss.com/docs/dark-mode) supports a selector-driven dark variant and describes a three-way light/dark/system control using `matchMedia()`. [Tailwind v4 theme variables](https://tailwindcss.com/docs/theme) create utility APIs and must be top-level; runtime values that vary by root selector should remain ordinary CSS custom properties, which is the pattern Slate already uses through `@theme inline` indirection.

Each palette must be a complete semantic contract, not a primary-color swatch. It needs both schemes and every role used by Slate, including task-detail tokens, capacity warning, focus ring, destructive states, overlays, inputs, charts, and any native-window-adjacent surfaces. Curated complete palettes prevent inaccessible or visually incoherent combinations.

Density should not redefine Tailwind's global `--spacing`. If added, introduce a deliberately small set of runtime component/layout variables such as control height, row height, and section gap. That makes the blast radius inspectable. The 360 × 520 popover should remain on the compact geometry required by `DESIGN.md`; density can initially affect only the full-window layout.

## Runtime architecture

Create one deep module responsible for theme behavior rather than spreading DOM mutations through settings controls:

1. `resolveColorScheme(preference, systemScheme)` is a pure function.
2. `applyThemeToDocument(preferences, resolvedScheme)` owns root classes, data attributes, and `color-scheme`.
3. `ThemeProvider` exposes requested preferences, resolved scheme, preview, commit, and reset-to-saved behavior.
4. The settings UI only edits a draft and asks the provider to preview it. Navigating away or cancelling restores the persisted preferences; a successful save commits them.
5. The small footer toggle should operate on the same preference model. It should not maintain a second light/dark state machine.

For System mode, subscribe only while that preference is active. In a normal browser/Vite preview, `window.matchMedia("(prefers-color-scheme: dark)")` provides the initial match and change events; [MDN documents](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia) that `matchMedia()` returns a `MediaQueryList` whose match state can be monitored. In Tauri, `getCurrentWindow().onThemeChanged()` is the native signal; the [Tauri window API](https://v2.tauri.app/reference/javascript/api/namespacewindow/#onthemechanged) defines it specifically as a listener for system-theme changes.

Use `getCurrentWindow().setTheme(null)` for System and `setTheme("light" | "dark")` for an explicit preference so native window appearance follows the application. [Tauri documents](https://v2.tauri.app/reference/javascript/api/namespacewindow/#settheme) that `null`/`undefined` follows the system and that theme is app-wide, rather than window-specific, on macOS. This is another reason to keep one global preference.

Audit capabilities as part of this change. Slate's `core:default` includes reading the window theme but the generated schema shows that setting it is a separate `core:window:allow-set-theme` permission. Grant that permission only to the window labels that call the API. Ensure the quick-capture webview can receive the small appearance event without broadening its native authority unnecessarily.

## Persistence and no-flash startup

SQLite should remain the authoritative setting store. Do not add `@tauri-apps/plugin-store`: the [official Store plugin](https://v2.tauri.app/plugin/store/) is another asynchronous, file-backed persistence system, which would duplicate Slate's existing SQLite source of truth without solving synchronous first paint.

Migrate the database from the single `theme` value to separate, checked columns such as `color_scheme`, `theme_palette`, `theme_density`, and `text_scale`. Existing `light` and `dark` users should migrate to the equivalent explicit `color_scheme`; new installs can default to `system`. Keep native validation and renderer unions aligned, and record the appearance change through the existing settings save boundary.

An asynchronous SQLite read happens after the webview begins rendering, so it cannot by itself guarantee a correct first paint. Use a deliberately tiny synchronous bootstrap cache in webview `localStorage`:

1. Put a short inline script in `index.html` before the application module. It reads a versioned, allow-listed object such as `slate.appearance.v1`, resolves System with `matchMedia`, and applies `.dark`, `data-palette`, `data-density`, `data-text-scale`, and `color-scheme` to `<html>` before React and the stylesheet render the app.
2. If the cache is absent, invalid, or from a newer schema, use the system scheme plus Slate's default palette and geometry. Never interpolate arbitrary cached strings into CSS.
3. After the planner snapshot loads, SQLite wins. Reapply the authoritative preferences and refresh the bootstrap cache if they differ.
4. Update the cache only after a durable settings save succeeds. A temporary Settings preview may mutate the DOM but should not mutate the bootstrap cache.

Tailwind explicitly recommends putting system-theme initialization inline in `<head>` to avoid a flash of unstyled/wrong-color content in its [system theme example](https://tailwindcss.com/docs/dark-mode#with-system-theme-support). The cache is therefore a paint optimization, not a second source of truth.

Slate's windows are currently configured as hidden initially, which creates an additional native option: if a visible native-frame flash remains after the web bootstrap, read the SQLite preference in Rust during window setup, set the app-wide Tauri theme, then show the window. Start with the inline bootstrap because it solves webview content consistently in Tauri and `npm run dev`; add native pre-show work only if visual testing proves it necessary.

After a successful save, emit a small global `appearance://changed` event containing the validated preferences. Each webview applies it and refreshes or invalidates its planner snapshot. Tauri's [event documentation](https://v2.tauri.app/develop/calling-frontend/#event-system) says global events are delivered to all listeners and are intended for small multi-consumer messages, which fits this use. Do not stream style tokens or raw CSS over the event; emit only preference identifiers.

## Settings UI

Use source-owned shadcn controls already appropriate to Slate:

- A three-item `ToggleGroup` or radio group for System / Light / Dark.
- A grid/list of selectable palette preview cards. Each card should show representative background, surface, primary, muted, border, and destructive roles in both schemes—not merely one colored dot.
- A two-item control for Standard / Large text only if that axis ships.
- A two-item control for Comfortable / Compact density only after the layout-token work ships, with explicit copy if it affects only the full window.
- A “Use Slate defaults” reset action.

The selector should live in an Appearance settings group and participate in the existing draft/save workflow. Live preview is useful, but persisted changes must still be explicit. Keyboard focus, selected state, and accessible names must not rely on color alone.

Avoid an arbitrary color picker in the initial system. It multiplies contrast, hover, focus, destructive, chart, and dark-mode combinations that Slate would have to validate. It would also conflict with the product's restrained visual direction.

## Typography and shadcn/typeset

Do not expose a general font-family selector. Slate's interface is spatially constrained and its design guide deliberately uses one sans-serif family for orientation, controls, and task data. Font metrics affect truncation, row height, keyboard-shortcut alignment, and the compact minimum window.

There is one separate font-delivery issue worth fixing when implementing appearance: Slate names Inter in CSS but does not currently ship it as a dependency or local asset. If deterministic Inter rendering is required, `@fontsource-variable/inter` is a reasonable optional dependency; the [official Fontsource install page](https://fontsource.org/fonts/inter/install) provides the package and a weight-variable import. Intel One Mono can instead be vendored from the [official Intel repository](https://github.com/intel/intel-one-mono) if the technical-value face must also be deterministic. This work is about fulfilling the existing design contract, not offering font choice.

If Slate later gains rendered Markdown, add a project-owned `typeset.css` only to those reading surfaces. A “roomier reading mode” could then use Typeset's size/leading/flow presets independently of the application theme.

## Package decision

| Package or mechanism | Decision | Reason |
| --- | --- | --- |
| Tailwind CSS v4 + current semantic CSS variables | Use existing | Already supplies the right runtime token indirection. |
| Current shadcn/Base UI source components | Use existing | Enough to compose the settings controls; there is no runtime shadcn theme package to add. |
| `@tauri-apps/api` | Use existing | Provides native theme get/set/change events and the cross-webview event API. |
| React context/provider | Use existing approach, deepen it | Theme state is small and application-wide; another state library is unnecessary. |
| shadcn/typeset | Do not use for the selector | It is scoped HTML/Markdown typography CSS, not theme state or persistence. It adds no package even when later used. |
| `next-themes` | Do not add | Slate is a Vite/Tauri application with SQLite authority and native-window concerns; a second localStorage-oriented theme manager would duplicate the required provider logic. |
| `@tauri-apps/plugin-store` | Do not add | Duplicates SQLite and remains asynchronous. |
| Color manipulation library | Do not add | Ship reviewed, explicit token sets; runtime color generation makes validation harder. |
| `@fontsource-variable/inter` | Optional | Only to bundle the font already required by Slate's design guide. Not needed for theme selection itself. |

Net: **the theme selector requires no new runtime package**. The only justified dependency candidate is font delivery, and that decision is independent.

## Accessibility and validation

Every palette/scheme combination must be tested as a complete product state. At minimum:

- Normal text must meet 4.5:1 contrast and large text 3:1 under [WCAG 2.1 contrast minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html).
- Focus indicators, control boundaries, and other required UI graphics must meet 3:1 against adjacent colors under [WCAG non-text contrast](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html).
- Selected, destructive, warning, capacity, and completion states must retain text/shape/hierarchy signals; [WCAG use of color](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html) prohibits color as the only visual means of conveying information.
- Verify native inputs, scrollbars, menus, focus rings, popovers/sheets, toasts, disabled states, drag states, quick capture, the popover at 360 × 520, and the full window.
- Exercise cold launch for every explicit scheme and System mode, then change macOS appearance while all three Slate windows exist.
- Verify corrupt/unknown bootstrap-cache values safely fall back and that SQLite reconciliation is deterministic.
- Verify live preview reverts when Settings is abandoned and commits only after a successful save.

No new test dependency is required to begin. Pure tests should cover parsing, validation, resolution, and migration. A later browser screenshot matrix can be added if visual regression testing becomes a maintained project capability rather than a one-off theme task.

## Suggested delivery sequence

1. Add `system` while keeping the existing Slate palette; split requested and resolved appearance, add pre-paint bootstrap, native theme synchronization, and cross-window events.
2. Add two curated palettes as complete light/dark semantic-token sets and build the Settings previews.
3. Decide whether deterministic font bundling is required and add Inter assets/package if so.
4. Add Standard/Large text only after minimum-window and truncation validation.
5. Normalize component layout tokens, then consider full-window density. Do not make density part of the first theme-selector change merely to make the system appear more extensive.

This sequence delivers the highest-value behavior first and leaves a clean extension path without overbuilding the initial feature.

---
name: Slate
description: A calm, compact macOS planner for deciding what fits today.
colors:
  background: "oklch(0.9900 0 0)"
  foreground: "oklch(0 0 0)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0 0 0)"
  popover: "oklch(0.9900 0 0)"
  popover-foreground: "oklch(0 0 0)"
  primary: "oklch(0 0 0)"
  primary-foreground: "oklch(1 0 0)"
  secondary: "oklch(0.9400 0 0)"
  secondary-foreground: "oklch(0 0 0)"
  muted: "oklch(0.9700 0 0)"
  muted-foreground: "oklch(0.4400 0 0)"
  accent: "oklch(0.9400 0 0)"
  accent-foreground: "oklch(0 0 0)"
  destructive: "oklch(0.6300 0.1900 23.0300)"
  border: "oklch(0.9200 0 0)"
  input: "oklch(0.9400 0 0)"
  ring: "oklch(0 0 0)"
  chart-1: "oklch(0.8100 0.1700 75.3500)"
  chart-2: "oklch(0.5500 0.2200 264.5300)"
  chart-3: "oklch(0.7200 0 0)"
  chart-4: "oklch(0.9200 0 0)"
  chart-5: "oklch(0.5600 0 0)"
  capacity-caution: "color-mix(in oklch, var(--chart-1) 70%, var(--foreground))"
  dark-background: "oklch(0 0 0)"
  dark-foreground: "oklch(1 0 0)"
  dark-card: "oklch(0.1400 0 0)"
  dark-primary: "oklch(1 0 0)"
typography:
  title:
    fontFamily: "Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Geist, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  menu:
    fontFamily: "Geist, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.125rem
  label:
    fontFamily: "Geist, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 0.875rem
rounded:
  checkbox: "4px"
  control: "6px"
  field: "8px"
  panel: "12px"
  shell: "18px"
  pill: "999px"
spacing:
  compact: "8px"
  control: "10px"
  panel: "20px"
  page: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.menu}"
    rounded: "{rounded.field}"
    padding: "0 10px"
    height: "32px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.menu}"
    rounded: "{rounded.field}"
    padding: "0 10px"
    height: "32px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.menu}"
    rounded: "{rounded.field}"
    padding: "0 10px"
    height: "32px"
  navigation-pill:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    typography: "{typography.menu}"
    rounded: "{rounded.pill}"
    padding: "4px 6px"
    height: "40px"
  task-summary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.panel}"
    padding: "20px"
---

# Design System: Slate

## Overview

**Creative North Star: "Quiet desktop utility"**

Slate is a calm, compact planning surface for one decision: what fits today. The interface uses familiar product-UI vocabulary—short labels, clear hierarchy, standard controls, and quiet boundaries—so the planning workflow stays more visible than the interface itself.

The visual system is restrained rather than decorative. Near-neutral surfaces establish a clean desktop canvas, black-and-white contrast marks commitment and state, and Georgia type creates a brief reflective pause only where the product asks the user to orient. The system explicitly rejects project-management density, calendar/time-blocking metaphors, and AI surfaces that imply control without confirmation.

**Key Characteristics:**

- Compact-first geometry that remains usable in the 360 × 520 minimum window.
- Tonal surfaces and hairline boundaries instead of decorative card shadows.
- Serif type for orientation and reflection; sans-serif type for every active workflow.
- One restrained contrast signal used for commitment, selection, focus, and meaningful status.
- State changes communicated through text, shape, and hierarchy as well as color.
- A slim top command row, dense task rows, and a thin Settings utility strip keep the daily loop visible in the popover.

## Native identity

Slate’s application mark is a rounded warm-ivory tile over a charcoal underlayer, set on a deep-teal field, with a large negative-space **S**. The mark is deliberately simple so it remains recognizable in the Dock, DMG, and small previews.

- The full-bleed 1024px source is `src-tauri/assets/slate-icon-source.png`.
- `src-tauri/assets/slate-icon-transparent.png` preserves the mark while making only the outer corners transparent for non-bundle uses.
- Generated macOS bundle outputs live in `src-tauri/icons/slate/` and are the files referenced by `src-tauri/tauri.conf.json`.
- The menu-bar icon is a separate 18×18 monochrome template glyph in `src-tauri/src/window_controller.rs`. Do not reuse the full-color app icon in the menu bar; macOS tints the template glyph for light and dark menu bars.

## Colors

The palette is a neutral monochrome desktop canvas with black-and-white primary contrast and a red destructive state. The same semantic roles drive light and dark themes; components should use CSS variables rather than literal values.

### Primary

- **Primary contrast** (`oklch(0 0 0)` in light mode, `oklch(1 0 0)` in dark mode): Use for committed capacity progress, selected or checked state, confirmed configuration, and the primary in-flow action.
- **Primary focus ring** (`oklch(0 0 0)` in light mode, `oklch(0.7200 0 0)` in dark mode): Use for keyboard focus and active control emphasis.

### Neutral

- **Canvas** (`oklch(0.9900 0 0)`): The main light-theme background.
- **Surface** (`oklch(1 0 0)`): Cards and contained summaries.
- **Ink** (`oklch(0 0 0)`): Primary readable text and active navigation.
- **Muted surface** (`oklch(0.9700 0 0)`): Navigation tray, hover state, capacity rail, and secondary regions.
- **Muted text** (`oklch(0.4400 0 0)`): Supporting labels and metadata. It remains body-text contrast, not decoration.
- **Boundary** (`oklch(0.9200 0 0)`): Hairline structure between tasks, fields, and sections.
- **Destructive red** (`oklch(0.6300 0.1900 23.0300)`): Invalid, delete, and over-capacity states only.
- **Capacity caution** (a readable blend of `chart-1` and the foreground): Use for the remaining-capacity value as the day approaches its limit and for recoverable warnings.
- **Dark canvas** (`oklch(0 0 0)`): The dark-theme background.
- **Dark surface** (`oklch(0.1400 0 0)`): Dark cards; popovers use `oklch(0.1800 0 0)`.

### Named Rules

**The One Contrast Rule.** Use the primary black/white contrast only when it communicates action, progress, selection, focus, or meaningful state. Do not use it as page decoration.

**The Token Rule.** Use the semantic CSS variables from `src/styles.css`. Do not introduce near-matching neutral or accent values in component classes.

## Typography

**Display / Orientation Font:** Georgia with the system serif fallback.

**Body / UI Font:** Geist with the system sans-serif fallback.

**Character:** The serif face creates a measured pause around orientation and the daily decision. The sans-serif face carries labels, controls, task data, and settings so active work stays familiar and compact.

### Hierarchy

- **Title** (600, `1.5rem`, `1.25`): Concise page or recovery headings where the user needs orientation.
- **Body** (400, `1rem`, `1.5`): Explanatory copy and comfortable supporting text.
- **Menu** (400–600, `0.8125rem`, `1.125rem`): Task titles, controls, navigation, and compact data.
- **Label** (600, `0.6875rem`, `0.875rem`): Section labels, capacity metadata, and small status text. Use uppercase only when it improves recognition, never as repeated scaffolding.
- **Numeric data** (tabular numerals): Durations, capacity, overages, and counts should align clearly.

### Named Rules

**The Reflection Rule.** Serif type belongs to high-level orientation and a short reflective moment. Controls, task metadata, and operational labels stay in the sans-serif family.

## Elevation

Slate is flat by default. Static surfaces use tonal separation and one-pixel boundaries. Shadows are reserved for transient layers such as popovers, select menus, and dialogs; they clarify a floating interaction rather than decorate an ordinary card. The menu-bar shell uses a rounded ring instead of a broad shadow.

### Shadow Vocabulary

- **Transient menu layer** (`shadow-md` plus a subtle foreground ring): Select and popover content that must separate from the workspace.
- **Dialog layer** (foreground ring with a restrained backdrop): Modal confirmation or calendar interaction when an inline treatment cannot contain the task.
- **Static content** (none): Today rows, the flat Backlog list, settings groups, and capacity summaries remain flat.

### Named Rules

**The Quiet Surface Rule.** Do not combine a visible border with a broad soft shadow on ordinary cards or controls. Use tonal layering and a border for static content; reserve elevation for transient interaction layers.

## Components

### Buttons

**Character:** Quiet, precise controls that feel native to a compact desktop utility.

- **Shape:** `10px` base radius from `rounded-lg`; icon-only composer controls may use the `8px` control radius.
- **Primary:** `primary` fill with `primary-foreground` text; default height `32px`, horizontal padding `10px`.
- **Outline:** Background fill with `border` and `foreground` text; hover moves to `muted`.
- **Ghost:** Transparent at rest; hover and expanded states use `muted`.
- **Destructive:** A restrained destructive tint for delete or invalid actions, never a competing accent.
- **Hover / Focus:** 150–200ms color transition; visible `ring` focus treatment; reduced motion removes transition choreography.

### Cards / Containers

- **Corner Style:** `8px` for ordinary groups and controls; `12px` for transient panels; `18px` for the popover shell.
- **Background:** Use `card` against `background` for contained summaries; use `muted` for navigation and secondary regions.
- **Border:** One quiet `border` establishes structure. Do not add decorative shadows to static panels.
- **Internal Padding:** Use `8px` compact spacing, `10px` control spacing, and `20px` panel spacing.
- **Settings groups:** A muted-tinted surface with a quiet border, compact heading, short description, and one consistent control vocabulary.
- **Settings footer:** Keep local-storage context, app version, and the global save action together in one quiet persistent boundary.

### Inputs / Fields

- **Style:** Transparent fields with `input` border, `8px` radius, `10px` horizontal padding, and `32px` height for ordinary compact controls. The Daily command row uses a slimmer `28px` treatment.
- **Focus:** Shift the border to `ring` and add the standard visible focus ring.
- **Error:** Use `destructive` border and ring treatment; keep the message adjacent and actionable.
- **Disabled:** Reduce opacity and interaction without making the field appear like a separate inactive product state.

### Daily Workspace

- **Command row:** A slim search-and-capture entry sits above the scrollable task surface. It is the primary way to add work and the visual entry point for search and reviewable AI actions.
- **Today:** The dominant section shows the remaining-minute value, a thin progress rail, active tasks, and completed Today tasks at the bottom.
- **Backlog:** A single flat list appears beneath Today by default. Needs estimate, Overdue, Upcoming, and Unscheduled remain row metadata rather than category headings. The section can collapse locally when the user wants to protect the Today view.
- **Settings:** A thin, subdued utility strip remains at the bottom of the workspace; it does not compete with capture or task content.
- **Density:** Preserve the normal daily loop at `360 × 520`. Prefer compact hierarchy and metadata over extra panels or route-level navigation.

### Task Rows

- **Structure:** A quiet divided list with a circular completion affordance, a flexible task title, a smaller muted metadata line beneath it when needed, and tabular duration aligned to the right.
- **Density:** Active rows target roughly `34–36px` of vertical height. Metadata is smaller and lighter than the title so it supports scanning without competing with the work.
- **State:** Selected rows use `muted`; completed rows remain at the bottom of their owning list with `muted-foreground` and a line-through; over-capacity rows use a restrained `destructive` boundary.
- **Interaction:** The entire row remains keyboard-operable with a visible focus ring. Completion and edit affordances must not rely on color alone.

### Capacity Summary

- **Structure:** The Today header shows the remaining-minute value and thin `4px` progress rail. The rail stays with the capacity value while task content scrolls.
- **Progress:** `primary` represents committed minutes; `destructive` represents over-capacity. The remaining-minute text shifts from `primary`, to `foreground`, to `capacity-caution` as capacity is used, then to `destructive` when over capacity.
- **Behavior:** The rail is a signal, not a chart or performance score.

### Daily Command Row and Utility Strip

- **Structure:** A slim top command row holds the search-and-capture field and reviewable AI action. Enter submits a captured title; there is no separate save button. The row remains visible while the task list scrolls.
- **Hierarchy:** The command row is visually quiet; the task list and Today capacity carry the main emphasis. Enter-to-save stays implicit and keyboard-first.
- **Utility strip:** A thin bottom strip exposes Settings and, in the popover, Open full app with small muted controls. It stays available without consuming a large footer band.

### Task Detail Panel

- **Placement:** A utility-strip-adjacent transient panel using `12px` top corners and a bounded compact height.
- **Surface:** A tinted task-detail surface with quiet boundary and no decorative shadow.
- **Interaction:** Editing stays close to the task list, dismisses with Escape or outside click, and respects reduced motion.

## Do's and Don'ts

### Do:

- **Do** use `background`, `foreground`, `card`, `border`, `muted`, `primary`, and `ring` as semantic roles from `src/styles.css`.
- **Do** keep the top command row compact and the Settings utility strip subordinate to the task surface.
- **Do** keep Backlog flat and communicate task state through row metadata rather than category subsections.
- **Do** keep completed Today tasks at the bottom of Today without creating a separate Done section.
- **Do** reserve the primary black/white contrast for an explicit task decision, progress, selection, focus, or meaningful state.
- **Do** keep the core workflow understandable at 360 × 520 before optimizing the full window.
- **Do** use standard keyboard-operable controls with visible focus and 150–250ms state transitions.
- **Do** provide empty, completed, over-capacity, persistence-error, loading, and disabled states with concise explanatory copy.
- **Do** keep AI results visually secondary and reviewable until the user explicitly accepts them.
- **Do** use semantic labels and text alongside color for completion, over-capacity, configured, and error states.

### Don't:

- **Don't** make Slate resemble a busy project-management suite through dense dashboards, decorative metrics, or competing accent colors.
- **Don't** introduce calendar grids, time-blocking visual metaphors, or time-of-day scheduling controls into the core daily planning surface.
- **Don't** make AI actions look autonomous; every suggestion must remain distinguishable and require user confirmation.
- **Don't** use gradient text, colored side stripes, decorative glass cards, or broad soft shadows on bordered panels.
- **Don't** use the primary color as page decoration or use a serif face in controls, task data, and operational labels.
- **Don't** use nested cards merely to separate paragraphs or create hierarchy.
- **Don't** rely on tiny low-contrast gray text for essential capacity, error, or persistence information.

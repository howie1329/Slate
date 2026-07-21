---
name: Slate
description: A calm, compact macOS planner for deciding what fits today.
colors:
  background: "oklch(0.985 0.003 85)"
  foreground: "oklch(0.28 0.016 68)"
  card: "oklch(0.998 0.002 85)"
  card-foreground: "oklch(0.28 0.016 68)"
  popover: "oklch(0.998 0.002 85)"
  popover-foreground: "oklch(0.28 0.016 68)"
  primary: "oklch(0.43 0.09 160)"
  primary-foreground: "oklch(0.985 0.003 85)"
  secondary: "oklch(0.94 0.008 85)"
  secondary-foreground: "oklch(0.28 0.016 68)"
  muted: "oklch(0.95 0.006 85)"
  muted-foreground: "oklch(0.55 0.014 68)"
  accent: "oklch(0.94 0.008 85)"
  accent-foreground: "oklch(0.28 0.016 68)"
  destructive: "oklch(0.577 0.245 27.325)"
  border: "oklch(0.87 0.008 85)"
  input: "oklch(0.87 0.008 85)"
  ring: "oklch(0.62 0.12 160)"
  capacity-caution: "oklch(0.56 0.11 80)"
  dark-background: "oklch(0.22 0.012 68)"
  dark-foreground: "oklch(0.96 0.006 85)"
  dark-card: "oklch(0.27 0.014 68)"
  dark-primary: "oklch(0.72 0.12 160)"
typography:
  title:
    fontFamily: "Iowan Old Style, Palatino Linotype, Palatino, serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Avenir Next, Helvetica Neue, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  menu:
    fontFamily: "Avenir Next, Helvetica Neue, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.125rem
  label:
    fontFamily: "Avenir Next, Helvetica Neue, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 0.875rem
rounded:
  checkbox: "4px"
  control: "8px"
  field: "10px"
  panel: "14px"
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

The visual system is restrained rather than decorative. Near-neutral surfaces establish a soft desktop canvas, a single muted teal accent marks commitment and state, and serif type creates a brief reflective pause only where the product asks the user to orient. The system explicitly rejects project-management density, calendar/time-blocking metaphors, and AI surfaces that imply control without confirmation.

**Key Characteristics:**

- Compact-first geometry that remains usable in the 360 × 520 minimum window.
- Tonal surfaces and hairline boundaries instead of decorative card shadows.
- Serif type for orientation and reflection; sans-serif type for every active workflow.
- One restrained accent used for commitment, selection, focus, and meaningful status.
- State changes communicated through text, shape, and hierarchy as well as color.

## Colors

The palette is a warm-neutral desktop canvas with a muted teal commitment signal and a red destructive state. The same semantic roles drive light and dark themes; components should use CSS variables rather than literal values.

### Primary

- **Muted teal commitment signal** (`oklch(0.43 0.09 160)`): Use for committed capacity progress, selected or checked state, confirmed configuration, and the primary in-flow action. Keep it scarce so it retains meaning.
- **Teal focus ring** (`oklch(0.62 0.12 160)`): Use for keyboard focus and active control emphasis. It must remain distinct from the primary fill.

### Neutral

- **Canvas** (`oklch(0.985 0.003 85)`): The main light-theme background.
- **Surface** (`oklch(0.998 0.002 85)`): Cards, popovers, and contained summaries.
- **Ink** (`oklch(0.28 0.016 68)`): Primary readable text and active navigation.
- **Muted surface** (`oklch(0.95 0.006 85)`): Navigation tray, hover state, capacity rail, and secondary regions.
- **Muted text** (`oklch(0.55 0.014 68)`): Supporting labels and metadata. It remains body-text contrast, not decoration.
- **Boundary** (`oklch(0.87 0.008 85)`): Hairline structure between tasks, fields, and sections.
- **Destructive red** (`oklch(0.577 0.245 27.325)`): Invalid, delete, and over-capacity states only.
- **Capacity caution** (`oklch(0.56 0.11 80)`): Use for the remaining-capacity value as the day approaches its limit. It is distinct from the destructive over-capacity state.
- **Dark canvas** (`oklch(0.22 0.012 68)`): The dark-theme background.
- **Dark surface** (`oklch(0.27 0.014 68)`): Dark cards and popovers.

### Named Rules

**The One Signal Rule.** Use the primary teal only when it communicates action, progress, selection, focus, or meaningful state. Do not use it as page decoration.

**The Token Rule.** Use the semantic CSS variables from `src/styles.css`. Do not introduce near-matching neutral or accent values in component classes.

## Typography

**Display / Orientation Font:** Iowan Old Style with Palatino Linotype, Palatino fallbacks.

**Body / UI Font:** Avenir Next with Helvetica Neue fallbacks.

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
- **Static content** (none): Today rows, Backlog groups, settings groups, and capacity summaries remain flat.

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

- **Corner Style:** `10px` for ordinary groups and controls; `14px` for transient panels; `18px` for the popover shell.
- **Background:** Use `card` against `background` for contained summaries; use `muted` for navigation and secondary regions.
- **Border:** One quiet `border` establishes structure. Do not add decorative shadows to static panels.
- **Internal Padding:** Use `8px` compact spacing, `10px` control spacing, and `20px` panel spacing.
- **Settings groups:** A muted-tinted surface with a quiet border, compact heading, short description, and one consistent control vocabulary.

### Inputs / Fields

- **Style:** Transparent fields with `input` border, `10px` radius, `10px` horizontal padding, and `32px` height for compact controls.
- **Focus:** Shift the border to `ring` and add the standard visible focus ring.
- **Error:** Use `destructive` border and ring treatment; keep the message adjacent and actionable.
- **Disabled:** Reduce opacity and interaction without making the field appear like a separate inactive product state.

### Navigation

- **Style:** The top-level Today/Backlog switcher is a compact `pill` container with `muted` fill and `4px` internal padding.
- **Default:** Sans-serif menu text in `muted-foreground`.
- **Active:** `foreground` fill with `background` text and semibold weight, making the current planning context immediately legible.
- **Density:** Keep navigation short. New categories belong in the task workflow only when they make the daily decision easier.

### Task Rows

- **Structure:** A quiet divided list with a circular completion affordance, a flexible truncated title, and tabular duration metadata.
- **State:** Selected rows use `muted`; completed rows use `muted-foreground` and a line-through; over-capacity rows use a restrained `destructive` boundary.
- **Interaction:** The entire row remains keyboard-operable with a visible focus ring. Completion and edit affordances must not rely on color alone.

### Capacity Summary

- **Structure:** The persistent header shows the Today remaining-minute value and thin `4px` progress rail, or the Backlog active-task count. The rail stays with the capacity value while task content scrolls.
- **Progress:** `primary` represents committed minutes; `destructive` represents over-capacity. The remaining-minute text shifts from `primary`, to `foreground`, to `capacity-caution` as capacity is used, then to `destructive` when over capacity.
- **Behavior:** The rail is a signal, not a chart or performance score.

### Task Detail Panel

- **Placement:** A footer-adjacent transient panel using `14px` top corners and a bounded compact height.
- **Surface:** A tinted task-detail surface with quiet boundary and no decorative shadow.
- **Interaction:** Editing stays close to the task list, dismisses with Escape or outside click, and respects reduced motion.

## Do's and Don'ts

### Do:

- **Do** use `background`, `foreground`, `card`, `border`, `muted`, `primary`, and `ring` as semantic roles from `src/styles.css`.
- **Do** reserve the teal accent for an explicit task decision, progress, selection, focus, or meaningful state.
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

---
name: Slate
description: A calm, compact macOS planner for deciding what fits today.
colors:
  background: "oklch(0.985 0.003 85)"
  foreground: "oklch(0.28 0.016 68)"
  card: "oklch(0.998 0.002 85)"
  primary: "oklch(0.43 0.09 160)"
  primary-foreground: "oklch(0.985 0.003 85)"
  muted: "oklch(0.95 0.006 85)"
  muted-foreground: "oklch(0.55 0.014 68)"
  border: "oklch(0.87 0.008 85)"
  ring: "oklch(0.62 0.12 160)"
  destructive: "oklch(0.577 0.245 27.325)"
  dark-background: "oklch(0.22 0.012 68)"
  dark-foreground: "oklch(0.96 0.006 85)"
  dark-card: "oklch(0.27 0.014 68)"
  dark-primary: "oklch(0.72 0.12 160)"
typography:
  display:
    fontFamily: "Iowan Old Style, Palatino Linotype, Palatino, serif"
    fontSize: "3rem"
    fontWeight: 500
    lineHeight: 1
  title:
    fontFamily: "Iowan Old Style, Palatino Linotype, Palatino, serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1
  body:
    fontFamily: "Avenir Next, Helvetica Neue, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.5
  label:
    fontFamily: "Avenir Next, Helvetica Neue, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  control: "8px"
  panel: "10px"
  card: "16px"
spacing:
  compact: "8px"
  control: "10px"
  panel: "20px"
  page: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "32px"
  button-ghost:
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "32px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "32px"
  task-summary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.card}"
    padding: "20px"
---

# Design System: Slate

## Overview

**Creative North Star: "Quiet desktop utility"**

Slate is a calm, compact planning surface for a single decision: what fits today. It uses a familiar product-UI vocabulary—short labels, clear hierarchy, standard controls, and calm boundaries—so the planning workflow stays more visible than the interface itself.

The system is intentionally restrained. Its light and dark themes use the same semantic roles; the primary color is reserved for committed actions, progress, selected state, and meaningful status. It rejects the dense visual language of project-management suites, calendar/time-blocking metaphors, and AI interfaces that imply control without user confirmation.

**Key Characteristics:**

- Compact-first geometry that remains usable in the 360 × 520 minimum window.
- Tonal surfaces and hairline boundaries instead of decorative shadows.
- Serif headings for a single reflective moment; sans-serif text for every active workflow.
- A single primary accent used as a signal, never as ornament.

## Colors

The CSS custom properties in `src/styles.css` are canonical. Use semantic token names in components, not literal color values or ad-hoc replacements.

### Primary

- **Primary / primary-foreground:** The only active accent pair. Use for the main in-flow action, committed capacity progress, current selection, and checked state.
- **Ring:** The focus-visible signal. Keep it distinct and always visible against the surrounding surface.
- **Destructive:** Reserved for invalid or destructive task actions; it is never a secondary accent.

### Neutral

- **Background / foreground:** The base canvas and strongest readable text pair.
- **Card:** The small lift for contained summaries such as the daily commitment meter.
- **Muted / muted-foreground:** Supporting regions and secondary copy. Muted foreground is still body-text contrast, not a decorative gray.
- **Border:** Quiet structure between adjacent tasks, navigation states, and contained content.
- **Dark theme roles:** Preserve the matching `dark-*` values defined in the frontmatter through the existing `.dark` token overrides.

### Named Rules

**The One Signal Rule.** `primary` appears only when it communicates action, progress, selection, or state. A screen does not receive primary color merely to look more lively.

**The Token Rule.** Use the semantic CSS variables from `src/styles.css`. New components may not introduce near-matching neutral or accent values.

## Typography

**Display Font:** Iowan Old Style with Palatino fallbacks.

**Body Font:** Avenir Next with Helvetica Neue fallback.

**Character:** Serif headings create a brief, reflective pause around the day’s decision. Avenir Next carries labels, controls, data, and body copy with compact, familiar utility.

### Hierarchy

- **Display:** Used for the page-level planning prompt only. Keep it to a short, balanced thought.
- **Title:** Used for the Slate wordmark and concise section titles; it is not a substitute for a control label.
- **Body:** Used for instructions and supporting copy. Keep explanatory text concise and under roughly 65 characters per line where practical.
- **Label:** Used for view names, compact metadata, and utility labels. Uppercase is allowed only for brief, meaningful labels, not as a repeated section scaffold.
- **Numeric data:** Use tabular numerals for durations, capacity, and over-capacity values.

### Named Rules

**The Reflection Rule.** Serif type belongs to the daily decision and high-level orientation. Controls, task metadata, and operational content stay in the sans-serif family.

## Elevation

Slate is flat by default. Depth comes from the separation of background, card, and popover roles plus one-pixel borders; shadows are reserved for transient layers such as popovers, dialogs, and select menus. Overlays may use a light backdrop treatment to clarify a temporary mode, never to create decorative glass.

### Named Rules

**The Quiet Surface Rule.** Do not combine a visible border with a broad soft shadow on ordinary cards or controls. Choose tonal layering and a border for static content; reserve elevation for floating interaction layers.

## Components

### Buttons

**Character:** Quiet, precise controls.

- **Shape:** Gently rounded controls using the `control` radius.
- **Primary:** Uses the primary token pair for a single in-flow action. The default height is compact and the label uses body-scale medium weight.
- **Ghost:** Used for icon-only and low-emphasis actions, including theme switching. It gains a muted surface only on interaction.
- **Focus / disabled:** Focus always uses the ring token and a visible ring. Disabled buttons lose interaction and reduce opacity; they do not imitate an active state.

### Cards / Containers

- **Corner Style:** Daily summaries use the `card` radius; ordinary panels should not exceed it.
- **Background:** Use `card` against `background` for contained information. Do not nest cards merely to separate paragraphs.
- **Border:** One quiet border establishes structure. Static cards do not receive decorative shadows.
- **Internal Padding:** Use the `panel` spacing token for daily summaries and compact, consistent spacing for controls.

### Inputs / Fields

- **Style:** Inputs are transparent on the current surface with an input border and a compact fixed height.
- **Focus:** The border moves to `ring` and gains the standard ring treatment. Keyboard focus is not suppressed.
- **Error / disabled:** Invalid fields use the destructive token; disabled fields use the input treatment and reduced opacity.

### Navigation

- **Style:** Workspace views use a bottom rule as the selection affordance. The active item has foreground text and a foreground bottom border; inactive items remain muted until hover or focus.
- **Density:** Keep the top-level navigation short. New categories belong in the task workflow only when they make the daily decision easier.

### Daily Commitment Summary

- **Style:** A contained task-state summary with a short label, tabular total, and thin progress rail.
- **Progress:** The primary fill represents committed capacity only; it is not a decorative chart treatment.

## Do's and Don'ts

### Do:

- **Do** use `background`, `foreground`, `card`, `border`, and `muted` as semantic roles rather than introducing local neutral values.
- **Do** reserve `primary` for an explicit task decision, status, focus, or progress signal.
- **Do** keep the primary workflow understandable at 360 × 520, then let the full app provide more room for the same actions.
- **Do** use standard, keyboard-operable controls with visible focus and short 100–200 ms state transitions.
- **Do** keep AI results reviewable and visually secondary until the user explicitly accepts them.

### Don't:

- **Don't** make Slate resemble a busy project-management suite through dense dashboards, decorative metrics, or competing accent colors.
- **Don't** introduce calendar grids, time-blocking visual metaphors, or time-of-day scheduling controls into the core daily planning surface.
- **Don't** make AI actions look autonomous: every suggestion must remain distinguishable and require user confirmation.
- **Don't** use gradient text, colored side stripes, decorative glass cards, or broad soft shadows on bordered panels.
- **Don't** use the primary color as page decoration, or use a serif face in controls, task data, and operational labels.

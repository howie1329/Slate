# Animated header numbers with Number Flow

**Status:** Proposed.

## Purpose

Use [Number Flow](https://number-flow.barvian.me/) to give Slate’s changing header metrics a short, readable digit transition:

- Today’s remaining-capacity value.
- Backlog’s active task count.

The animation should make a confirmed local state change easier to notice without turning Slate’s compact menu-bar utility into a dashboard or a continuously moving display.

## Product decision

Number Flow is appropriate for the two persistent header metrics because both values already have a clear semantic meaning and are recalculated from the planner snapshot. The animation is feedback for a changed value; it is not a separate source of state.

The existing animation brief says not to count up the Today minutes label. This proposal keeps that intent by allowing a single short digit transition while explicitly avoiding Number Flow’s `continuous` plugin. A change from `60m` to `35m` should transition the displayed digits, not visibly enumerate every intermediate minute.

The capacity rail remains a CSS width/color transition. It is a planning signal, not a chart animation.

## Current implementation points

The shared Slate shell owns both header metrics in `src/routes/__root.tsx`:

- `HeaderSummary` calculates Today’s remaining or over-capacity value with `calculateCapacityState`.
- `HeaderSummary` calculates Backlog’s active non-Today task count with `scopeForTask`.
- `TodayCapacityProgress` renders the existing capacity rail.

Number Flow should replace only the visible numeric text inside `HeaderSummary`. Planner calculations, mutation handling, persistence, routes, and native commands remain unchanged.

## Proposed behavior

### Today

Render the numeric value as:

- `remainingMinutes` with an `m` suffix during normal capacity state.
- `overageMinutes` with a `+` prefix and `m` suffix when over capacity.

Retain the current semantic color states:

- Primary when capacity is comfortably available.
- Foreground as capacity becomes limited.
- Capacity caution near the limit.
- Destructive when over capacity.

The accessible label must continue to describe the meaning of the value, such as “35 minutes remaining” or “20 minutes over capacity,” rather than exposing animation details.

### Backlog

Render the existing active task count through Number Flow. The count includes incomplete tasks outside Today, including tasks that still need an estimate, because that is the current Backlog definition.

Retain the current label format: “N tasks left.” A zero count must remain a valid and stable state.

## Number Flow configuration

Install the React package with the project’s existing npm workflow:

```bash
npm install @number-flow/react
```

Use the component’s standard `value` updates and configure it conservatively:

- Use the default directional trend so decreases and increases remain understandable.
- Use a short 160–200ms transform/digit timing and a slightly shorter opacity timing if character width changes.
- Keep `respectMotionPreference` enabled.
- Keep `font-variant-numeric: tabular-nums` so the compact header does not shift as digits change.
- Do not use the `continuous` plugin.
- Do not enable `willChange` unless profiling demonstrates frequent-update repositioning; these metrics only change after local planner mutations.
- Do not use `NumberFlowGroup`; only one Number Flow value is visible in the header at a time.

Number Flow exposes formatting, prefix/suffix, timing, reduced-motion, and accessibility-related APIs in its React package. Its custom-element implementation should be checked in the Tauri WebView during validation rather than assumed from a regular browser run.

## Accessibility and motion preferences

- Preserve the existing `role="status"` and meaningful `aria-label` on the header summary.
- Do not make animation the only indication of a changed value; text and color remain meaningful without motion.
- With macOS Reduced Motion enabled, the value should update immediately or with no spatial digit movement.
- Persistence, focus, keyboard input, navigation, and error handling must not wait for animation completion.
- Confirm that Number Flow does not create duplicate screen-reader announcements. If its rendered content is announced in addition to the status label, make the animated visual content presentational and keep the wrapper as the accessible status surface.

## Visual constraints

Follow Slate’s existing design system:

- Keep the `text-menu`, semibold, tabular-number treatment.
- Use existing semantic color tokens; do not add new number-specific colors.
- Preserve the fixed compact header grid and the 360 × 520 minimum popover usability.
- Do not add a pulse, bounce, scale effect, gradient, border, shadow, or animated page entry.
- Keep the rail’s existing transition and over-capacity treatment.

## Non-goals

- No changes to planner calculations or task-count semantics.
- No persistence, SQLite, Keychain, Tauri, or route changes.
- No animation for every duration or metadata value in task rows as part of the first pass.
- No timer or live countdown behavior; Today’s number changes only when planner state changes.
- No animated initial page load.
- No dependency on network access or an external service at runtime.

## Success criteria

The feature is successful when a user can immediately notice a changed Today capacity or Backlog count, while the interface still feels calm and compact. Reduced Motion must remove non-essential movement, and the displayed value must always match the latest confirmed planner snapshot.


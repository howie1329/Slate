# Add Number Flow to animated header metrics

**Status:** Proposed.

## Objective

Add [Number Flow](https://number-flow.barvian.me/) to Slate’s Today and Backlog header metrics so confirmed numeric changes receive a short digit transition. Preserve the existing planner logic, semantic labels, capacity rail behavior, compact layout, and reduced-motion policy.

This plan implements the behavior described in [Animated header numbers with Number Flow](../number-flow-animated-numbers.md).

## Current evidence

The shared shell in `src/routes/__root.tsx` currently renders:

- Today’s remaining minutes or overage as plain text in `HeaderSummary`.
- Backlog’s active non-Today task count as plain text in `HeaderSummary`.
- Today’s committed-capacity rail in `TodayCapacityProgress` with an existing CSS width/color transition.

The values are derived from the live `PlannerSnapshot`, `calculateCapacityState`, and `scopeForTask`. No local animation state or native changes are required.

The project already uses React, TypeScript, Vite, and `motion`, and the shell configures Motion with `reducedMotion="user"` in `src/main.tsx`. Number Flow must retain its own default motion-preference behavior as well.

## Scope

Included:

- Add `@number-flow/react` to the application dependencies and lockfile.
- Replace the two visible header metric text nodes in `HeaderSummary` with Number Flow.
- Configure calm timing, tabular numerals, directional updates, and reduced-motion support.
- Preserve existing status labels, semantic colors, capacity calculations, and fixed header geometry.
- Update `docs/animation-brief.md` so the permitted digit transition and its limits are explicit.
- Validate the result in the web build and desktop popover/full-window modes.

Not included:

- Changes to `src/routes/today.tsx` or `src/routes/backlog.tsx`.
- Changes to task-count semantics, capacity calculations, planner mutations, SQLite, Keychain, Tauri commands, or permissions.
- Number Flow on task-row durations, settings values, or other metadata.
- Continuous countdowns, animated initial renders, or decorative motion.
- Manual edits to `src/routeTree.gen.ts`.

## Implementation

### 1. Add the dependency

Run:

```bash
npm install @number-flow/react
```

Review the resulting `package.json` and `package-lock.json` diff. Do not add a second animation library or a general-purpose numeric abstraction.

### 2. Replace the Today summary value

In `HeaderSummary` in `src/routes/__root.tsx`:

1. Keep the existing `capacity` calculation and tone selection.
2. Derive a numeric `value` from `remainingMinutes` or `overageMinutes`.
3. Derive a `prefix` of `+` only for over-capacity state.
4. Render the `m` suffix through Number Flow.
5. Keep the wrapper’s existing `aria-label`, `role="status"`, color classes, and compact typography.
6. Configure a 160–200ms transform/digit transition and a shorter opacity transition if needed.
7. Do not use the `continuous` plugin, which would make a large change look like a count-up sequence.

The numeric component should receive the confirmed planner value directly. Do not introduce an interpolated React state, timer, or mutation callback solely for animation.

### 3. Replace the Backlog summary value

In the Backlog branch of `HeaderSummary`:

1. Keep the current `taskCount` filter unchanged.
2. Render `taskCount` as the Number Flow `value`.
3. Keep `aria-label={`${taskCount} tasks left`}`, `role="status"`, typography, and layout classes.
4. Confirm that transitions work for zero, single-digit, and multi-digit values.

### 4. Preserve reduced motion and accessibility

Use Number Flow’s default `respectMotionPreference` behavior. Confirm that the app’s existing Motion configuration and the component’s motion preference do not conflict.

Inspect the rendered accessibility tree. If Number Flow’s custom element causes duplicate announcements, keep the wrapper as the sole status surface and mark the visual numeric child presentational using the component’s supported DOM props.

Do not add animation callbacks that trigger persistence, toasts, focus changes, or any other application behavior.

### 5. Keep styling within Slate’s tokens

Use the existing `text-menu`, `font-semibold`, `tabular-nums`, and semantic color classes. Avoid custom Number Flow part styles unless the default custom-element rendering breaks the existing line-height or header alignment.

If CSS is needed, add the smallest rule to `src/styles.css` and keep it limited to Number Flow’s line-height or numeric rendering. Do not alter the capacity rail’s current CSS transition.

### 6. Update animation guidance

Adjust the Capacity Summary section of `docs/animation-brief.md` to state:

- A short Number Flow digit transition is allowed for the Today remaining/overage label and Backlog count.
- This is not a continuous count-up and must not use Number Flow’s `continuous` plugin.
- The rail remains a CSS transition and is not converted to Number Flow.
- Reduced Motion removes non-essential digit movement.

Keep the existing non-goals around decorative motion, delayed actions, and animated initial page load.

## Validation

Run:

1. `npm run build` to run the Vite build and TypeScript validation.
2. `git diff --check` to catch whitespace errors.
3. `rg -n "@number-flow/react|NumberFlow|continuous|HeaderSummary" package.json package-lock.json src docs` to confirm the dependency and intended usage are scoped correctly.

Manually validate in `npm run dev:desktop`:

- Add an estimated task to Today and confirm remaining minutes transition after the planner snapshot updates.
- Complete and restore a Today task.
- Edit an estimate and cross into/out of over-capacity.
- Add, complete, restore, schedule, and unschedule Backlog tasks.
- Check transitions from `0` to `1`, `9` to `10`, and multi-digit changes.
- Confirm the header grid does not shift in the 360 × 520 popover or full app.
- Enable macOS Reduced Motion and confirm values update without digit movement.
- Confirm screen-reader output remains “N tasks left,” “N minutes remaining,” or “N minutes over capacity,” without duplicate announcements.

## Acceptance criteria

- `@number-flow/react` is present in the dependency manifest and lockfile.
- Today’s header metric animates only when the confirmed planner value changes.
- Backlog’s header count animates only when the confirmed active task count changes.
- Today’s capacity rail retains its existing CSS width/color transition.
- Existing semantic colors and accessible labels remain intact.
- No continuous count-up, pulse, bounce, initial-load animation, or live countdown is introduced.
- Reduced Motion produces an immediate or non-spatial update.
- Persistence, keyboard actions, focus, navigation, and errors are not delayed by animation.
- The compact popover remains usable at its minimum size.
- `npm run build` and `git diff --check` pass.
- No generated route output or native code is edited.

## Deferred work

- Reassess animating task-row duration metadata only after observing real use of the header metrics.
- Reuse Number Flow for other numeric summaries only when the number has clear user meaning and the motion remains consistent with Slate’s quiet utility character.
- Do not add a global numeric animation wrapper without a concrete reuse boundary.


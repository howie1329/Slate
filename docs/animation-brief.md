# Slate animation brief

## Purpose

Animation in Slate makes task changes, review states, and navigation easier to follow. It is never decorative or attention-seeking. Slate is a quiet desktop utility: motion should confirm an action, preserve context, or direct focus to a meaningful change.

Motion for React (`motion/react`) is the animation library for stateful interface transitions. Existing CSS transitions and `tw-animate-css` remain the default for simple hover, focus, color, and popover states.

## Principles

- **Feedback first.** Motion confirms a completed action or in-progress local write.
- **Keep context.** When a task changes group or position, animate its relationship to the surrounding tasks rather than replacing the list abruptly.
- **Be compact.** The menu-bar popover must remain usable down to 360 x 520. No large movement, decorative page entrances, or unbounded animated panels.
- **Respect user preference.** The app honours macOS Reduced Motion. Reduced-motion mode replaces spatial movement and layout animation with short opacity changes, or removes non-essential animation entirely.
- **Do not delay work.** Persistence, keyboard input, focus changes, and error feedback happen immediately. Animation follows confirmed state; it never blocks the next action.
- **Keep keyboard actions instant.** Pointer-initiated transitions may animate; keyboard-initiated selection, dismissal, and task actions appear immediately.

## Motion system

### Global policy

Configure Motion once at the app shell with `MotionConfig reducedMotion="user"`. Prefer opacity and `transform`; do not animate `top`, `left`, `width`, or `height` directly except where a vetted layout transition requires it.

Use these default timings:

| Situation | Duration | Character |
| --- | --- | --- |
| Hover, press, saved/pending icon | 100-150 ms | CSS transition or tiny opacity/scale change |
| Task insertion, removal, or group change | 160-200 ms | Opacity plus 6-8 px vertical movement |
| Footer-adjacent tray | 180-220 ms | Short upward entry; matching downward exit |
| View change | 180-200 ms | Opacity plus no more than 4 px vertical movement |
| Dialog and popover | 100 ms | Keep the existing CSS treatment |

Use a single calm ease-out curve. Make exits faster through duration rather than a slow ease-in curve. Avoid bouncy springs and overshoot; they conflict with Slate's measured, reflective character.

## Current surfaces

### Task lists

Today and Backlog are the highest-value use of Motion.

- Render task rows as `motion.li` with `layout="position"` so neighbouring rows settle into place after a pointer-initiated change.
- Wrap each list in `AnimatePresence` to animate a newly created task in and a deleted task out when that action came from a pointer. Keyboard-initiated mutations remain immediate.
- A pointer-initiated completion change moves the task between active and Completed groups. Animate the item and the resulting layout, including capacity changes, rather than animating the checkbox in isolation.
- When a task changes sections, place it at the start of the destination section. Do not make the user track a moved task to the section tail; restored tasks and newly completed Today tasks likewise return at the start of their destination.
- Start a create, update, delete, or completion animation only after the local mutation succeeds and the planner snapshot updates. SQLite remains the source of truth.
- Empty states may fade in after a mutation leaves a list empty; they should not animate on initial page render.

This applies to `src/routes/today.tsx` and `src/routes/backlog.tsx`. A later drag-and-drop implementation should reuse the same layout animation and add keyboard-operable reorder controls; drag motion must not be the only way to reorder.

### Capacity summary

The Today capacity rail already uses a CSS width/color transition. Keep that implementation. Its role is to communicate a numeric update, not become a chart animation.

When a completed or scheduled task changes the total, let the rail transition once. Do not count up the minutes label or add a pulse unless the state crosses the over-capacity boundary. At that boundary, the existing destructive color and offending-task treatment are sufficient.

### Task detail panel

The task detail panel above the persistent footer already enters with CSS. Upgrade pointer-initiated opening and dismissal to a paired Motion enter/exit transition; keyboard interactions remain immediate.

The panel should be the only elevated task-editing surface. Pointer-initiated opening and dismissal use the paired transition; keyboard opening and dismissal, including Escape, are immediate. Field edits, title toggles, date selection, and focus changes remain immediate; do not animate form controls while someone is typing.

### Manual task capture

After a successful Save from the persistent footer, clear the composer immediately and let the destination task row enter from its list. The Save icon may briefly show a pending spinner while the mutation is in flight, but should not show a celebratory animation.

### AI Assist and Plan My Day

The AI review tray is the second major Motion surface. It appears directly above the persistent footer and has these transitions:

1. The user triggers AI Assist or Plan My Day.
2. A compact loading tray enters above the footer; manual Save remains usable.
3. The loading state crossfades to a reviewable result, unavailable state, or retryable error.
4. Redo replaces the current result in place; Plan My Day proposal rows use layout animation as the proposal changes.
5. Accept, Dismiss, and error recovery close the tray with the matching exit transition.

Do not use character-by-character AI typing. The current AI scope is non-streaming and review-first. If streaming is introduced later, reveal semantic result sections or complete task rows, never a typewriter effect that delays readable content.

### Navigation and settings

Pointer navigation between Today, Backlog, and Settings uses a 180-200ms opacity fade with no more than 4px of vertical movement. Today and Backlog retain the persistent shell while only workspace content transitions; Settings transitions as its own surface. Keyboard navigation remains immediate. Do not slide full pages horizontally: that makes the compact macOS popover feel like a mobile application.

Settings save and API-key save should use the existing toast for durable confirmation. During a pending save, swap the action icon for a small spinner; on completion, restore it. The AI-status dot may transition color/opacity when configuration changes, but should not pulse continuously.

### Existing primitive animations

Keep the current CSS animations for dialogs, popovers, and selects. They already use short open/close transitions and are owned by the Base UI wrappers. Do not layer Motion onto these primitives, which would create competing transforms and duplicate reduced-motion behavior.

## Explicit non-goals

- No animated initial page load, card reveal cascade, idle shimmer, parallax, or decorative gradients.
- No animated text cursor, typewriter AI response, or auto-playing illustration.
- No motion that changes task meaning, hides errors, or delays keyboard actions.
- No global wrapper that makes every component animate by default.
- No custom physics tuning per screen; use the shared timings above.

## Implementation order

1. Install `motion`, add the root reduced-motion configuration, and keep a small shared transition token module if repeated values become necessary.
2. Add task-list layout and presence transitions for create, delete, complete, and restore actions.
3. Convert the task detail panel to paired presence transitions.
4. Build the AI review tray with loading-to-result transitions as part of the planned AI feature.
5. Add the minimal route crossfade and pending-save icon treatment.
6. Validate in both full and menu-bar popover modes, including macOS Reduced Motion and the 360 x 520 minimum window.

## Acceptance criteria

- Every animated task mutation makes the changed task and its destination understandable.
- A person using Reduced Motion sees no spatial or layout movement from Slate's custom motion.
- No animation blocks persistence, navigation, focus, or keyboard interaction.
- Dialogs, popovers, and standard controls retain their current compact behavior.
- The full app and menu-bar popover remain calm and usable at the configured minimum window size.

<!-- agentkit:start design -->
# Slate design guide

Slate follows a restrained, Apple-inspired desktop utility style: calm, compact, readable, and focused on one daily planning decision at a time.

## Existing visual system

- Use the sans-serif token for utility text and `--font-serif` for prominent editorial headings, both defined in `src/styles.css`.
- Keep the warm neutral palette already established in route classes: `stone-50` backgrounds, `stone-800` primary copy, `stone-500` supporting copy, and `stone-200` boundaries.
- Reserve `emerald-700`/`emerald-800` for meaningful state, progress, and primary in-flow actions. Do not use accent color as decoration.
- Use generous vertical rhythm, hairline borders, rounded cards, and concise labels. Avoid dense dashboards, heavy shadows, and ornamental gradients.
- Maintain the small desktop layout: the native window starts at 440×640 and may shrink to 360×520.

## Interaction and accessibility

- Make each view’s main task obvious with a clear heading and a single next action.
- Preserve keyboard-visible focus states and semantic labels on non-text UI.
- Use `tabular-nums` for capacity and duration values.
- Prefer inline feedback and quiet transitions over interruptive modals unless the action is destructive or requires confirmation.

Apply this guidance in `src/routes/`, the shared shell in `src/routes/__root.tsx`, and global style tokens in `src/styles.css`.
<!-- agentkit:end design -->

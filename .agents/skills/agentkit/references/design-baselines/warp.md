# [Project Name] Design — Warp

Design spec for [Project Name]. Map semantic tokens to `[theme stylesheet path, e.g. src/styles.css]` or your Tailwind theme.

## Overview

Warm dark terminal brand: brown-beige canvas (not pure black), off-white as the only "primary" — no chromatic accent. Terminal mockups carry decoration. Extremely tight 3–4px button radii. Inter for narrative, DM Mono for code.

**Key characteristics:**
- `{colors.primary}` = warm off-white (CTA fill AND default text) — not a hue
- `{colors.canvas}` warm dark (#2b2622 family) — warmth is identity
- Tight radii: `{rounded.sm}` 3px, `{rounded.md}` 4px for CTAs
- Hero display weight 400, quietly confident
- Hairline + surface contrast only; no drop shadows
- Terminal screenshots as sole decorative system

## Colors

### Brand (no chromatic accent)
- `{colors.primary}` — off-white (button fill, ink on canvas)
- `{colors.on-primary}` — warm dark text on off-white buttons

### Surface
- `{colors.canvas}` — warm dark page
- `{colors.canvas-soft}` — cards, mockup chrome, partner tiles
- `{colors.hairline}` — dividers

### Text
- `{colors.ink}` — same off-white as primary on canvas
- `{colors.body-strong}`, `{colors.body}`, `{colors.mute}` — stepped emphasis

## Typography

- Inter 400/500 for UI; DM Mono 400 for terminal/code; Instrument Serif optional for rare editorial italics
- Negative tracking on display (-1.6px at 64px hero)

| Token | Use |
|---|---|
| `{typography.display-xl}` | Hero 64px / 400 |
| `{typography.body-md}` | Default body 16px |
| `{typography.code}` | Terminal mockup body |
| `{typography.button-md}` | Button labels |

## Layout

- Base 4px; `{spacing.5xl}` 96px section padding; max ~1200px
- Hero 2-column terminal split; download tiles 3-up

## Elevation

Flat hero; hairline borders on `{colors.canvas-soft}` cards. No shadows.

## Shapes

| Token | Use |
|---|---|
| `{rounded.sm}` 3px | Primary buttons |
| `{rounded.md}` 4px | Cards |
| `{rounded.full}` | Icon circles only |

## Components

- `{components.button-primary}` — off-white on dark, `{rounded.sm}`
- `{components.button-secondary-ghost}` — ghost nav actions
- `{components.card-mockup}`, `{components.download-tile}`, `{components.partner-logo-tile}`
- `{components.hero-band}` — display-xl + terminal split
- `{components.nav-bar}`, `{components.footer}`

## Do's and Don'ts

### Do
- Keep canvas warm dark — not neutral gray or pure black
- Use 3–4px button radii
- Pair Inter with DM Mono for technical surfaces
- Set hero at weight 400

### Don't
- Don't introduce a chromatic brand accent
- Don't use generous pill CTAs
- Don't use heavy display weights (700+)
- Don't add card drop shadows

## Responsive Behavior

Nav hamburger below 768px. Hero mockups stack vertically. Touch targets padded to 44px on mobile.

## Token Mapping

Bind roles in `[theme stylesheet path, e.g. src/styles.css]`.

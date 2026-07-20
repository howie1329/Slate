# [Project Name] Design — Apple

Design spec for [Project Name]. Map semantic tokens to `[theme stylesheet path, e.g. src/styles.css]` or your Tailwind theme. Do not hardcode literal colors in components.

## Overview

Photography-first marketing: full-bleed product tiles alternating light and dark canvases, confident display type, and a single Action Blue accent for interactive elements. UI recedes so product imagery leads. One soft product shadow is allowed on photographic renders — never on cards or buttons.

**Key characteristics:**
- Tile alternation (white/parchment ↔ near-black) as section divider
- Single structural accent (`{colors.primary}`) for CTAs and links
- Pill CTAs (`{rounded.pill}`) vs compact utility rects (`{rounded.sm}`)
- Display tracking pulls negative at large sizes; body at 17px
- No decorative gradients; atmosphere from photography only

## Colors

### Brand & Accent
- `{colors.primary}` — Action Blue (CTAs, links, focus)
- `{colors.primary-hover}`, `{colors.primary-focus}` — hover and focus variants
- `{colors.on-primary}` — text on primary fills

### Surface
- `{colors.canvas}` — pure white tile
- `{colors.canvas-parchment}` — off-white alternating tile
- `{colors.surface-tile-1}` through `{colors.surface-tile-3}` — dark tile steps
- `{colors.surface-black}` — nav bar, video void
- `{colors.hairline}` — card and divider borders

### Text
- `{colors.ink}` — near-black on light; `{colors.body-on-dark}` on dark tiles
- `{colors.body-muted}`, `{colors.ink-muted-48}` — secondary and disabled

## Typography

- Display: system sans (SF Pro Display stack); body: SF Pro Text stack; mono for code snippets
- Substitute: Inter at 500/600/700 with tightened tracking; JetBrains Mono for mono

| Token | Use |
|---|---|
| `{typography.display-xl}` | Hero headline |
| `{typography.display-lg}` | Section openers |
| `{typography.lead}` | Tile taglines |
| `{typography.body}` | Default body (17px) |
| `{typography.button}` | Button labels |
| `{typography.nav-link}` | Global nav |

### Principles
- Headlines weight 600 with negative tracking; body 400
- Weight 300 rare and deliberate for large airy reads
- No weight 500 in the ladder

## Layout

- Base unit: 8px; section padding `{spacing.section}` ~80px
- Max width ~1280px; tile stacks edge-to-edge vertically
- Whitespace = canvas color change between tiles

## Elevation

Flat tiles default. One product shadow on renders resting on surface. Backdrop blur on frosted sub-nav and sticky bars.

## Shapes

| Token | Use |
|---|---|
| `{rounded.sm}` 8px | Utility buttons, inputs |
| `{rounded.lg}` 18px | Cards |
| `{rounded.pill}` | Primary/secondary pill CTAs |
| `{rounded.none}` | Full-bleed tiles |

## Components

- `{components.button-primary}` — Action Blue pill
- `{components.button-secondary}` — charcoal pill with hairline
- `{components.product-tile-light}`, `{components.product-tile-dark}` — full-bleed tiles
- `{components.store-utility-card}` — bordered white card
- `{components.global-nav}`, `{components.sub-nav-frosted}` — two-row nav
- `{components.text-input}` — surface fill, pill or md radius

## Do's and Don'ts

### Do
- Use `{colors.primary}` only for interactive signals
- Alternate light and dark tiles for rhythm
- Apply `scale(0.95)` as button press state
- Keep global nav on `{colors.surface-black}`

### Don't
- Don't add decorative gradients or second accents
- Don't pill-round utility buttons
- Don't use true `#000000` as canvas
- Don't shadow cards or buttons

## Responsive Behavior

Nav hamburger below 768px. Card grids 3→2→1. Display scales from 80px toward 36px on small phones. Touch targets ≥44px.

## Token Mapping

Bind roles in `[theme stylesheet path, e.g. src/styles.css]`.

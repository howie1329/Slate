# [Project Name] Design — Framer

Design spec for [Project Name]. Map semantic tokens to `[theme stylesheet path, e.g. src/styles.css]` or your Tailwind theme.

## Overview

Dark poster marketing: near-black canvas, oversized white display type with extreme negative tracking, white pill primary CTAs, and gradient spotlight cards as individual showcase tiles — never section backgrounds. Single sky-blue accent for links and focus only.

**Key characteristics:**
- Dark-only marketing; no light mode
- `{colors.primary}` = white (CTA fill and ink on dark)
- `{colors.accent-blue}` — hyperlinks, focus, selection only
- Gradient spotlight cards (violet, magenta, orange, coral) as scarce atmosphere
- Inter Variable body with OpenType variants when available
- Pill CTAs (`{rounded.pill}`); charcoal secondary pills

## Colors

### Brand & Accent
- `{colors.primary}` — white (CTA, headlines, body on canvas)
- `{colors.accent-blue}` — signal blue (links, focus ring)
- `{colors.on-primary}` — text on white pills (dark)

### Surface
- `{colors.canvas}` — near-black page
- `{colors.surface-1}`, `{colors.surface-2}` — card and button lifts
- `{colors.hairline}`, `{colors.hairline-soft}`
- `{colors.ink}`, `{colors.ink-muted}`

### Gradients (card fills only)
- `{colors.gradient-violet}`, `{colors.gradient-magenta}`, `{colors.gradient-orange}`, `{colors.gradient-coral}`

## Typography

- Display: GT Walsheim substitute (Mona Sans, Geist, or Inter 600–700 with tight tracking)
- Body: Inter Variable with `cv01`, `cv05`, `cv09`, `cv11`, `ss03`, `ss07` when supported

| Token | Use |
|---|---|
| `{typography.display-xxl}` | 110px hero |
| `{typography.display-xl}` | 85px section |
| `{typography.body}` | 15px default |
| `{typography.button}` | Pill labels |

### Principles
- Tracking scales hard with size (-5.5px at largest display)
- Weight band: 400 body, 500 display/buttons
- Tight line-heights (~1.30 body)

## Layout

- Base 5px increments; `{spacing.section}` 96px
- Max ~1199px; card grids 2-up → 1-up below 810px

## Elevation

Surface lift (canvas → surface-1 → surface-2). Light-edge shadow on floating mockup cards. Blue ring for focus.

## Shapes

| Token | Use |
|---|---|
| `{rounded.pill}` 100px | All text CTAs |
| `{rounded.xl}` 20px | Pricing, mockup tiles |
| `{rounded.xxl}` 30px | Gradient spotlight cards |

## Components

- `{components.button-primary}` — white pill
- `{components.button-secondary}` — charcoal pill
- `{components.gradient-spotlight-card}` — atmospheric variant tiles
- `{components.pricing-card}`, `{components.template-card}`, `{components.product-mockup-tile}`
- `{components.top-nav}`, `{components.footer}`

## Do's and Don'ts

### Do
- Push negative display tracking aggressively
- Use accent blue only for links and focus
- Limit gradient spotlight cards to 1–2 per long page
- Keep CTAs pill-shaped

### Don't
- Don't use accent blue as CTA fill
- Don't apply gradients to whole sections
- Don't ship light mode
- Don't square off CTAs

## Responsive Behavior

Nav hamburger below 810px. Display scales 110→62→32px. Pricing table becomes accordion on mobile.

## Token Mapping

Bind roles in `[theme stylesheet path, e.g. src/styles.css]`.

# [Project Name] Design — Notion

Design spec for [Project Name]. Map semantic tokens to `[theme stylesheet path, e.g. src/styles.css]` or your Tailwind theme.

## Overview

Document-like daylight system: warm paper-soft canvas, near-black ink, single Notion Blue for structure, and a decorative sticker palette for illustrations only. One optional dark indigo hero band inverts the otherwise light rhythm.

**Key characteristics:**
- `{colors.canvas-soft}` warm page floor; `{colors.surface}` white for cards
- Single structural accent `{colors.primary}` (blue) for CTAs and links
- Sticker colors (`accent-purple`, `accent-pink`, etc.) — decoration only
- Pill marketing CTAs vs 8px utility buttons
- Barely-there layered micro-shadows
- Optional `{colors.secondary}` night hero band

## Colors

### Brand & Accent
- `{colors.primary}`, `{colors.primary-active}`, `{colors.on-primary}`
- `{colors.secondary}` — dark hero band only

### Sticker palette (decorative only)
- `{colors.accent-sky}`, `{colors.accent-purple}`, `{colors.accent-pink}`, `{colors.accent-orange}`, `{colors.accent-teal}`, `{colors.accent-green}`

### Surface
- `{colors.canvas}` / `{colors.surface}` — white cards
- `{colors.canvas-soft}` — warm page and footer
- `{colors.hairline}` — borders

### Text
- `{colors.ink}`, `{colors.ink-secondary}`, `{colors.ink-muted}`, `{colors.ink-faint}`

## Typography

- NotionInter substitute: Inter with explicit negative tracking on display
- Weight 700 headlines; 400 body; 600 titles

| Token | Use |
|---|---|
| `{typography.display-1}` | Hero (64px) |
| `{typography.heading-1}` | Section headlines |
| `{typography.body-md}` | Default body (16px) |
| `{typography.button}` | Button labels |
| `{typography.eyebrow}` | Pill badges |

## Layout

- Base 8px; max width ~1080–1300px
- Section gaps over rules; card padding `{spacing.lg}` 24px

## Elevation

Level 0: hairline only. Level 1: multi-layer micro-shadow. Level 2: modals and elevated pills on dark hero.

## Shapes

| Token | Use |
|---|---|
| `{rounded.xs}` 4px | Inputs |
| `{rounded.md}` 8px | Utility buttons |
| `{rounded.lg}` 12px | Feature cards |
| `{rounded.full}` | Marketing pill CTAs |

## Components

- `{components.button-primary}` — blue pill CTA
- `{components.button-secondary}` — white pill with soft shadow
- `{components.button-utility}` — nav/plan select, `{rounded.md}`
- `{components.feature-card}`, `{components.pricing-plan-card}`
- `{components.hero-band}` — optional dark inverted hero
- `{components.nav-bar}`, `{components.footer}`

## Do's and Don'ts

### Do
- Reserve blue for actions and links only
- Use sticker palette in illustrations and dots only
- Apply negative tracking on display explicitly
- Use warm canvas for full pages

### Don't
- Don't paint CTAs in sticker colors
- Don't use pill radius on form fields
- Don't add heavy drop shadows
- Don't repeat dark hero bands

## Responsive Behavior

Nav hamburger below tablet. Grids collapse to single column. Touch targets ≥44px.

## Token Mapping

Bind roles in `[theme stylesheet path, e.g. src/styles.css]`.

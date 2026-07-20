# [Project Name] Design — Cursor

Design spec for [Project Name]. Map semantic tokens to `[theme stylesheet path, e.g. src/styles.css]` or your Tailwind theme.

## Overview

Editorial developer brand on warm cream canvas: quiet display weight 400, single Cursor Orange accent used scarcely, and IDE mockup cards as the primary decorative system. AI timeline pastels are scoped to in-product agent visualizations only.

**Key characteristics:**
- Warm cream `{colors.canvas}` — never pure white page floor
- Single CTA color `{colors.primary}` (orange)
- Display weight 400; negative tracking on display only
- JetBrains Mono on every code surface
- Hairline-only depth; no drop shadows
- Timeline pastels: thinking, grep, read, edit, done — agent UI only

## Colors

### Brand & Accent
- `{colors.primary}`, `{colors.primary-active}`, `{colors.on-primary}`

### Surface
- `{colors.canvas}` — warm cream page floor
- `{colors.canvas-soft}` — IDE pane background in mockups
- `{colors.surface-card}` — white cards on cream
- `{colors.surface-strong}` — badges
- `{colors.hairline}`, `{colors.hairline-soft}`, `{colors.hairline-strong}`

### Text
- `{colors.ink}`, `{colors.body}`, `{colors.body-strong}`, `{colors.muted}`, `{colors.muted-soft}`

### Timeline (in-product only)
- `{colors.timeline-thinking}`, `{colors.timeline-grep}`, `{colors.timeline-read}`, `{colors.timeline-edit}`, `{colors.timeline-done}`

### Semantic
- `{colors.semantic-success}`, `{colors.semantic-error}`

## Typography

- CursorGothic substitute: Inter weight 400/500/600; JetBrains Mono for code
- Display 400 with negative tracking; body 400 at 16px

| Token | Use |
|---|---|
| `{typography.display-mega}` | Homepage hero |
| `{typography.display-lg}` | Section heads |
| `{typography.body-md}` | Default body |
| `{typography.code}` | Code blocks |
| `{typography.button}` | CTA labels |

## Layout

- Base 4px; `{spacing.section}` 80px; max width ~1200px
- Feature grids 3-up → 2-up → 1-up; footer 5-column desktop

## Elevation

Hairlines + white-on-cream contrast only. IDE mockup cards are the elevated element.

## Shapes

| Token | Use |
|---|---|
| `{rounded.md}` 8px | CTAs, inputs |
| `{rounded.lg}` 12px | Cards, IDE panes |
| `{rounded.pill}` | Timeline pills, badges |

## Components

- `{components.button-primary}` — orange CTA `{rounded.md}`
- `{components.button-download}` — ink fill inverted CTA
- `{components.hero-band}`, `{components.ide-mockup-card}`, `{components.ide-pane}`
- `{components.timeline-pill-*}` — five stage variants
- `{components.feature-card}`, `{components.pricing-tier-card}`
- `{components.top-nav}`, `{components.footer}`

## Do's and Don'ts

### Do
- Keep display at weight 400
- Use timeline pastels only in agent timeline UI
- Render code in JetBrains Mono

### Don't
- Don't add drop shadows
- Don't use timeline pastels as system action colors
- Don't bold display headlines

## Responsive Behavior

Nav hamburger below 768px. Hero display 72→32px mobile. IDE mockup collapses to single pane.

## Token Mapping

Bind roles in `[theme stylesheet path, e.g. src/styles.css]`.

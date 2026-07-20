# [Project Name] Design — Linear

Design spec for [Project Name]. Map every `{colors.*}`, `{typography.*}`, `{spacing.*}`, and `{rounded.*}` token to semantic roles in `[theme stylesheet path, e.g. src/styles.css]` or your Tailwind theme. Do not hardcode literal hex values in components.

## Overview

Dark-canvas marketing system: near-black canvas with a faint cool tint, light gray ink, and a single lavender-blue accent used scarcely on brand mark, focus rings, and primary CTAs. Hierarchy comes from a four-step surface ladder and hairline borders — not shadows. Product UI screenshots dominate section composition.

**Key characteristics:**
- Dark canvas anchor; no light-mode marketing variant
- Single chromatic accent (`{colors.primary}`) — no second brand color
- Surface ladder: canvas → surface-1 → surface-2 → surface-3 → surface-4
- Aggressive negative letter-spacing on display sizes
- Cards: `{rounded.lg}` with 1px hairlines; product panels `{rounded.xl}`
- No atmospheric gradients or spotlight cards

## Colors

### Brand & Accent
- `{colors.primary}` — signature accent (CTA, brand mark, link emphasis, focus tint)
- `{colors.primary-hover}` — lighter hover state for primary CTA
- `{colors.primary-focus}` — focus-ring tint
- `{colors.on-primary}` — text on primary fills

### Surface
- `{colors.canvas}` — default page background (deepest dark)
- `{colors.surface-1}` through `{colors.surface-4}` — stepped lifts for cards, panels, sub-nav
- `{colors.hairline}`, `{colors.hairline-strong}`, `{colors.hairline-tertiary}` — 1px borders
- `{colors.inverse-canvas}`, `{colors.inverse-surface-1}`, `{colors.inverse-surface-2}` — inverse pill surfaces

### Text
- `{colors.ink}` — headlines and emphasized body
- `{colors.ink-muted}`, `{colors.ink-subtle}`, `{colors.ink-tertiary}` — secondary through quaternary

### Semantic
- `{colors.semantic-success}` — status pills only
- `{colors.semantic-overlay}` — modal scrim

## Typography

### Font Family
- Display/body sans with tight tracking at large sizes; mono for code in product screenshots only
- Substitute: Inter or system UI stack; JetBrains Mono or Geist Mono for mono

### Hierarchy (map sizes to your scale)

| Token | Use |
|---|---|
| `{typography.display-xl}` | Largest hero headline |
| `{typography.display-lg}` | Section openers |
| `{typography.display-md}` | Sub-section headlines |
| `{typography.headline}` | Pricing tier titles, CTA banners |
| `{typography.card-title}` | Feature card titles |
| `{typography.subhead}` | Lead body |
| `{typography.body-lg}` | Hero subhead |
| `{typography.body}` | Default body |
| `{typography.body-sm}` | Card body, footer |
| `{typography.caption}` | Meta, status |
| `{typography.button}` | Button labels |
| `{typography.eyebrow}` | Section eyebrow (slight positive tracking) |
| `{typography.mono}` | Code in screenshots |

### Principles
- Negative tracking scales with display size; body near zero
- Display weight 600; body 400
- Mono only in code contexts inside mockups

## Layout

- Base unit: 4px (`{spacing.xxs}` 4 · `{spacing.xs}` 8 · `{spacing.sm}` 12 · `{spacing.md}` 16 · `{spacing.lg}` 24 · `{spacing.xl}` 32 · `{spacing.xxl}` 48 · `{spacing.section}` 96)
- Max content ~1280px; card grids 3-up → 2-up → 1-up
- Product screenshot panels span full content width

## Elevation & Depth

Surface ladder + hairlines only. No drop shadows on dark marketing surfaces. Focus: 2px `{colors.primary-focus}` outline at reduced opacity.

## Shapes

| Token | Typical use |
|---|---|
| `{rounded.xs}` 4px | Chips, badges |
| `{rounded.md}` 8px | Buttons, inputs |
| `{rounded.lg}` 12px | Cards |
| `{rounded.xl}` 16px | Screenshot panels |
| `{rounded.pill}` | Pricing tabs, status pills |

## Components

- `{components.button-primary}` — primary CTA on `{colors.primary}`
- `{components.button-secondary}` — charcoal surface-1 + hairline
- `{components.button-tertiary}` — plain text on canvas
- `{components.pricing-card}`, `{components.feature-card}`, `{components.product-screenshot-card}` — surface-1 + hairline + `{rounded.lg}` or `{rounded.xl}`
- `{components.top-nav}` — sticky dark bar, 56px
- `{components.text-input}` — surface-1, focus ring on `{colors.primary-focus}`

## Do's and Don'ts

### Do
- Reserve `{colors.primary}` for brand mark, primary CTA, focus, links
- Use the surface ladder sequentially
- Lead sections with product UI screenshots
- Use `{rounded.md}` for CTAs

### Don't
- Don't ship light-mode marketing
- Don't use lavender as section background
- Don't add atmospheric gradients or second chromatic accents
- Don't pill-round primary CTAs (use `{rounded.md}`)

## Responsive Behavior

Breakpoints: desktop 1280px · tablet 1024px · mobile-lg 768px · mobile 480px. Nav hamburger below 768px. Display type scales down on mobile while preserving negative tracking ratio.

## Token Mapping

Bind each `{colors.*}` role to your theme (e.g. Tailwind `@theme` or CSS custom properties). Repo theme file: `[theme stylesheet path, e.g. src/styles.css]`.

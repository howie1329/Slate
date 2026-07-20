# agentkit design (skill workflow)

Create or refresh `DESIGN.md` from a bundled design baseline. This workflow runs inside the agent; it is not the CLI template installer.

Use this when the user asks `/agentkit design`, wants to choose a design language, or needs `DESIGN.md` for UI work (including skills that read only from `DESIGN.md`).

## Preconditions

- Read `references/file-contract.md` before editing.
- Read `agentkit.config.json` when present for `designSystem` default.
- Baseline sources live in `references/design-baselines/` (bundled with this skill).

## Supported baselines

| Key | Best for |
| --- | --- |
| `linear` | Dark dev-tool marketing, lavender accent, product UI screenshots |
| `apple` | Photography-first tiles, Action Blue, pill CTAs |
| `cursor` | Warm cream editorial, Cursor Orange, IDE mockups, agent timeline |
| `framer` | Dark poster aesthetic, white pill CTAs, gradient spotlight cards |
| `notion` | Warm paper canvas, Notion Blue, sticker decorations |
| `warp` | Warm dark terminal, off-white only, tight radii, monospace-forward |

Default to `designSystem` from config when set. When unsure, recommend `linear` for dark SaaS marketing or `notion` for document/productivity apps; mention the other options briefly.

## Non-negotiables

- Map semantic tokens to the project's real theme — inspect Tailwind config, CSS variables, or `[theme stylesheet path]` before writing.
- Do not hardcode literal hex in the final `DESIGN.md` unless the user explicitly wants fixed values.
- Preserve user content outside AgentKit managed blocks when refreshing an existing file.
- Skip overwriting an existing `DESIGN.md` unless the user explicitly asks to create or refresh it.
- Do not modify application source, lockfiles, or CI during this workflow unless the user asks to update theme files.

## Procedure

### 1. Check existing state

- If `DESIGN.md` exists with valid managed blocks, ask whether to refresh or only adjust.
- If `DESIGN.md` exists without managed blocks, ask before converting or overwriting.
- If missing, proceed to create.

### 2. Choose baseline

Present the six baselines with one-line guidance. Confirm the user's choice (or accept config default).

Brief customization questions (pick 2–3 relevant to the baseline):

- Light vs dark default (or confirm dark-only / light-only baselines)
- Accent mapping: which theme token maps to `{colors.primary}`
- Density: compact vs editorial spacing
- For `notion`: include dark "night" hero band or full daylight
- For `framer`: which gradient spotlight variants to document
- For `warp`: confirm no chromatic accent (off-white primary)

### 3. Inspect repository theme

Before writing, find:

- Tailwind `@theme` / `tailwind.config.*` / global CSS variables
- Existing component primitives and radius/spacing conventions
- Font stacks in use

Add a **Token Mapping** section that binds each `{colors.*}` / `{typography.*}` role to project tokens. Replace `[theme stylesheet path, e.g. src/styles.css]` with the real path.

### 4. Build DESIGN.md

1. Read the chosen baseline from `references/design-baselines/<name>.md`.
2. Personalize `[Project Name]` from `package.json` or directory name.
3. Apply customization answers in Overview, Colors, or Do's/Don'ts as needed.
4. Wrap AgentKit-owned content in managed block markers:

```html
<!-- agentkit:start design -->
...content...
<!-- agentkit:end design -->
```

5. Write `DESIGN.md` at the repository root unless `personalization.designSystemPath` or an existing project convention points elsewhere.

### 5. Update AGENTS.md reference

If `AGENTS.md` exists and still references `DESIGN-SYSTEM.md`, update the companion trigger to `DESIGN.md` inside managed blocks only.

### 6. Verify

- Managed block id is `design` (paired markers).
- No `[Project Name]` placeholders remain.
- Token mapping points at real project theme paths/tokens.
- Baseline-specific rules preserved (e.g. Warp: no chromatic accent; Cursor: timeline pastels scoped to agent UI).

### 7. Report

Tell the user:

- Baseline chosen and customizations applied
- Path written (`DESIGN.md` or configured path)
- Theme mapping sources used
- Assumptions or deferred sections

Keep the report concise.

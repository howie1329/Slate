# AgentKit File Contract

Read this before creating, updating, auditing, or repairing any AgentKit-managed guidance file.

This contract is the shared rulebook for AgentKit guidance-edit workflows. Route files define procedure; this file defines the invariants every route must preserve.

## Config

Read `agentkit.config.json` from the repository root when present:

| Field | Use |
| --- | --- |
| `installMode` | `"skill"` confirms a skill-path project; missing values are treated as template-path unless the user explicitly invokes the skill workflow |
| `agentkitVersion` | Package version at skill install; informational |
| `templateSet` | `minimal`, `standard`, or `full`; determines configured guidance inventory |
| `preset` | Stack preset (`next`, `sveltekit`, `express`, `convex`, `fullstack`) used for `STACK.md` |
| `aiTools` | Which thin adapter files to create (`codex`, `cursor`, `claude`, `copilot`) |
| `designSystem` | `linear`, `apple`, `cursor`, `framer`, `notion`, or `warp`; baseline for `DESIGN.md` |
| `personalization` | Fallback defaults for project name, commands, and paths; repo facts win when available |

Prefer repository facts over config personalization. Use config values as defaults, not as a reason to ignore visible codebase reality.

## Route Behavior

- `agentkit init`: create missing configured guidance files from repo context; skip existing files by default.
- `agentkit update`: refresh valid AgentKit managed blocks and create missing configured files; skip unmanaged files by default.
- `agentkit doctor`: audit guidance quality and report findings; do not edit by default.
- `agentkit learn`: teach recent codebase changes; do not edit or create files by default.
- `agentkit design`: create or refresh `DESIGN.md` from a bundled baseline; skip existing file unless user asks to refresh.
- Refresh, conversion, repair, or wholesale regeneration requires an explicit user request.

## File Inventory

### Template sets

`minimal`:

- `AGENTS.md`

`standard`:

- `AGENTS.md`
- `CHANGE-EXPLANATION.md`
- `CODE-QUALITY.md`
- `DESIGN.md`
- `.github/pull_request_template.md`

`full`:

- Everything in `standard`
- `TESTING.md`
- `SECURITY-CHECKLIST.md`
- `WORKFLOWS.md`
- `PRD-TEMPLATE.md`
- `IMPLEMENTATION-BRIEF-TEMPLATE.md`

### AI tool adapters

Adapters are additive and controlled by `aiTools` or explicit user request. Do not create adapters for unselected tools just because `templateSet` is `full`.

| Tool | File |
| --- | --- |
| `codex` | Uses `AGENTS.md` directly; no adapter file |
| `cursor` | `.cursor/rules/agentkit.md` |
| `claude` | `CLAUDE.md` |
| `copilot` | `.github/copilot-instructions.md` |

Adapters are thin pointers to `AGENTS.md`. Do not duplicate operating rules.

### Stack guidance

Create or update `STACK.md` when:

- `preset` is set in config
- the user explicitly asks for stack guidance
- stack signals are strong enough to infer a preset confidently

When `STACK.md` exists or will be created, `AGENTS.md` should tell agents to read `STACK.md` before stack-specific changes.

## File Roles

- `AGENTS.md`: source-of-truth router; project purpose, project map, real commands, workflow expectations, companion-doc routing, safety rules, and before-finishing checklist.
- `STACK.md`: stack-specific guidance based on repo facts and configured or inferred preset.
- `CHANGE-EXPLANATION.md`: handoff, summary, and change-explanation expectations.
- `CODE-QUALITY.md`: review, refactor, and maintainability guidance; reference commands from `AGENTS.md`.
- `DESIGN.md`: UI/design spec from configured or chosen baseline; map semantic tokens to project theme.
- `.github/pull_request_template.md`: concise PR checklist; do not over-personalize per-work-item templates.
- `TESTING.md`: detected test tools, test locations, and real test commands.
- `SECURITY-CHECKLIST.md`: project-relevant security boundaries such as auth, secrets, API inputs, and data access.
- `WORKFLOWS.md`: repo-specific planning, review, release, and development workflows.
- `PRD-TEMPLATE.md`: reusable product requirements template; do not fill with current work.
- `IMPLEMENTATION-BRIEF-TEMPLATE.md`: reusable implementation planning template; do not fill with current work.
- AI adapters: thin pointers to `AGENTS.md`.

## Managed Blocks

AgentKit-owned content must be wrapped in paired markers:

```html
<!-- agentkit:start <id> -->
Generated content
<!-- agentkit:end <id> -->
```

Rules:

- Use stable ids, such as `agents`, `stack`, `design`, `testing`, or `security-checklist`.
- For new files, usually wrap the full AgentKit-generated body in one top-level managed block.
- Adapters can be fully managed because they should only point to `AGENTS.md`.
- Preserve all user edits before and after managed blocks.
- Replace only valid managed block content during update or refresh.
- Skip unmanaged existing files unless the user explicitly asks to convert them.
- Malformed managed block markers block edits to that file; defer and recommend repair.

## Repository Inspection

Inspect before writing or auditing:

1. `package.json` for name, description, and scripts
2. Lockfiles for package manager
3. Framework signals, such as `next.config.*`, `svelte.config.*`, `convex/`, `vite.config.*`, `app/`, or `pages/`
4. Source layout, such as `src/`, `test/`, `tests/`, `docs/`, `.github/`
5. Test runner and tooling config, such as Vitest, Jest, Playwright, ESLint, TypeScript, or build config
6. UI/design signals, such as Tailwind config, CSS files, component folders, or design docs
7. Backend/data/auth signals, such as API routes, schema files, auth packages, or server modules
8. Existing guidance files and managed block markers

Prefer repo facts over config personalization when they conflict.

## Placeholder And Command Rules

Replace bracket placeholders with real values from the repo or omit the placeholder-dependent section:

| Placeholder | Source |
| --- | --- |
| `[Project Name]` | `package.json` name or directory name |
| `[short project description]` | `package.json` description or README first paragraph |
| `[issue tracker, e.g. Linear or GitHub Issues]` | `personalization.issueTracker` or infer from `.github/` |
| `[design system path, e.g. docs/design-system.md]` | `personalization.designSystemPath`, existing design docs, or `DESIGN.md` |
| `[briefs path, e.g. docs/briefs]` | `personalization.briefsPath`, existing docs path, or omit |
| Project commands | Real scripts from `package.json` or explicit user/config personalization |

Never invent scripts. If a command is not present and not explicitly provided, omit it or describe that it is not configured.

## Healthy Guidance Criteria

AgentKit guidance is healthy when:

- Required files for the configured inventory exist or are intentionally deferred.
- `AGENTS.md` is present and acts as the router/source of truth.
- Managed block markers are paired and stable.
- Commands match `package.json` scripts or explicit user/config personalization.
- No `[Project Name]`-style placeholders remain in AgentKit-managed content.
- `AGENTS.md` references only companion files that exist or are being created.
- `STACK.md` exists when configured or confidently inferred, and `AGENTS.md` references it.
- AI adapters point to `AGENTS.md` and do not duplicate full operating rules.
- Generated guidance reflects visible repo facts instead of generic filler.

## Edit Boundaries

- Do not modify application source code, lockfiles, package manifests, or CI config during AgentKit workflows.
- Do not delete user-written content outside managed blocks.
- Do not run `git commit`, `git push`, or destructive shell commands.
- Docs-only and learn workflows do not require running project test/build commands.

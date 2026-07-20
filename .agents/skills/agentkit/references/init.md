# agentkit init (skill workflow)

Create AgentKit guidance files from the current repository context. This workflow runs **inside the agent** after `agentkit skill install`; it is not the CLI `agentkit init` template installer.

The skill path is context-aware. Do not copy generic templates when repository facts are available. Use AgentKit's file contract as structure, then author guidance from the codebase in front of you.

## Preconditions

- Read `references/file-contract.md` before editing any AgentKit-managed file.
- Prefer `agentkit.config.json` when present.
- If config is missing but the user explicitly requested `/agentkit init`, continue with safe defaults:
  - `templateSet: standard`
  - `aiTools: ["codex"]`
  - infer `preset` from repository signals when obvious
  - infer `designSystem` only when UI/design signals exist

## Non-negotiables

- Create missing guidance files only by default.
- Skip existing files unless the user explicitly asks to refresh or regenerate them.
- Preserve user content outside AgentKit managed blocks.
- Never invent commands. Commands must come from `package.json` scripts or explicit user/config personalization.
- Replace all bracket placeholders with real values or omit the placeholder-dependent section.
- Do not modify application source files, lockfiles, or CI config during init.
- Keep `AGENTS.md` as the source-of-truth router; adapters stay thin pointers.

## Procedure

### 1. Build Repo Profile

Inspect the repository before choosing file content.

Collect:

- Project name and description from `package.json`, README, or directory name
- Package manager from lockfiles
- Scripts from `package.json`
- Framework/runtime signals, such as Next.js, SvelteKit, Express, Convex, Vite, React, Node, TypeScript
- Source layout, such as `src/`, `app/`, `pages/`, `convex/`, `test/`, `docs/`
- Test, lint, build, typecheck, and dev tooling
- UI/design system signals, such as Tailwind, CSS files, component folders, design docs
- Backend/data/auth signals, such as API routes, database/schema files, auth packages
- Existing docs, briefs, PR templates, workflow docs, or agent guidance files
- Issue tracker/workflow hints from `.github/`, Linear docs, or config personalization

Prefer repository facts over config personalization. Use config personalization only as fallback.

### 2. Resolve AgentKit Config

Read `agentkit.config.json` when present.

Use:

- `installMode`
- `agentkitVersion`
- `templateSet`
- `preset`
- `aiTools`
- `designSystem`
- `personalization`

If values are missing:

- Default `templateSet` to `standard`
- Default `aiTools` to `["codex"]`
- Infer `preset` only when repo signals are strong
- Use `designSystem` only for standard/full installs or when UI guidance is clearly useful

Configs without `installMode` are treated as template-path installs, but if the user explicitly invoked this skill workflow, continue carefully and report the assumption.

### 3. Decide File Inventory

Use `references/file-contract.md` as the source of truth.

Inventory rules:

- `minimal`
  - `AGENTS.md`

- `standard`
  - `AGENTS.md`
  - `CHANGE-EXPLANATION.md`
  - `CODE-QUALITY.md`
  - `DESIGN.md`
  - `.github/pull_request_template.md`

- `full`
  - everything in `standard`
  - `TESTING.md`
  - `SECURITY-CHECKLIST.md`
  - `WORKFLOWS.md`
  - `PRD-TEMPLATE.md`
  - `IMPLEMENTATION-BRIEF-TEMPLATE.md`
  - selected AI tool adapters

- `preset` set or confidently inferred
  - add `STACK.md`

- `aiTools`
  - `codex`: no adapter; uses `AGENTS.md`
  - `cursor`: `.cursor/rules/agentkit.md`
  - `claude`: `CLAUDE.md`
  - `copilot`: `.github/copilot-instructions.md`

Before writing, briefly tell the user which missing files will be created and which existing files will be skipped.

### 4. Author Missing Files

Create only files that do not already exist.

For each created file:

- Create parent directories if needed.
- Wrap AgentKit-owned content in managed block markers from `references/file-contract.md`.
- Use project-specific facts from the repo profile.
- Avoid generic filler.
- Keep guidance concise and operational.

File roles:

- `AGENTS.md`
  - Primary router and source of truth
  - Include project purpose, project map, real commands, workflow expectations, companion-doc routing, safety rules, and before-finishing checklist
  - Reference `STACK.md` when created
  - Reference companion files only when they exist or are part of this init

- `STACK.md`
  - Stack-specific guidance based on repo facts and configured/inferred preset
  - Include framework boundaries, source layout, validation points, and relevant checks
  - Do not include generic framework advice that does not apply to the repo

- `CHANGE-EXPLANATION.md`
  - Handoff and change-summary expectations
  - Keep tied to this project's likely workflows and changed-file surfaces

- `CODE-QUALITY.md`
  - Review, refactor, and maintainability guidance
  - Reference real project commands from `AGENTS.md`
  - Avoid duplicating large command tables

- `DESIGN.md`
  - Only include when UI/design surfaces exist or user requests design guidance
  - Start from configured `designSystem` baseline when set; map tokens to project theme
  - Mention real component/style paths when visible
  - Prefer `/agentkit design` when user wants baseline selection or customization

- `.github/pull_request_template.md`
  - Keep concise and generally useful
  - Do not over-personalize per-work-item templates

- `TESTING.md`
  - Include detected test tools and where tests live
  - Include real test commands only

- `SECURITY-CHECKLIST.md`
  - Include project-relevant security boundaries such as auth, secrets, API inputs, and data access
  - Avoid irrelevant compliance boilerplate

- `WORKFLOWS.md`
  - Capture repo-specific development workflows, planning docs, release steps, or review flow when visible

- `PRD-TEMPLATE.md` and `IMPLEMENTATION-BRIEF-TEMPLATE.md`
  - Keep as reusable work-item templates
  - Do not fill them with current project facts beyond light path references

- AI adapters
  - Keep thin
  - Point to `AGENTS.md`
  - Do not duplicate operating rules

### 5. Existing Files And Refresh Requests

Default behavior:

- Skip existing guidance files.
- Report them as skipped.
- Do not edit managed blocks during normal init.

If the user explicitly asks to refresh or regenerate existing files:

- Preserve all content outside managed blocks.
- Replace only AgentKit managed blocks.
- Stop and recommend `agentkit doctor` or `agentkit repair` if managed block markers are malformed.
- Never overwrite unmanaged user-written files wholesale unless the user explicitly confirms the exact file.

### 6. Verify

Before finishing, check:

- Every planned missing file was created or explicitly deferred with a reason.
- Existing files were not overwritten by default.
- Managed block markers are paired and use stable ids.
- No `[Project Name]`-style placeholders remain.
- Commands in guidance match `package.json` scripts or explicit config/user personalization.
- `AGENTS.md` references `STACK.md` only when `STACK.md` exists.
- AI adapters point to `AGENTS.md` and do not duplicate full guidance.
- No application source files, lockfiles, or CI files were modified.

Docs-only init does not require running the project's test/build commands.

### 7. Report

Tell the user:

- Files created
- Files skipped because they already existed
- Stack and package manager inferred
- Commands inferred
- Config values used
- Assumptions made
- Any deferred files and why

Keep the report concise.

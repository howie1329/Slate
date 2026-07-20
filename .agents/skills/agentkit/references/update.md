# agentkit update (skill workflow)

Sync existing AgentKit guidance files with the current repository context. This workflow runs **inside the agent** for skill-path projects; it is not the CLI `agentkit update` managed-block template merger.

The skill path is context-aware. Re-read the repository, compare guidance against current codebase reality, and update only AgentKit-managed content.

## Preconditions

- Read `references/file-contract.md` before editing any AgentKit-managed file.
- Read `agentkit.config.json` when present.
- If `installMode: skill`, continue with this workflow.
- If `installMode: template` or config is missing, continue only when the user explicitly asked for the skill workflow; otherwise direct them to CLI `agentkit update`.

## Non-negotiables

- Preserve user content outside AgentKit managed blocks.
- Never invent commands. Commands must come from `package.json` scripts or explicit user/config personalization.
- Do not overwrite unmanaged existing files.
- Stop on malformed managed block markers and recommend `agentkit repair` before updating that file.
- Do not modify application source files, lockfiles, package manifests, or CI config during update.
- Keep `AGENTS.md` as the source-of-truth router; adapters stay thin pointers.

## Procedure

### 1. Build Fresh Repo Profile

Inspect the repository again before deciding what to update.

Collect:

- Project name and description from `package.json`, README, or directory name
- Package manager from lockfiles
- Current scripts from `package.json`
- Framework/runtime signals, such as Next.js, SvelteKit, Express, Convex, Vite, React, Node, TypeScript
- Current source layout, such as `src/`, `app/`, `pages/`, `convex/`, `test/`, `docs/`
- Current test, lint, build, typecheck, and dev tooling
- UI/design system signals, such as Tailwind, CSS files, component folders, design docs
- Backend/data/auth signals, such as API routes, database/schema files, auth packages
- Existing docs, briefs, PR templates, workflow docs, or agent guidance files
- Issue tracker/workflow hints from `.github/`, Linear docs, or config personalization

Prefer repository facts over config personalization. Use config personalization only as fallback.

### 2. Read Current AgentKit State

Inspect:

- `agentkit.config.json`
- `AGENTS.md`
- `STACK.md`
- companion guidance files
- AI tool adapters
- managed block markers in every AgentKit guidance file

Record:

- Files present
- Files missing for the configured `templateSet`, `preset`, and `aiTools`
- Files with managed blocks
- Files without managed blocks
- Files with malformed managed blocks

### 3. Decide Sync Scope

Use `references/file-contract.md` as the source of truth for inventory.

Update should handle:

- Stale commands
- Stale project name or description
- Stale stack/framework guidance
- Changed source layout
- Changed test/build/lint tooling
- Changed design system or docs paths
- Missing companion files implied by `templateSet`
- Missing `STACK.md` when `preset` is set or stack is confidently inferred
- Missing AI adapters implied by `aiTools`
- Adapters that duplicate operating rules instead of pointing to `AGENTS.md`
- Remaining bracket placeholders

Before writing, briefly tell the user which files will be updated, created, skipped, or deferred.

### 4. Update Managed Files

For each existing AgentKit guidance file:

- If the file has a valid AgentKit managed block, replace only the managed block content.
- Preserve all text before and after the managed block exactly.
- If the file exists but has no managed block, skip it unless the user explicitly asks to convert it.
- If the file has malformed managed blocks, defer it and recommend `agentkit repair`.
- Use current repo facts from the fresh repo profile.
- Avoid generic filler.
- Keep guidance concise and operational.

File roles:

- `AGENTS.md`
  - Refresh project purpose, project map, real commands, workflow expectations, companion-doc routing, safety rules, and before-finishing checklist
  - Reference only companion files that exist or will be created in this update
  - Reference `STACK.md` only when it exists or will be created

- `STACK.md`
  - Refresh stack-specific guidance based on current repo facts and configured/inferred preset
  - Include current framework boundaries, source layout, validation points, and relevant checks
  - Remove or avoid generic framework advice that does not apply to the repo

- `CHANGE-EXPLANATION.md`
  - Refresh handoff and change-summary expectations when project workflow signals changed

- `CODE-QUALITY.md`
  - Refresh review, refactor, and maintainability guidance
  - Reference real project commands from `AGENTS.md`
  - Avoid duplicating large command tables

- `DESIGN.md`
  - Refresh UI design spec only when a UI/design surface exists or the file is configured
  - Use configured `designSystem` baseline; map tokens to project theme
  - Mention current component/style paths when visible
  - Prefer `/agentkit design` when user wants baseline selection or customization

- `.github/pull_request_template.md`
  - Keep concise and generally useful
  - Do not over-personalize per-work-item templates

- `TESTING.md`
  - Refresh detected test tools, test locations, and real test commands

- `SECURITY-CHECKLIST.md`
  - Refresh project-relevant security boundaries such as auth, secrets, API inputs, and data access
  - Avoid irrelevant compliance boilerplate

- `WORKFLOWS.md`
  - Refresh repo-specific development workflows, planning docs, release steps, or review flow when visible

- `PRD-TEMPLATE.md` and `IMPLEMENTATION-BRIEF-TEMPLATE.md`
  - Keep as reusable work-item templates
  - Avoid filling them with current project facts beyond light path references

- AI adapters
  - Keep thin
  - Point to `AGENTS.md`
  - Do not duplicate operating rules

### 5. Create Missing Configured Files

Create missing files implied by `templateSet`, `preset`, or `aiTools`.

For each created file:

- Create parent directories if needed.
- Wrap AgentKit-owned content in managed block markers from `references/file-contract.md`.
- Use current repo facts from the fresh repo profile.
- Report the file as created.

Do not create unrelated guidance files outside the configured inventory unless the user asks.

### 6. Handle Unmanaged Or Malformed Files

Default behavior:

- Skip unmanaged existing files.
- Defer malformed files.
- Report why each file was skipped or deferred.

If the user explicitly asks to convert an unmanaged file:

- Preserve the original content outside the new managed block when possible.
- Add one AgentKit managed block for generated content.
- Do not delete user-written guidance.

If the user explicitly asks to repair malformed blocks, use the repair workflow when available. If no repair workflow is available, ask before making structural marker changes.

### 7. Verify

Before finishing, check:

- Managed block markers are paired and use stable ids.
- No `[Project Name]`-style placeholders remain in AgentKit-managed content.
- Commands in guidance match `package.json` scripts or explicit config/user personalization.
- `AGENTS.md` references only companion files that exist.
- `AGENTS.md` references `STACK.md` only when `STACK.md` exists.
- AI adapters point to `AGENTS.md` and do not duplicate full guidance.
- Missing configured files were created or explicitly deferred with a reason.
- No application source files, lockfiles, package manifests, or CI files were modified.

Docs-only update does not require running the project's test/build commands.

### 8. Report

Tell the user:

- Files updated
- Files created
- Files skipped because they were unmanaged
- Files deferred because managed blocks were malformed
- Stale facts fixed
- Stack and package manager inferred
- Commands inferred
- Config values used
- Assumptions made

Keep the report concise.

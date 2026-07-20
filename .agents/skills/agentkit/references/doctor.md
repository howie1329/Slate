# agentkit doctor (skill workflow)

Audit AgentKit guidance quality against the current repository context and `references/file-contract.md`. This workflow is read-only by default.

Use doctor when the user asks to audit, review, check, validate, diagnose, or inspect AgentKit guidance.

## Preconditions

- Read `references/file-contract.md` before auditing.
- Read `agentkit.config.json` when present.
- Inspect repository facts before judging guidance quality.
- Do not edit files unless the user explicitly asks for fixes after the audit.

## Non-negotiables

- Report findings before suggesting fixes.
- Do not modify guidance files by default.
- Do not modify application source files, lockfiles, package manifests, or CI config.
- Never invent missing scripts or assume commands exist.
- Treat malformed managed blocks as blocking issues for update/refresh on that file.

## Procedure

### 1. Build Repo Profile

Collect:

- Project name and description from `package.json`, README, or directory name
- Package manager from lockfiles
- Scripts from `package.json`
- Framework/runtime signals, such as Next.js, SvelteKit, Express, Convex, Vite, React, Node, TypeScript
- Source layout, such as `src/`, `app/`, `pages/`, `convex/`, `test/`, `docs/`
- Test, lint, build, typecheck, and dev tooling
- UI/design system signals
- Backend/data/auth signals
- Existing docs, workflow files, PR templates, and agent guidance files

Prefer repository facts over config personalization.

### 2. Read AgentKit State

Inspect:

- `agentkit.config.json`
- `AGENTS.md`
- `STACK.md`
- companion guidance files
- AI tool adapters
- managed block markers in every AgentKit guidance file

Record:

- Files present
- Files missing for configured `templateSet`, `preset`, and `aiTools`
- Files with valid managed blocks
- Files without managed blocks
- Files with malformed managed blocks
- Companion references in `AGENTS.md`

### 3. Audit Checks

Check for:

- Missing `AGENTS.md`
- Missing files required by configured `templateSet`
- Missing `STACK.md` when `preset` is configured or stack is confidently inferred
- Missing AI adapters required by `aiTools`
- Invalid or unknown config values
- `installMode: template` when the user expects a skill-path workflow
- Malformed managed block markers
- Unmanaged existing guidance files that cannot be safely updated
- Bracket placeholders left in AgentKit-managed content
- Commands that do not match `package.json` scripts or explicit config/user personalization
- Stale project name, description, source layout, stack, design, testing, security, or workflow guidance
- `AGENTS.md` references to missing companion files
- AI adapters that duplicate operating rules instead of pointing to `AGENTS.md`
- Generic guidance that ignores obvious repository facts

### 4. Severity

Classify findings:

- `Critical`: Update/refresh is unsafe or blocked, such as malformed managed blocks, missing `AGENTS.md`, or destructive-risk instructions.
- `High`: Guidance is likely wrong in daily use, such as invalid commands, broken routing, missing required configured files, or adapter duplication.
- `Medium`: Guidance is incomplete or stale, such as outdated stack/design/test/workflow details or missing optional companions.
- `Low`: Polish issues, unclear assumptions, minor generic language, or non-blocking placeholders.

If there are no findings, report that AgentKit guidance looks healthy and mention any residual uncertainty.

### 5. Recommended Next Action

Recommend one primary next action:

- `/agentkit init` when configured guidance files are missing.
- `/agentkit update` when managed guidance exists but facts are stale.
- `/agentkit repair` when malformed managed blocks block safe updates.
- Manual config edit when `agentkit.config.json` values are wrong.
- No action when guidance is healthy.

Do not perform the recommended action unless the user asks.

### 6. Report Format

Use this concise format:

```md
## AgentKit Doctor

Status: Healthy | Needs attention | Blocked

Critical
- ...

High
- ...

Medium
- ...

Low
- ...

Recommended next action:
- ...

Checked:
- Config values used
- Stack and package manager inferred
- Commands inferred
- Files inspected
```

Omit empty severity sections.

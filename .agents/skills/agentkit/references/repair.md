# agentkit repair (skill workflow)

Repair AgentKit guidance structure after an explicit user request. This workflow fixes guidance-file safety problems that block `agentkit update`, especially malformed managed blocks, unmanaged-file conversion, broken adapters, stale companion references, and missing managed wrappers.

Repair is not a general rewrite workflow. Use `agentkit update` for stale content and `agentkit doctor` for read-only audits.

## Preconditions

- Read `references/file-contract.md` before repairing any file.
- Read `agentkit.config.json` when present.
- Inspect the affected guidance files before proposing repairs.
- Briefly tell the user which files need repair and what will change before editing.

## Non-negotiables

- Preserve user-written content.
- Modify only AgentKit guidance files and AI tool adapters.
- Do not modify application source files, lockfiles, package manifests, or CI config.
- Do not guess ownership when managed block markers are ambiguous.
- Do not regenerate whole files unless the user explicitly asks for that exact file.
- Keep `AGENTS.md` as the source of truth; adapters stay thin pointers.

## Procedure

### 1. Identify Repair Targets

Inspect:

- `AGENTS.md`
- `STACK.md`
- companion guidance files
- AI tool adapters
- managed block markers
- companion references in `AGENTS.md`

Classify each target:

- Malformed managed block markers
- Missing managed wrapper around AgentKit-owned content
- Unmanaged guidance file the user wants converted
- AI adapter that duplicates full guidance or points to the wrong source
- `AGENTS.md` references to missing companion files
- Configured guidance file missing a safe managed block

### 2. Plan The Repair

Before editing, report:

- Files to repair
- Repair type for each file
- Files deferred because ownership is ambiguous
- Any user confirmation needed

If ownership is ambiguous, defer the file and ask the user whether to convert, preserve, or leave it unmanaged.

### 3. Repair Managed Blocks

For malformed markers:

- Repair obvious one-start/one-end pairing issues only when the intended block boundaries are clear.
- Preserve all text outside the repaired block.
- Keep the same stable block id when clear.
- If there are multiple starts, multiple ends, overlapping blocks, or unclear ownership, defer instead of guessing.

For missing wrappers:

- Add one top-level AgentKit managed block around clearly AgentKit-owned generated content.
- Preserve pre-existing user notes outside the managed block when possible.
- Do not wrap unrelated project documentation.

### 4. Convert Unmanaged Files

Only convert an unmanaged file when the user explicitly asks.

When converting:

- Preserve existing user-written content outside the new managed block when possible.
- Add one AgentKit managed block for generated AgentKit guidance.
- Do not delete custom instructions.
- Do not convert application docs that are not part of AgentKit guidance.

### 5. Repair AI Adapters

For `.cursor/rules/agentkit.md`, `CLAUDE.md`, and `.github/copilot-instructions.md`:

- Replace thick duplicated guidance with a thin pointer to `AGENTS.md`.
- Wrap the adapter body in a managed block.
- Preserve any user-specific adapter notes outside the managed block when present.

### 6. Repair Companion References

For `AGENTS.md` companion references:

- Remove references to companion files that do not exist and are not being created.
- Add references to existing configured companions when useful.
- Reference `STACK.md` only when it exists or will be created.

### 7. Verify

Before finishing, check:

- Managed block markers are paired and stable.
- User-written content outside managed blocks was preserved.
- AI adapters point to `AGENTS.md` and do not duplicate full guidance.
- `AGENTS.md` references only companion files that exist.
- No application source files, lockfiles, package manifests, or CI files were modified.

Docs-only repair does not require running the project's test/build commands.

### 8. Report

Tell the user:

- Files repaired
- Files deferred and why
- Repairs performed
- Any follow-up recommendation, such as `/agentkit update` after structural repair

Keep the report concise.

---
name: agentkit
description: Use when creating, syncing, auditing, repairing, or learning AgentKit-managed repository guidance and codebase changes in an agent session, especially after `agentkit skill install`, when `/agentkit init`, `/agentkit update`, `/agentkit doctor`, `/agentkit repair`, `/agentkit learn`, or `/agentkit design` is requested, or when AGENTS.md, DESIGN.md, STACK.md, companion guides, managed blocks, commands, placeholders, AI tool adapters, recent diffs, or completed changes need context-aware maintenance or explanation.
compatibility: Requires agentkit CLI and agentkit.config.json with installMode skill, or existing AgentKit-managed files with block markers.
metadata:
  author: thomas-agentkit
  version: "1.0"
---

# AgentKit Skill

Create, sync, audit, repair, and teach AgentKit-managed repository guidance and codebase changes using live repository context.

## When to use

- User ran `agentkit skill install`
- User asks `/agentkit init`, `/agentkit update`, `/agentkit doctor`, `/agentkit repair`, `/agentkit learn`, or `/agentkit design`
- `AGENTS.md`, `DESIGN.md`, `STACK.md`, companion guides, or AI adapters are missing
- Guidance has stale commands, stack details, project paths, placeholders, or broken references
- Managed blocks need context-aware update, audit, or repair
- User wants to understand recent codebase changes, a completed implementation, a diff, a bug fix, or the session
- User wants to create or refresh `DESIGN.md` from a design baseline

## When not to use

- User wants terminal template install -> direct them to CLI `agentkit init`
- User wants terminal template update -> direct them to CLI `agentkit update` unless config says `installMode: skill`
- Generic documentation requests unrelated to AgentKit guidance
- Code review findings, debugging, or feature implementation requests
- Short summaries that do not require a guided teaching workflow

## Route

Always read `references/file-contract.md` before editing or auditing AgentKit-managed files. Do not act from `SKILL.md` alone.

1. User asks to **initialize** missing guidance files from repo context
   → `references/init.md`

2. User asks to **update** or **sync** existing guidance with current repo context
   → `references/update.md`

3. User asks to **doctor**, **audit**, **review**, **diagnose**, or **health check** guidance quality
   → `references/doctor.md`

4. User asks to **repair**, **fix malformed blocks**, **convert unmanaged guidance**, or **fix adapters**
   → `references/repair.md`

5. User asks to **learn**, **understand recent changes**, **explain the session**, **teach me what changed**, **ELI5**, **ELI14**, **explain like an intern**, or **check my understanding**
   → `references/learn.md`

6. User asks to **design**, set up **DESIGN.md**, choose a design baseline, or customize design language
   → `references/design.md`

7. Unsure which workflow applies
   → If no guidance files exist: `references/init.md`
   → If guidance exists but commands, stack, files, placeholders, adapters, or references are stale: `references/update.md`
   → If user wants audit, doctor, health check, diagnosis, or review: `references/doctor.md`
   → If managed blocks are malformed or unmanaged files need conversion: `references/repair.md`
   → If user wants to understand completed changes or a session: `references/learn.md`
   → If user wants `DESIGN.md` or design baseline selection: `references/design.md`

## Non-negotiables

- `AGENTS.md` is the source of truth; AI tool adapters stay thin pointers
- Read the route reference and `references/file-contract.md` before file edits
- Preserve user content **outside** AgentKit managed blocks
- Skip unmanaged existing files unless conversion is explicitly requested
- Defer malformed managed blocks to `references/repair.md`
- Commands in guidance must come from `package.json` scripts or `agentkit.config.json` personalization — never invent scripts
- Prefer repo facts over config personalization
- Do not modify app source, lockfiles, package manifests, or CI config during AgentKit workflows
- `/agentkit learn` is read-only by default and keeps learning checklists in the conversation unless the user explicitly asks for notes
- CLI `agentkit init` installs **templates**; this skill's `agentkit init` **creates guidance files** — never confuse them

## Gotchas

| Gotcha | Reality |
| --- | --- |
| `installMode: skill` but no `.md` files yet | Expected after `agentkit skill install`; run `/agentkit init` |
| `templateSet: minimal` | `AGENTS.md` only, plus selected adapters if explicitly configured |
| `templateSet: standard` | Core companions only; not testing/security/workflow docs |
| `templateSet: full` | Full guidance docs; adapters still follow `aiTools` |
| AI tool adapters | Thin pointers to `AGENTS.md`; never duplicate full guidance |
| `STACK.md` | Create/update when preset is configured, user asks, or stack is confidently inferred |
| `DESIGN.md` | Comes from bundled baseline in `designSystem` config or `/agentkit design`; map tokens to project theme |
| Existing unmanaged files | Skip unless user asks to convert |
| Malformed managed blocks | Use `/agentkit repair` before update/refresh |
| Learning workflow | `/agentkit learn` is read-only by default and should not create Markdown notes unless the user explicitly asks |
| Docs-only guidance workflow | Does not require running project tests/builds |

## Quick reference

| User says | Load |
| --- | --- |
| "/agentkit init" / "set up AGENTS.md" | `references/init.md` |
| "/agentkit update" / "sync guidance" | `references/update.md` |
| "/agentkit doctor" / "audit AgentKit guidance" | `references/doctor.md` |
| "/agentkit repair" / "fix managed blocks" | `references/repair.md` |
| "/agentkit learn" / "teach me what changed" | `references/learn.md` |
| "/agentkit design" / "create DESIGN.md" | `references/design.md` |
| Before any file edit | `references/file-contract.md` |

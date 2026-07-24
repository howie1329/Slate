# Plan 017: Align agent guidance with the implemented AI workflow

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `docs/plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b5dbb37..HEAD -- AGENTS.md docs/plans/README.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `b5dbb37`, 2026-07-23

## Why this matters

`AGENTS.md` is Slate's repository guidance source of truth for humans and coding agents. Its opening product summary says Plan My Day is still unimplemented, while the product brief and actual code describe an implemented, reviewable vertical slice whose broad release awaits final packaged/manual acceptance. This mismatch can cause future changes to duplicate, disable, or plan around functionality that already exists. Correct the wording without claiming broader shipment than the product brief authorizes.

## Current state

- `AGENTS.md` is the guidance source of truth; its AgentKit-managed block must be preserved.
- `docs/product-brief.md` describes the accepted product status and vocabulary.

`AGENTS.md:4` currently says:

```markdown
... a reviewable AI Assist vertical slice through the packaged Node sidecar. Plan My Day remains planned 1.0 work and is not currently shipped.
```

`docs/product-brief.md:30-36` gives the correct distinction:

```markdown
- Final packaged/manual acceptance of the Plan My Day provider and atomic review flow.
...
AI Assist and the Plan My Day vertical slices are implemented on the current branch as reviewable Keychain-backed sidecar flows. Final packaged/manual acceptance remains before calling Plan My Day broadly shipped.
```

Use Slate's existing terms: "reviewable vertical slice," "Keychain-backed sidecar," and "final packaged/manual acceptance." Do not alter product scope, native behavior, or the AgentKit delimiters.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Verify the corrected status | `rg -n "Plan My Day|vertical slice|packaged/manual acceptance" AGENTS.md` | describes an implemented vertical slice and pending broad-release acceptance |
| Verify stale wording is gone | `rg -n "Plan My Day remains planned|not currently shipped" AGENTS.md` | no matches (exit 1 is expected) |
| Check documentation diff | `git diff --check` | no output and exit 0 |

No build or test command is required because this plan changes only repository guidance.

## Scope

**In scope**:

- `AGENTS.md` — opening product-status paragraph only
- `docs/plans/README.md` — status row only

**Out of scope**:

- Any source code, package manifest, or generated router output.
- `docs/product-brief.md`, `README.md`, `docs/roadmap.md`, and `docs/ai-actions-brief.md`; they already contain the correct status.
- Any content outside the `<!-- agentkit:start agents -->` and `<!-- agentkit:end agents -->` block in `AGENTS.md`.

## Git workflow

- Branch: `codex/017-align-agent-guidance-ai-status`
- Use one focused documentation commit. Match the repository's imperative commit style, for example: `Clarify Plan My Day fixed commitments and atomic backlog assignments`.
- Do not push or open a pull request unless the operator asks.

## Steps

### Step 1: Correct the opening product-status sentence

In the first paragraph of the AgentKit-managed block in `AGENTS.md`, state that Slate has reviewable AI Assist **and Plan My Day** vertical slices through the packaged Node sidecar. Follow it with the precise limitation: final packaged/manual acceptance remains before Plan My Day is broadly shipped.

Keep the rest of the existing product summary intact. Do not say the feature is fully shipped, and do not say it remains planned/unimplemented.

**Verify**: `rg -n "AI Assist|Plan My Day|packaged/manual acceptance" AGENTS.md` → the opening paragraph includes all three concepts.

### Step 2: Check for contradictory guidance and update plan status

Search the guidance file for the retired wording, inspect the diff for changes outside the intended sentence, then change only plan 017's status in `docs/plans/README.md` to `DONE`.

**Verify**: run `rg -n "Plan My Day remains planned|not currently shipped" AGENTS.md` (no matches; exit 1 expected), then run `git diff --check` (no output).

## Test plan

- This is documentation-only. The two `rg` checks are the regression checks: one confirms the intended release status, and the other confirms the stale claim is absent.
- Do not run a full application build solely for this wording change.

## Done criteria

- [ ] `AGENTS.md` identifies both AI Assist and Plan My Day as implemented reviewable vertical slices.
- [ ] `AGENTS.md` retains the final packaged/manual acceptance caveat before broad Plan My Day shipment.
- [ ] The obsolete "planned" and "not currently shipped" wording is absent from `AGENTS.md`.
- [ ] AgentKit start/end markers remain unchanged.
- [ ] `git diff --check` produces no output.
- [ ] No files outside the in-scope list are modified.
- [ ] Plan 017 is marked `DONE` in `docs/plans/README.md`.

## STOP conditions

Stop and report instead of improvising if:

- The product brief has changed to say Plan My Day is unimplemented or broadly shipped.
- The correction would require editing text outside the AgentKit-managed block.
- Another source-of-truth document conflicts with the product brief about release status.

## Maintenance notes

- Keep `AGENTS.md`, the product brief, README, roadmap, and AI actions brief aligned whenever an AI vertical slice moves between implemented, acceptance, and broadly shipped states.
- Reviewers should ensure the wording distinguishes implemented functionality from broad-release acceptance; that distinction preserves the current product contract.

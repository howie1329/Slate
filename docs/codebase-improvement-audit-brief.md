# Codebase improvement audit brief

> **Status:** Read-only audit findings
>
> **Audited at:** Commit `08cf11d`, 2026-07-21
>
> **Scope:** Correctness, security boundaries, verification, native persistence, dependencies, and near-term product direction

## Purpose

This brief records the findings from the broad Improve skill audit of Slate. It is advisory only: no source changes or implementation plans were produced as part of the audit.

Findings are ordered by leverage, considering user impact, implementation effort, confidence, and change risk.

## Prioritized findings

### 1. Add Remove date / Return to Backlog

- **Category:** Correctness
- **Evidence:** `src/components/task-detail-panel.tsx:227`; `docs/product-brief.md:61-72`
- **Impact:** A dated task can be moved to another date but cannot be returned to the unscheduled Backlog. This blocks a core recovery action after a commitment changes.
- **Effort:** Small
- **Change risk:** Low
- **Confidence:** High

### 2. Preserve dirty Settings drafts during planner refreshes

- **Category:** Correctness
- **Evidence:** `src/routes/settings.tsx:37-41`; `src/lib/planner-query.tsx:135-141`
- **Impact:** Saving an API key invalidates the planner snapshot and can erase unsaved capacity, provider, model, or planning-instruction edits.
- **Effort:** Small
- **Change risk:** Medium
- **Confidence:** High

### 3. Establish one renderer-plus-native verification command

- **Category:** Test coverage / developer experience
- **Evidence:** `package.json:6-12`; `.github/pull_request_template.md:6-10`; `AGENTS.md:35-43`
- **Impact:** `npm run build` does not run Rust tests, and no CI workflow enforces both halves of the application. Native regressions depend on contributors remembering an additional command.
- **Effort:** Small
- **Change risk:** Low
- **Confidence:** High

### 4. Refuse databases created by newer schema versions

- **Category:** Correctness / migrations
- **Evidence:** `src-tauri/src/persistence.rs:519-532`
- **Impact:** An older Slate binary currently accepts any future `user_version` and may write using outdated schema assumptions.
- **Effort:** Small
- **Change risk:** Low
- **Confidence:** High

### 5. Characterize renderer planning rules

- **Category:** Test coverage
- **Evidence:** `src/lib/task-groups.ts:18-81`; `src/routes/today.tsx:26-42`; `package.json:32-41`
- **Impact:** Today/Backlog classification, persisted ordering, and overflow calculations define the product but have no automated coverage. TypeScript compilation cannot detect behavioral regressions in these rules.
- **Effort:** Medium
- **Change risk:** Low
- **Confidence:** High

### 6. Stop retaining API keys in renderer mutation state

- **Category:** Security boundary
- **Evidence:** `src/routes/settings.tsx:34-35`; `src/lib/planner-query.tsx:135-140`; `docs/roadmap.md:83`
- **Impact:** API credentials remain in React state and TanStack Query mutation variables after submission, increasing their lifetime in the webview and conflicting with the documented native credential boundary.
- **Effort:** Medium
- **Change risk:** Medium
- **Confidence:** High

### 7. Separate committed mutations from notification failures

- **Category:** Correctness / architecture
- **Evidence:** `src-tauri/src/persistence.rs:411-516`; `src-tauri/src/credentials.rs:40-53`
- **Impact:** SQLite or Keychain can change successfully and then the command can report failure because `planner://changed` delivery failed. Retrying a create after that response can duplicate a task.
- **Effort:** Medium
- **Change risk:** Medium
- **Confidence:** High

### 8. Cover native mutation and migration paths

- **Category:** Test coverage
- **Evidence:** `src-tauri/src/persistence.rs:213-336`; `src-tauri/src/persistence.rs:654-843`
- **Impact:** Updates, rescheduling, settings persistence, migration compatibility, and several atomicity paths remain outside the five native tests.
- **Effort:** Medium
- **Change risk:** Low
- **Confidence:** High

### 9. Define cross-window task-edit conflict behavior

- **Category:** Correctness / state management
- **Evidence:** `src/components/task-detail-panel.tsx:65-81`; `src/lib/planner-query.tsx:58-81`
- **Impact:** When the selected task changes in Slate's other window, a planner refresh silently replaces the current dirty edit draft.
- **Effort:** Medium
- **Change risk:** Medium
- **Confidence:** High

### 10. Distinguish Keychain failures from missing credentials

- **Category:** Correctness / error handling
- **Evidence:** `src-tauri/src/credentials.rs:22-30`; `src-tauri/src/persistence.rs:118-134`
- **Impact:** Locked, denied, or temporarily unavailable Keychain access is presented as an unconfigured provider, which directs the user toward the wrong recovery action.
- **Effort:** Small to medium
- **Change risk:** Low
- **Confidence:** High

## Product-direction observations

### Finish the deterministic daily loop before expanding scope

Return-to-Backlog and ordering remain inside the documented Stage 1 contract. The native reorder boundary exists, but the renderer interaction is unfinished. Keyboard-operable ordering should accompany any drag interaction.

### Execute the existing AI plan rather than duplicating it

`docs/plans/006-ai-assist-plan-my-day-review-tray.md` already specifies the appropriate AI review flow and native transaction hardening. Its plan-acceptance work must enforce eligibility, capacity, freshness, date/scope consistency, and append-only ordering before AI ships.

### Defer Stage 2 resilience features until the 1.0 exit criteria pass

End-of-day review and My Day Changed are grounded roadmap work, but they should not compete with unfinished core behavior, verification, and packaged-build readiness.

## Recommended sequencing

1. Establish the aggregate verification command.
2. Add renderer rule tests and native mutation/migration coverage.
3. Implement Return to Backlog and dirty Settings preservation.
4. Add the newer-schema guard.
5. Tighten credential, event, and cross-window boundaries before shipping AI.

## Validation performed

- TypeScript checking passed.
- All five Rust tests passed.
- `npm audit --omit=dev` reported no high or critical advisories.
- The three moderate advisories were in the unused `shadcn` CLI dependency chain and did not justify a forced breaking downgrade.

## Not audited interactively

- Packaged `.app` behavior.
- Manual testing at the 360 x 520 minimum popover size.
- Simulated Keychain denial or outage behavior.
- Live cross-window conflict scenarios.
- Cargo advisory scanning; `cargo-audit` was not installed.


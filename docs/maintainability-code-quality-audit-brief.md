# Maintainability and code-quality audit brief

> **Status:** Read-only audit findings
>
> **Audited at:** Commit `08cf11d`, 2026-07-21
>
> **Scope:** First-party renderer and native structure, duplication, dead code, testability, tooling, dependencies, and release hygiene

## Purpose

This brief records the maintainability and code-quality cleanup findings for Slate. It does not prescribe a large architectural rewrite. The recommended changes preserve the current explicit React/Tauri/SQLite design and favor small, cohesive improvements.

No source changes or implementation plans were produced during the audit.

## Prioritized findings

### 1. Establish one code-quality gate

- **Category:** Developer experience / testability
- **Evidence:** `package.json:6-12`; `src-tauri/src/lib.rs:24-25`; `.github/pull_request_template.md:6-10`
- **Impact:** There is no renderer test or lint command and no CI workflow. Clippy currently fails on two needless borrows even though ordinary validation does not report them.
- **Effort:** Medium
- **Change risk:** Low
- **Confidence:** High
- **Recommended boundary:** One aggregate check covering renderer type-checking, targeted tests and linting, plus native formatting, Clippy, and tests.

### 2. Remove abandoned scaffolding

- **Category:** Dead code
- **Evidence:** `src/mock-data/types.ts:1-27`; `src/mock-data/tasks.ts:3-129`; `src/components/ui/field.tsx:1-236`; `src/components/ui/label.tsx:1-18`; `src/components/ui/separator.tsx:1-23`; `index.html:5`
- **Impact:** Unused mock data has drifted from the live planner model, and unused UI modules and starter assets add roughly 450 lines of misleading search and review surface.
- **Effort:** Small
- **Change risk:** Low
- **Confidence:** High
- **Recommended boundary:** Delete unused scaffolding rather than preserving speculative primitives. Add future fixtures beside a real test or story.

### 3. Centralize task-view selectors outside route markup

- **Category:** Domain ownership
- **Evidence:** `src/routes/today.tsx:26-41`; `src/routes/backlog.tsx:67-79`; `src/routes/__root.tsx:187-191`; `src/routes/__root.tsx:236-240`
- **Impact:** Today membership, Backlog membership/counts, ordering, and capacity are recomputed independently across the routes and shell. A rule change can make a header disagree with the list it summarizes.
- **Effort:** Medium
- **Change risk:** Medium
- **Confidence:** High
- **Recommended boundary:** Add narrowly named pure selectors beside `scopeForTask`; keep presentation ownership in the routes and avoid a broad planner service.

### 4. Extract one planner-specific task row

- **Category:** Duplication
- **Evidence:** `src/routes/today.tsx:83-117`; `src/routes/backlog.tsx:121-153`
- **Impact:** Approximately 65 lines of checkbox, selection, accessibility, styling, estimate, and completion behavior must be edited in parallel.
- **Effort:** Small
- **Change risk:** Medium
- **Confidence:** High
- **Recommended boundary:** Extract a focused `TaskRow` with explicit selection, pending, and optional overflow props. Keep list grouping in each route.

### 5. Give Settings a granular update boundary

- **Category:** State ownership
- **Evidence:** `src/routes/settings.tsx:34-59`; `src/components/theme-provider.tsx:23-29`; `src/lib/planner-query.tsx:127-129`
- **Impact:** Settings and theme submit full settings snapshots from separate owners. New settings surfaces compound stale-write, dirty-draft, and merge behavior.
- **Effort:** Medium
- **Change risk:** Medium
- **Confidence:** High
- **Recommended boundary:** Use an explicit patch-shaped command or a single settings controller; keep credential writes separate.

### 6. Add native characterization tests before restructuring persistence

- **Category:** Testability
- **Evidence:** `src-tauri/src/persistence.rs:213-336`; `src-tauri/src/persistence.rs:654-843`
- **Impact:** A cleanup split or error-model change could alter validation, trimming, transactions, or persistence behavior while all current tests continue to pass.
- **Effort:** Medium
- **Change risk:** Low
- **Confidence:** High
- **Recommended boundary:** Cover each mutation's success, validation, missing-record, reopen-persistence, and atomicity behavior using the existing disposable SQLite fixture pattern.

### 7. Split persistence along its existing cohesive boundaries

- **Category:** Native architecture
- **Evidence:** `src-tauri/src/persistence.rs:20`; `src-tauri/src/persistence.rs:62`; `src-tauri/src/persistence.rs:348`; `src-tauri/src/persistence.rs:411`; `src-tauri/src/persistence.rs:654`
- **Impact:** One 843-line module owns migrations, serialized models, repository operations, Tauri commands, event broadcasting, and tests. Planned AI transaction validation will increase its review surface further.
- **Effort:** Medium
- **Change risk:** Medium
- **Confidence:** High
- **Recommended boundary:** After characterization tests, separate migration/schema code, repository/domain operations, and the Tauri command/state adapter. Keep one concrete SQLite repository; do not add traits or service layers.

### 8. Replace string-only native errors with stable categories

- **Category:** Error modeling
- **Evidence:** `src-tauri/src/persistence.rs:99`; `src-tauri/src/persistence.rs:194`; `src-tauri/src/persistence.rs:565`; `src-tauri/src/persistence.rs:646`; `src-tauri/src/credentials.rs:16`
- **Impact:** Validation, not-found, SQLite, locking, Keychain, and event failures share an unstructured `String` channel. Renderer recovery logic cannot branch reliably without interpreting presentation copy.
- **Effort:** Medium
- **Change risk:** Medium
- **Confidence:** High
- **Recommended boundary:** Return a small serializable code/category plus safe message at IPC boundaries. Preserve detailed internal errors without exposing secrets.

### 9. Centralize native AI-provider values

- **Category:** Domain modeling
- **Evidence:** `src-tauri/src/credentials.rs:9-13`; `src-tauri/src/persistence.rs:388-394`; `src-tauri/src/persistence.rs:613-625`
- **Impact:** Provider values and validation are repeated across native modules, so additions or renames require coordinated string edits and invalid provider states remain representable.
- **Effort:** Small
- **Change risk:** Low
- **Confidence:** High
- **Recommended boundary:** Use one serde-backed `AiProvider` enum while preserving the current serialized values.

### 10. Correct the TypeScript validation path

- **Category:** Tooling
- **Evidence:** `package.json:9`; `tsconfig.json`; `tsconfig.node.json:1-9`; `vite.config.ts:6-7`
- **Impact:** The build bundles before checking TypeScript, does not validate the Vite configuration project, and hides its missing Node typing with `@ts-expect-error`.
- **Effort:** Small
- **Change risk:** Low
- **Confidence:** High
- **Recommended boundary:** Add an explicit type-check command for both TypeScript projects, remove the suppression, and run type-checking before bundling.

### 11. Prune and correctly classify direct dependencies

- **Category:** Dependency hygiene
- **Evidence:** `package.json:22`; `package.json:29`; `agentkit.config.json:1-8`
- **Impact:** `date-fns` has no source consumer. `thomas-agentkit` is repository tooling but is classified as a production dependency, obscuring the shipped runtime dependency set.
- **Effort:** Small
- **Change risk:** Low
- **Confidence:** High

### 12. Make release metadata consistent and remove starter identity

- **Category:** Release hygiene
- **Evidence:** `package.json:4`; `src-tauri/Cargo.toml:3-5`; `src-tauri/tauri.conf.json:3-5`; `src/routes/settings.tsx:6`; `index.html:5-7`
- **Impact:** Releases require three synchronized version edits, while Settings reads only one manifest. The browser title, favicon, and Rust author metadata still contain starter values.
- **Effort:** Small
- **Change risk:** Low
- **Confidence:** High

## Recommended sequencing

1. Establish the quality gate and native/renderer characterization coverage.
2. Remove abandoned scaffolding and dependency residue.
3. Centralize selectors and extract the shared task row.
4. Correct Settings ownership and mutation-error behavior.
5. Restructure persistence and introduce typed native boundaries.
6. Finish TypeScript validation and release-metadata hygiene.

## Explicit non-recommendations

- Do not introduce a generic planner service or repository trait solely for cleanup.
- Do not split cohesive components such as `TaskDetailPanel` based only on line count.
- Do not remove AI, reorder, or plan-application hooks indiscriminately; reconcile them with the near-term implementation plans first.
- Do not add broad dependency migrations without a product or security reason.

## Validation performed

- TypeScript checking passed.
- `cargo fmt --check` passed.
- Clippy failed only on two confirmed `needless_borrow` findings in `src-tauri/src/lib.rs:24-25`.
- Repository-wide import searches confirmed the cited mock data, UI scaffolding, starter assets, and dependencies have no current application consumers.

## Not audited interactively

- Visual behavior or accessibility in a running desktop build.
- Packaged application metadata after signing/bundling.
- Cleanup effects on future unimplemented AI and ordering work.

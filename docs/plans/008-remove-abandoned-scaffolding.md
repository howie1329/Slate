# Remove abandoned scaffolding

**Status:** Proposed.

## Objective

Remove unused mock planner data, speculative UI primitives, and starter assets so repository searches and reviews reflect Slate's shipped architecture. Preserve the current React/Tauri/SQLite behavior and defer future fixtures or primitives until a real test, story, or product surface needs them.

This plan implements finding 2, **Remove abandoned scaffolding**, from [the maintainability and code-quality audit](../maintainability-code-quality-audit-brief.md).

## Current evidence

Repository-wide import and asset searches show no application consumers for:

- `src/mock-data/index.ts`
- `src/mock-data/settings.ts`
- `src/mock-data/tasks.ts`
- `src/mock-data/types.ts`
- `src/components/ui/field.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/separator.tsx`
- `src/assets/react.svg`
- `public/tauri.svg`
- `public/vite.svg`, except for the starter favicon reference in `index.html`

The mock task and settings types have already drifted from the live planner contract in `src/lib/planner.ts`. The three UI modules only reference one another and do not participate in a shipped form or layout.

## Scope

Included:

- Delete the complete unused `src/mock-data/` directory.
- Delete the unused `Field`, `Label`, and `Separator` UI modules as one dependency cluster.
- Delete the unused React, Tauri, and Vite starter SVGs.
- Remove the `/vite.svg` favicon link from `index.html` so the build does not reference a deleted asset.
- Confirm no source, documentation, or generated route file requires a follow-up edit.

Not included:

- Replacing the favicon, browser title, Rust author metadata, or synchronizing release versions; those belong to audit finding 12.
- Removing or reclassifying npm dependencies; that belongs to audit finding 11.
- Adding fixtures, stories, a generic form system, or replacement UI primitives speculatively.
- Changing routes, planner behavior, SQLite data, Tauri permissions, or generated router output.

## Implementation

### 1. Start from a fresh branch

Before editing source:

1. Run `git status --short --branch` and require a clean working tree. If unrelated work is present, stop and preserve it; do not stash, discard, or fold it into this cleanup.
2. Run `git fetch origin` so the branch starts from the current remote base.
3. Create a new, unused branch directly from `origin/main`, for example `git switch -c chore/remove-abandoned-scaffolding origin/main`.
4. Confirm `git merge-base --is-ancestor origin/main HEAD` and inspect `git log --oneline origin/main..HEAD`; the new branch should contain no pre-existing feature commits before cleanup begins.

Do not reuse an older cleanup branch. If the example branch name already exists locally or remotely, choose a new descriptive suffix rather than resetting or overwriting it.

### 2. Reconfirm that every target is unused

Search imports, aliases, dynamic references, HTML paths, CSS URLs, documentation, and generated inputs for the target modules and assets. Treat similarly named local symbols such as `EditingField` or `SelectSeparator` as unrelated unless they import one of the target files.

If a real consumer has appeared since the audit, remove that target from this cleanup and document the reason instead of expanding the change into a refactor.

### 3. Delete the dead mock-data boundary

Delete all four files under `src/mock-data/` and remove the empty directory. Do not migrate their stale `Task`, `Settings`, or provider types elsewhere; the live types and native planner snapshot remain authoritative.

Future fixtures should be created beside the concrete test or story that consumes them and should use the live domain types.

### 4. Delete the unused UI dependency cluster

Delete `field.tsx`, `label.tsx`, and `separator.tsx` together. `field.tsx` is their only current consumer, so retaining the smaller primitives would preserve speculative surface without application value.

Do not alter active UI modules such as `input.tsx`, `select.tsx`, or their locally defined separator components.

### 5. Remove starter assets and their reference

Delete `src/assets/react.svg`, `public/tauri.svg`, and `public/vite.svg`. Remove only the Vite favicon `<link>` from `index.html`.

Keep the existing page title unchanged in this cleanup. A Slate-branded favicon and remaining starter identity should be handled together under audit finding 12 rather than partially designed here.

### 6. Review the resulting diff

Confirm the diff consists only of the planned deletions and the single favicon-reference removal. Verify that `src/routeTree.gen.ts`, native code, permissions, lockfiles, and application behavior are untouched.

## Validation

Run:

1. `rg -n "mock-data|components/ui/(field|label|separator)|vite\\.svg|tauri\\.svg|react\\.svg" src public index.html` and confirm there are no remaining live references.
2. `npm run build` to run the repository's current web build and TypeScript validation.
3. `git diff --check` to catch whitespace errors.
4. `git status --short` and `git diff --stat` to confirm the change contains only the intended cleanup.

No native test or manual desktop pass is required unless the final diff expands beyond these renderer-only deletions. If the cleanup reveals an unexpected runtime consumer, stop and revise the plan before proceeding.

## Acceptance criteria

- The implementation is performed on a new branch created from current `origin/main`.
- `src/mock-data/` no longer exists.
- The unused `field.tsx`, `label.tsx`, and `separator.tsx` modules no longer exist.
- The React, Tauri, and Vite starter SVGs no longer exist.
- `index.html` no longer references `/vite.svg`.
- No live source or asset reference points to a deleted file.
- Planner behavior, routes, SQLite persistence, Keychain handling, Tauri permissions, and compact-window UI are unchanged.
- `src/routeTree.gen.ts` and dependency manifests are unchanged.
- `npm run build` and `git diff --check` pass.

## Deferred work

- Add test fixtures only when the repository has a concrete test that consumes them.
- Add UI primitives only when a shipped component establishes their reuse boundary.
- Complete dependency pruning under audit finding 11.
- Replace starter identity and unify release metadata under audit finding 12.

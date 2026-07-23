# Plan 015: Make sidecar bootstrap reproducible

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `docs/plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b5dbb37..HEAD -- README.md sidecar/scripts/ensure-binary.mjs docs/plans/README.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `b5dbb37`, 2026-07-23

## Why this matters

Slate's documented development path is currently not sufficient for a clean checkout after the packaged AI sidecar was added. Root `npm install` does not install the independent `sidecar/` package, and `npm run dev:desktop` only verifies that its binary already exists. A new contributor therefore gets an avoidable failure before the desktop app can start. This plan makes the required bootstrap explicit and makes the failure message actionable without converting the repository into a monorepo or changing the production packaging model.

## Current state

- `README.md` is the project onboarding and release-command reference.
- `package.json` owns root developer commands; it intentionally delegates sidecar work with `npm --prefix sidecar`.
- `sidecar/package.json` is a separately locked npm package and supplies the `pkg` binary used to create the Tauri external binary.
- `sidecar/scripts/ensure-binary.mjs` checks the binary and source timestamps before desktop development begins.

`README.md:34-41` currently presents this incomplete path:

```bash
npm install
npm run dev:desktop
```

`package.json:6-11` then runs a verification, not an install/build:

```json
"dev:desktop": "npm run ensure:sidecar && tauri dev",
"build:sidecar": "npm --prefix sidecar run build",
"ensure:sidecar": "npm --prefix sidecar run ensure"
```

`sidecar/package.json:5-22` shows that the sidecar has independent dependencies, including the local `pkg` executable:

```json
"build": "npm run clean && npm run build:js && npm run package:binary",
"devDependencies": {
  "@yao-pkg/pkg": "6.21.0",
  "esbuild": "0.28.1"
}
```

The repository uses npm and committed lockfiles. Per `AGENTS.md`, use `npm`, preserve the compact desktop workflow, and do not introduce broad new dependencies or tooling abstractions.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install root dependencies | `npm ci` | exits 0 |
| Install sidecar dependencies | `npm --prefix sidecar ci` | exits 0 |
| Build sidecar binary | `npm run build:sidecar` | prints `Built .../src-tauri/binaries/slate-ai-sidecar-<target>` and exits 0 |
| Check sidecar freshness | `npm run ensure:sidecar` | prints `Using existing ...` and exits 0 |
| Sidecar tests | `npm --prefix sidecar test` | all tests pass |
| Root type/build check | `npm run build` | exits 0 after Vite and TypeScript complete |

`npm run dev:desktop` launches the macOS app and remains running; use it only for the manual smoke check, then stop it normally.

## Scope

**In scope**:

- `README.md`
- `sidecar/scripts/ensure-binary.mjs`
- `docs/plans/README.md` — status row only

**Out of scope**:

- `package.json`, `package-lock.json`, and npm workspaces. Do not restructure dependency ownership for this documentation/diagnostic fix.
- `sidecar/package-lock.json` and all dependency versions.
- Tauri bundle configuration and sidecar protocol behavior.

## Git workflow

- Branch: `codex/015-reproducible-sidecar-bootstrap`
- Use one focused commit after all validations pass. Match the repository's imperative commit style, for example: `Use persistent macOS Keychain storage for API keys`.
- Do not push or open a pull request unless the operator asks.

## Steps

### Step 1: Document the complete clean-checkout bootstrap

In `README.md`, replace the two-command Development snippet with the complete order:

```bash
npm install
npm --prefix sidecar ci
npm run build:sidecar
npm run dev:desktop
```

Keep the existing explanation that `npm run dev:desktop` starts Vite and the tray app. Add one concise sentence explaining that the sidecar is an independently locked package and must be installed and built once before desktop development; `npm run ensure:sidecar` will subsequently reject a stale or missing binary.

In the Validation and release builds section, put `npm --prefix sidecar ci` before the sidecar test/build commands or add a short prerequisite sentence immediately above the block. Do not imply that root `npm install` installs sidecar dependencies.

**Verify**: `rg -n "npm --prefix sidecar ci|npm run build:sidecar|npm run dev:desktop" README.md` → shows the clean-bootstrap sequence and the existing desktop command.

### Step 2: Make the stale-binary error self-contained

In `sidecar/scripts/ensure-binary.mjs`, retain the current timestamp check and no-write behavior. Change only the catch-path error text so a missing or stale binary tells the developer to run the exact two prerequisites in order: install the sidecar package with `npm --prefix sidecar ci`, then run `npm run build:sidecar`.

Do not make `ensure` install packages or build a binary automatically. It is intentionally a fast guard for `dev:desktop`, and implicit installs/downloads would make startup slow and surprising.

**Verify**: `npm run ensure:sidecar` → after a successful build, prints `Using existing ...` and exits 0.

### Step 3: Validate the documented path and update plan status

From a dependency state that includes both root and sidecar packages, run the exact build/test gates below. Then change only plan 015's status in `docs/plans/README.md` to `DONE`.

**Verify**: run `npm --prefix sidecar test`, `npm run build:sidecar`, `npm run ensure:sidecar`, and `npm run build` in that order → each exits 0; the sidecar build prints a `Built` path and `ensure` prints `Using existing`.

## Test plan

- No application behavior changes require a new automated test file.
- Confirm the error text manually by temporarily moving only the ignored generated sidecar binary aside, running `npm run ensure:sidecar`, checking that it names both commands, and restoring the exact binary immediately. Do not delete source files or any tracked file.
- Run `npm --prefix sidecar test` and `npm run build` to protect the existing sidecar and renderer paths.

## Done criteria

- [ ] `README.md` gives a clean-checkout sequence that installs and builds the sidecar before `npm run dev:desktop`.
- [ ] `sidecar/scripts/ensure-binary.mjs` names both required commands when the binary is absent or stale.
- [ ] `npm --prefix sidecar test` passes.
- [ ] `npm run build:sidecar` and `npm run ensure:sidecar` exit 0 after the documented bootstrap.
- [ ] `npm run build` exits 0.
- [ ] No files outside the in-scope list are modified.
- [ ] Plan 015 is marked `DONE` in `docs/plans/README.md`.

## STOP conditions

Stop and report instead of improvising if:

- `sidecar/` is already managed as an npm workspace in the live repository; this plan's documentation-only approach would then be wrong.
- The sidecar requires a platform-specific setup command beyond `npm --prefix sidecar ci` and `npm run build:sidecar`.
- Building the sidecar cannot complete without adding or changing a dependency version.
- The documentation change would require modifying root lockfiles or Tauri configuration.

## Maintenance notes

- Any future sidecar dependency, target, or packaging change must update both the clean-bootstrap instructions and the guard's recovery text together.
- Reviewers should ensure `ensure` remains a check only; it must not silently install packages, download a runtime, or overwrite binaries during normal `dev:desktop` startup.
- A future npm-workspace migration is intentionally deferred because it changes lockfile ownership and package installation behavior beyond this bug fix.

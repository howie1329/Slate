# Implementation plan: AI sidecar packaging spike

## Objective

Prove that Slate can build, bundle, launch, communicate with, terminate, and verify a self-contained Node.js sidecar before AI Assist or Plan My Day implementation begins.

The spike must test the real packaging shape Slate intends to ship: a separate Node package containing the selected AI SDK, Zod, and both provider adapters, compiled into a target-specific executable and embedded in the Tauri macOS application. A trivial executable-only proof is insufficient if the actual AI dependencies cannot load from the packaged binary.

This plan is the first implementation slice of [007-ai-sdk-node-sidecar.md](007-ai-sdk-node-sidecar.md). It does not replace that plan or the product behavior and persistence requirements in [006-ai-assist-plan-my-day-review-tray.md](006-ai-assist-plan-my-day-review-tray.md).

## Decision and success condition

Use a short-lived sidecar process for one request and one response. Rust launches the process and communicates through newline-delimited JSON over stdin and stdout. The React renderer does not receive shell access and does not know the sidecar path or process details.

The spike succeeds only when all of the following are demonstrated:

1. The sidecar builds reproducibly from its own locked Node package.
2. Tauri launches it in development through native Rust code.
3. Rust writes one request to stdin and receives one valid response from stdout.
4. The packaged macOS `.app` contains and launches the executable.
5. The packaged executable can load the selected AI SDK, Zod, Vercel Gateway support, and OpenRouter provider without a live network request.
6. Timeout, crash, malformed output, oversized output, and non-zero exit behavior are bounded and classified.
7. The shell capability permits only the bundled sidecar and does not expose arbitrary commands or arguments to the renderer.
8. The binary architecture matches the Rust target being packaged.
9. The app and embedded executable pass the signing checks available in the local or release environment.

If any core packaging, SDK-loading, process-control, or signing requirement proves unreliable, stop before building AI product behavior and record whether to change the packager, change the executable strategy, or return to native Rust HTTP.

## Scope

Included:

- A separate `sidecar/` Node package with its own `package-lock.json`.
- Strict TypeScript for the sidecar source.
- A versioned `health` request and response envelope.
- An offline SDK-load probe using the actual selected AI dependencies.
- A self-contained executable produced with `@yao-pkg/pkg` as the first packaging path.
- Target-triple naming and Tauri `externalBin` registration.
- Rust-only sidecar launch, stdin/stdout handling, timeout, output bounds, and termination.
- Narrow Tauri shell configuration.
- Development and packaged `.app` verification.
- Binary size, app-size delta, architecture, and cold-start observations.
- A written spike outcome and go/no-go recommendation.

Excluded:

- Keychain reads or real API keys.
- Live provider requests or provider billing.
- AI prompts, production proposal schemas, or planner context.
- AI Assist, Plan My Day, review tray, or footer changes.
- SQLite reads or writes.
- Plan acceptance and stale-plan hardening.
- Streaming, a long-lived process, localhost HTTP, sockets, or background agents.
- Renderer access to `@tauri-apps/plugin-shell`.
- Distribution notarization unless the required Apple credentials are already available.

## Current repository state

- `package.json` has no sidecar scripts or sidecar dependencies.
- `src-tauri/Cargo.toml` and `src-tauri/src/lib.rs` do not include or initialize the Tauri shell plugin.
- `src-tauri/capabilities/default.json` grants only `core:default`.
- `src-tauri/tauri.conf.json` has no `bundle.externalBin` entry.
- `src-tauri/binaries/` and `sidecar/` do not exist.
- `bundle.targets: "all"` selects all bundle formats available for the active Rust target. It does not produce executables for every operating system or CPU architecture. The sidecar still needs a binary matching each Rust target triple Slate actually builds.
- The product is currently macOS-only. Build the current host architecture first. Add `x86_64-apple-darwin` only if Intel macOS remains an explicit release target.

## Protocol for the spike

Use one JSON object per line. The request must not contain secrets or arbitrary command data.

```ts
type SpikeRequest =
  | { version: 1; operation: "health" }
  | { version: 1; operation: "sdk-load" };
```

Successful responses use a bounded envelope:

```ts
type SpikeResponse =
  | {
      ok: true;
      result: {
        operation: "health" | "sdk-load";
        status: "ready";
      };
    }
  | {
      ok: false;
      error: {
        category: "invalid-request" | "internal";
      };
    };
```

Protocol rules:

- Read exactly one newline-terminated request from stdin.
- Reject invalid JSON, unknown versions, unknown operations, and extra protocol fields.
- Write exactly one newline-terminated response to stdout, then exit.
- Keep stdout protocol-only. Do not use `console.log` for diagnostics outside the response writer.
- Keep stderr concise and non-sensitive. Rust must not surface raw stderr to the renderer.
- Apply explicit maximum request, stdout, and stderr byte counts.
- Close stdin after writing the request so the sidecar cannot wait indefinitely for more input.

The `sdk-load` operation must import the actual selected packages and exercise their offline initialization path. It should instantiate provider factories with placeholder credentials without issuing network requests and validate a small structured value with Zod. If the selected AI SDK major exposes a stable mock language-model utility, also run `generateText` with structured output against that local mock. Do not add a custom fake provider implementation solely to make this check pass.

## Implementation phases

### 1. Establish the isolated sidecar package

Files:

- `sidecar/package.json`
- `sidecar/package-lock.json`
- `sidecar/tsconfig.json`
- `sidecar/src/main.ts`
- `sidecar/src/protocol.ts`
- `sidecar/src/sdk-load.ts`

Actions:

1. Create a private Node package with strict TypeScript and a supported Node target.
2. Pin one compatible major-version set for `ai`, `zod`, Vercel Gateway support, and `@openrouter/ai-sdk-provider`.
3. Verify whether Gateway should be imported directly from `ai` or from a separate package for the selected AI SDK major. Do not carry a stale package name forward from plan 007.
4. Use a small deterministic TypeScript-to-JavaScript build step before executable packaging. Prefer one entry file and avoid a general build framework.
5. Use Node's built-in test runner unless the selected tooling makes that impractical.
6. Keep sidecar dependencies out of the root renderer package and webview bundle.

The sidecar must have no UI, database, Keychain, filesystem-persistence, or Tauri JavaScript dependencies.

### 2. Build the target-specific executable

Files:

- `sidecar/package.json`
- `sidecar/scripts/build-binary.mjs`
- `src-tauri/binaries/`
- `.gitignore`
- `package.json`

Actions:

1. Use `@yao-pkg/pkg` as the first packaging implementation, consistent with Tauri's Node sidecar guidance.
2. Determine the active target with `rustc --print host-tuple` and create the exact filename Tauri expects, such as `slate-ai-sidecar-aarch64-apple-darwin`.
3. Fail the build when the target triple is missing, unsupported, or inconsistent with the produced executable.
4. Add a root `build:sidecar` script that delegates to the isolated package.
5. Ensure a Tauri production build runs the sidecar build before bundling. Preserve `npm run build` as the renderer build and type-check command.
6. Ignore generated sidecar executables while keeping source, package metadata, and build scripts tracked.
7. Record the executable size and the `.app` size increase; do not set a speculative size threshold before measuring the real dependency set.

Do not silently download or generate a binary during ordinary renderer-only builds. Sidecar generation belongs to desktop development and Tauri package workflows.

### 3. Add the smallest native runner

Files:

- `src-tauri/Cargo.toml`
- `src-tauri/src/lib.rs`
- `src-tauri/src/sidecar.rs`

Actions:

1. Add and initialize `tauri-plugin-shell` for native Rust use.
2. Resolve the configured sidecar by its registered external-binary name rather than constructing an executable filesystem path.
3. Spawn the process without dynamic command-line arguments.
4. Write one bounded JSON request to stdin and close stdin.
5. Drain stdout and stderr concurrently so either pipe cannot block the child.
6. Parse one bounded response envelope and reject trailing protocol output.
7. Apply a conservative spike timeout and terminate the child on timeout.
8. Wait for process termination and verify that timeout handling does not leave a child process running.
9. Map spawn, write, timeout, non-zero exit, malformed output, oversized output, and unexpected termination into stable internal categories.

Use a debug-only native command or startup probe to trigger `health` and `sdk-load` during the spike. Do not add product UI and do not add the shell JavaScript package to the renderer. Remove the temporary trigger before the production AI commands replace it, unless it remains explicitly debug-only.

### 4. Register packaging and narrow permissions

Files:

- `src-tauri/tauri.conf.json`
- `src-tauri/capabilities/default.json`

Actions:

1. Register `binaries/slate-ai-sidecar` in `bundle.externalBin`.
2. Grant only the shell operations required to spawn the registered sidecar, write stdin, and terminate it.
3. Scope every permission to this sidecar. Do not allow arbitrary executable paths, shell commands, or dynamic arguments.
4. Keep both `main` and `popover` renderer windows free of direct shell APIs. The renderer may invoke only a Slate-owned native health command during the spike.
5. Confirm the final bundle contains the executable in the expected macOS app location and that it retains executable permissions.

### 5. Exercise failures without shipping sabotage paths

Failure behavior must not depend on production protocol operations such as `hang`, `crash`, or `emit-malformed-output`.

Use test fixtures or injected process-runner inputs to cover:

- Spawn failure.
- Closed stdin or write failure.
- No response before timeout.
- Non-zero exit.
- Invalid JSON.
- Multiple response lines or trailing stdout.
- Oversized stdout and stderr.
- Output followed by a hung process.
- Child termination and cleanup.

Keep destructive test behavior out of the packaged production sidecar.

### 6. Verify development and packaged behavior

Development verification:

1. Install the root and sidecar packages from their committed lockfiles.
2. Build the sidecar for the host target.
3. Run the desktop app and execute both `health` and `sdk-load` probes.
4. Confirm the renderer bundle does not contain the AI SDK, provider packages, shell package, sidecar path, or process API.
5. Run the native and sidecar tests.

Packaged verification:

1. Run a Tauri release build.
2. Inspect the `.app` and confirm the embedded executable exists.
3. Verify its architecture with `file` or `lipo -info`.
4. Launch the packaged app and execute both probes.
5. Confirm the app still starts when the sidecar is unavailable and reports a bounded native error instead of crashing.
6. Verify the app bundle and nested executable with `codesign --verify --deep --strict` when signing material is available.
7. Use `spctl` and notarization checks only for a Developer ID/notarized release build; do not treat their failure on an unsigned local build as a packaging failure.
8. Record cold process-start time, response time, executable size, and `.app` size delta.

Never place signing identities, certificates, passwords, API keys, or notarization credentials in the repository, scripts, output fixtures, or logs.

## Test plan

Sidecar tests:

- Valid `health` response.
- Valid offline `sdk-load` response.
- Unknown version and operation rejection.
- Invalid and oversized request rejection.
- Exactly one stdout response line.
- No diagnostic output containing placeholder credentials.

Rust tests:

- Request serialization and response validation.
- Stable error classification.
- Maximum stdout and stderr enforcement.
- Timeout and child termination.
- Non-zero exit behavior.
- Trailing-output rejection.

Configuration checks:

- `externalBin` base name matches the generated binary.
- Capability scope names only the Slate sidecar.
- No arbitrary shell command or argument permission exists.
- Generated executable target suffix matches the Rust build target.
- AI SDK packages appear only in `sidecar/package-lock.json`, not the renderer lockfile.

## Validation commands

Use the real commands only after their scripts exist:

```bash
npm run build
npm run build:sidecar
npm --prefix sidecar test
cargo test --manifest-path src-tauri/Cargo.toml
npm run dev:desktop
npm run tauri -- build
```

Packaged inspection may additionally use:

```bash
file <embedded-sidecar-path>
codesign --verify --deep --strict <Slate.app>
```

Do not add commands to `AGENTS.md` or README until they exist and have been exercised.

## Go/no-go record

At the end of the spike, add a short outcome section to this document containing:

- Selected AI SDK and provider package versions.
- Selected Node target and executable packager version.
- Successful Rust target triples.
- Development and packaged probe results.
- Signing level actually verified.
- Binary size and `.app` size delta.
- Cold-start and health round-trip observations.
- Any packaging warnings, dynamic-import issues, or missing assets.
- Remaining release risks.
- Final decision: proceed with the sidecar, change packaging strategy, or return to native HTTP.

## Done criteria

- [x] The isolated sidecar package installs reproducibly from its lockfile.
- [x] The target-specific executable builds without requiring Node on the destination machine.
- [x] Development Tauri launches the sidecar through Rust and completes `health` and `sdk-load` probes.
- [x] The selected AI SDK, Zod, Gateway support, and OpenRouter provider load in the packaged executable.
- [ ] Timeout, crash, malformed output, oversized output, and non-zero exit behavior are all bounded and tested; malformed output, process errors, missing termination, trailing output, and non-zero exit are covered, while a fixture-based timeout/oversized-stream test remains before production AI work is released.
- [x] The renderer has no shell API and no AI SDK/provider dependencies.
- [x] The renderer receives no Tauri shell permissions; the sidecar is launched only through native Rust.
- [x] A release `.app` contains and launches the architecture-matched sidecar.
- [x] Available code-signing checks pass, or unavailable release credentials are recorded as an explicit remaining gate.
- [x] Binary size, app-size delta, and process-start observations are recorded.
- [x] The spike concludes with a written go/no-go decision before AI feature implementation proceeds.

## Spike outcome

- Selected AI SDK: `ai@7.0.35`, `zod@4.4.3`, and `@openrouter/ai-sdk-provider@3.0.0`.
- Selected packager: `@yao-pkg/pkg@6.21.0` using its Node single-executable (`--sea`) mode.
- The traditional `pkg` target mode was rejected during the spike: a trivial `node22-macos-arm64` artifact was killed before startup in the local macOS environment, including after an ad-hoc signing attempt. The `--sea` path produced a runnable arm64 executable.
- The packaged sidecar is a 133,790,160-byte arm64 Mach-O executable using the Node 25.9.0 runtime embedded by the SEA build. The current host target is `aarch64-apple-darwin`.
- Development Tauri probes passed through Rust, stdin/stdout, and the packaged sidecar: `health: ready` and `sdk-load: ready`.
- The shell plugin is initialized only for its native Rust API. No shell capability is granted to either renderer window.
- The packaged `.app` contained `Contents/MacOS/slate-ai-sidecar`; the app occupied 142 MB and the generated arm64 DMG occupied 44 MB. Launching the packaged app with `SLATE_SIDECAR_PROBE=1` produced both ready results.
- The sidecar passed strict ad-hoc signature verification. The Tauri-generated local app required a local deep ad-hoc re-sign before `codesign --verify --deep --strict` passed. Developer ID signing and notarization remain release-environment gates.
- Native validation passed: `cargo check`, `cargo test --manifest-path src-tauri/Cargo.toml` with 13 tests, and `npm run build`. Sidecar TypeScript checking and protocol tests passed. Direct sidecar health startup measured about 1.13 seconds on the current machine.
- Decision: proceed with the Node sidecar using SEA packaging for the current macOS arm64 target. Intel macOS requires a separately produced x86_64 host artifact and must be added only if Intel remains a release target. AI feature implementation may proceed behind the native Tauri command boundary.

## References

- [AI SDK Node sidecar plan](007-ai-sdk-node-sidecar.md)
- [AI Assist and Plan My Day plan](006-ai-assist-plan-my-day-review-tray.md)
- [Slate product brief](../product-brief.md)
- [Tauri Node sidecar guide](https://v2.tauri.app/learn/sidecar-nodejs/)
- [Tauri external binary guide](https://v2.tauri.app/develop/sidecar/)
- [Tauri shell plugin](https://v2.tauri.app/plugin/shell/)
- [AI SDK structured output](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [Vercel AI Gateway provider](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway)
- [OpenRouter AI SDK provider](https://github.com/OpenRouterTeam/ai-sdk-provider)

## Planned at

Branch `codex/ai-sidecar-packaging-spike`, 2026-07-22.

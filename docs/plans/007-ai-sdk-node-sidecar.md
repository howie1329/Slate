# Implementation plan: AI SDK Node sidecar

## Objective

Add a bundled Node.js sidecar so Slate can use the Vercel AI SDK for AI Assist and Plan My Day while preserving the native credential and persistence boundaries.

The React renderer continues to call typed Tauri commands. Rust remains responsible for reading SQLite and macOS Keychain data, starting the sidecar, validating its response, and returning only safe proposal data to the renderer.

This plan is an alternative transport plan to the native HTTP adapter in [006-ai-assist-plan-my-day-review-tray.md](006-ai-assist-plan-my-day-review-tray.md). The product behavior, review tray, persistence rules, and acceptance matrix in plan 006 remain authoritative unless this plan explicitly changes the transport boundary.

For the detailed Plan My Day request and acceptance contract, [012-plan-my-day-sidecar-vertical-slice.md](012-plan-my-day-sidecar-vertical-slice.md) is now authoritative.
For the implemented Assist request and renderer flow, [011-ai-assist-sidecar-vertical-slice.md](011-ai-assist-sidecar-vertical-slice.md) is authoritative.

## Decision summary

Use a short-lived sidecar process per AI request. Communicate over newline-delimited JSON through stdin/stdout. Do not create a localhost HTTP server, pass credentials through command-line arguments, or expose the Tauri shell API to the renderer.

The sidecar uses:

- `ai` for structured generation and Vercel AI Gateway support through `createGateway`.
- `zod` for sidecar-side output schemas.
- `@openrouter/ai-sdk-provider` for OpenRouter.

The pinned packaging-spike dependency set does not use a separate `@ai-sdk/gateway` package. Revisit that choice only if a future AI SDK upgrade requires it.

The sidecar is packaged as a self-contained executable and bundled through Tauri's `externalBin` configuration. Tauri's Node sidecar guidance uses a packaged Node binary and target-specific sidecar files; see the [Tauri Node sidecar guide](https://v2.tauri.app/learn/sidecar-nodejs/) and [external binary guide](https://v2.tauri.app/develop/sidecar/).

## Pros and cons

### Using a Node sidecar

| Pros | Cons |
| --- | --- |
| Uses the Vercel AI SDK directly, including `generateText`, structured output, provider abstractions, and future streaming/tool support. | Adds a second runtime and executable to the desktop application. |
| Keeps API keys out of the React renderer while still allowing TypeScript-based AI code. | Requires sidecar packaging, architecture-specific binaries, signing, and release verification. |
| Keeps AI prompts and Zod schemas together in one TypeScript module. | Rust must implement process management, stdin/stdout IPC, timeouts, cancellation, and crash handling. |
| Makes future AI features easier to add in TypeScript. | Adds another dependency graph and lockfile to maintain. |
| Provider integrations can use their existing JavaScript SDKs instead of hand-written HTTP adapters. | The API key still exists in the sidecar process memory during a request, so the credential surface is larger than native-only HTTP. |
| AI behavior can be tested independently from the renderer. | Packaged-build failures may occur even when web and Rust development builds pass. |

### Not using a Node sidecar

The alternative is the native Rust HTTP approach described in plan 006.

| Pros | Cons |
| --- | --- |
| Fewer processes, dependencies, packaging steps, and release failure modes. | Does not use the Vercel AI SDK directly. |
| API keys remain entirely within the Rust process and Keychain boundary. | Rust must implement provider requests, response decoding, structured-output validation, and provider-specific behavior. |
| Better fit for Slate's current two non-streaming AI actions. | Future streaming, tools, workflows, and AI SDK features require more custom work. |
| Simpler macOS packaging and smaller runtime surface. | Provider behavior and protocol changes become Slate maintenance work. |
| One native testing and error-handling boundary. | Prompts and schemas may need coordination between Rust and TypeScript. |

### Recommendation

Use the sidecar if Slate is expected to grow into a broader TypeScript AI layer with streaming, tools, chat, or multi-step workflows. Stay with native HTTP if the scope remains limited to AI Assist and Plan My Day.

If this sidecar plan is selected, the additional runtime and packaging work should be accepted as a deliberate platform investment rather than treated as a small implementation detail.

## Architecture

```text
React renderer
    │ invoke("generate_ai_assist" / "generate_daily_plan")
    ▼
Rust/Tauri
    ├─ reads settings and planner data
    ├─ reads the selected API key from macOS Keychain
    ├─ validates provider and model settings
    ├─ starts one sidecar process
    ├─ sends one JSON request through stdin
    ├─ validates the safe JSON response
    └─ returns a Slate proposal
          │
          ▼
Node sidecar
    ├─ creates the selected AI SDK provider
    ├─ runs AI Assist or Plan My Day
    ├─ validates structured output with Zod
    ├─ writes one JSON response to stdout
    └─ exits
```

The renderer must not know that a Node process exists. The sidecar is an implementation detail behind the existing native AI commands.

## Sidecar protocol

Use versioned newline-delimited JSON. The request is sent through stdin, never as command-line arguments or an environment variable.

```ts
type SidecarRequest =
  | {
      version: 1;
      operation: "assist";
      provider: "vercel-gateway" | "openrouter";
      model: string;
      apiKey: string;
      input: {
        capture: string;
        today: string;
        scheduledDate: string | null;
        todayTasks: TaskContext[];
      };
    }
  | {
      version: 1;
      operation: "plan";
      provider: "vercel-gateway" | "openrouter";
      model: string;
      apiKey: string;
      input: {
        today: string;
        dailyCapacityMinutes: number;
        remainingMinutes: number;
        todayTasks: TaskContext[];
        candidates: TaskContext[];
        planningInstruction: string;
      };
    };
```

Responses use one of two envelopes:

```json
{
  "ok": true,
  "result": {}
}
```

```json
{
  "ok": false,
  "error": {
    "category": "timeout"
  }
}
```

Allowed error categories are `invalid-request`, `unavailable-key`, `timeout`, `network`, `provider-rejected`, `malformed-output`, `no-proposal`, and `internal`. Raw provider bodies, prompts, authorization headers, and API keys must never appear in responses or logs.

## Implementation phases

### 1. Prove the packaged sidecar round trip

Files:

- `sidecar/package.json`
- `sidecar/tsconfig.json`
- `sidecar/src/main.ts`
- `sidecar/src/protocol.ts`
- `src-tauri/Cargo.toml`
- `src-tauri/src/lib.rs`
- `src-tauri/tauri.conf.json`
- `src-tauri/capabilities/default.json`

Create a minimal sidecar that reads one `health` request from stdin and returns `{ status: "ready" }` on stdout.

Before implementing AI behavior, prove that a packaged Tauri build can:

1. Include the sidecar executable.
2. Start it from a native Tauri command.
3. Write a request to stdin.
4. Read and parse stdout.
5. Handle a non-zero exit and timeout.

This phase de-risks the largest new platform dependency before adding prompts or UI.

### 2. Establish the Node sidecar project

Create a separate Node package under `sidecar/` with its own lockfile. Keep it separate from the renderer package so sidecar dependencies do not enter the webview bundle.

Add:

- `ai`
- `zod`
- `@openrouter/ai-sdk-provider`
- A TypeScript bundler suitable for producing one deterministic entry file.
- `@yao-pkg/pkg` or the selected equivalent for creating the self-contained executable.

Use strict TypeScript settings. The sidecar should have no UI dependencies and no database or filesystem persistence.

### 3. Implement protocol and provider execution

Files:

- `sidecar/src/protocol.ts`
- `sidecar/src/providers.ts`
- `sidecar/src/schemas.ts`
- `sidecar/src/prompts.ts`
- `sidecar/src/operations/assist.ts`
- `sidecar/src/operations/plan.ts`

Implement a single request dispatcher:

- Parse and validate the request envelope.
- Reject unknown providers, operations, versions, or missing fields.
- Create the selected provider with the request's API key.
- Call structured generation with a bounded output schema.
- Normalize errors into the allowed categories.
- Return one response and exit.

Use separate schemas:

```ts
const assistSchema = z.object({
  title: z.string().trim().min(1).max(240),
  estimateMinutes: z.number().int().positive().max(1440),
  scheduledDate: z.string().nullable(),
});

const planSchema = z.object({
  taskIds: z.array(z.string()).max(50),
  rationale: z.string().trim().max(500).nullable(),
});
```

The model may suggest title, estimate, date, task IDs, and rationale only. It must not choose persistence scope, position, or arbitrary task fields.

### 4. Keep prompt construction safe and bounded

Files:

- `sidecar/src/prompts.ts`
- `src-tauri/src/ai.rs`
- `src-tauri/src/persistence.rs`

Native Rust should compute the planning context before invoking the sidecar:

- Current local date.
- Existing Today commitments.
- Remaining capacity.
- Eligible estimated Backlog tasks.
- Stable task IDs and current ordering.
- Saved planning instruction.

Bound the request before it leaves the app:

- Maximum Assist capture length.
- Maximum planning-instruction length.
- Maximum candidate task count.
- Maximum title length sent to the model.
- Maximum output tokens.

Treat task titles and planning instructions as untrusted user data. Delimit them clearly in prompts and state that they are data, not instructions.

For Plan My Day, Rust remains the deterministic authority. If the model returns an invalid, duplicate, unknown, completed, future-dated, or over-capacity task ID, reject or safely filter it according to the explicit policy chosen in plan 006. Do not allow the sidecar to assign dates, scopes, or positions.

### 5. Add the Rust sidecar runner

Files:

- `src-tauri/src/ai.rs`
- `src-tauri/src/credentials.rs`
- `src-tauri/src/persistence.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/Cargo.toml`

Add a private Keychain reader in `credentials.rs` and a dedicated internal AI-context reader in `persistence.rs`. Do not expose repository internals broadly.

Implement native commands:

- `generate_ai_assist`
- `generate_daily_plan`

Each command should:

1. Validate the input.
2. Read current settings and local planner context.
3. Read the selected provider key from Keychain.
4. Build a versioned sidecar request.
5. Spawn the sidecar through the Tauri shell plugin.
6. Write the request to stdin.
7. Read one response from stdout.
8. Apply a conservative timeout.
9. Kill the child process on timeout or cancellation.
10. Validate the returned proposal locally.
11. Return only safe proposal data to React.

Do not emit `planner://changed` for generation, dismissal, or redo. Only accepted task mutations emit planner changes.

### 6. Configure Tauri packaging and permissions

Files:

- `src-tauri/tauri.conf.json`
- `src-tauri/capabilities/default.json`
- `src-tauri/binaries/`
- `.gitignore`
- Root and sidecar package scripts.

Register the sidecar in `bundle.externalBin` and produce target-specific binaries, at minimum:

- `aarch64-apple-darwin`
- `x86_64-apple-darwin`, if Intel macOS remains supported.

Keep shell permissions narrowly scoped to this sidecar. Do not grant arbitrary command execution or dynamic command arguments.

If `tauri.conf.json` continues to declare all bundle targets, build sidecar binaries for every supported target. Otherwise narrow the bundle target to the supported macOS artifacts until other platform builds exist.

The official Tauri guide uses `@yao-pkg/pkg` for the Node binary. Node's built-in single-executable feature is another option, but its documentation currently describes that feature as active development, so it should not be the first packaging path for Slate. [Node single-executable applications](https://nodejs.org/api/single-executable-applications.html)

### 7. Integrate with the existing AI review flow

Update plan 006's renderer integration without changing its product behavior:

- `src/lib/planner.ts`
- `src/lib/planner-query.tsx`
- `src/components/ai-review.tsx`
- `src/components/ai-review-tray.tsx`
- `src/components/task-composer-footer.tsx`
- `src/routes/__root.tsx`

The renderer still receives only:

- AI Assist title, estimate, and date proposal.
- Plan My Day task summaries and safe assignment data.
- Concise error categories.

The renderer never receives the API key, raw provider response, prompt, sidecar command path, or sidecar process ID.

Add an operation ID in the review-state owner so late sidecar responses cannot overwrite a newer request. Dismiss pending UI state on route changes where appropriate.

### 8. Test and verify packaged behavior

Sidecar tests:

- Protocol parsing and version rejection.
- Unknown operation/provider rejection.
- Zod output validation.
- Provider error normalization.
- No secrets in stdout/stderr.
- Timeout and forced termination behavior.
- Prompt bounds and candidate limits.

Rust tests:

- Keychain reader remains private to native code.
- Sidecar request construction.
- Sidecar response validation.
- Native AI error mapping.
- Assist date preservation.
- Plan eligibility and capacity validation.
- Atomic stale-plan rejection.

Manual verification:

1. Run the sidecar round trip in development.
2. Run AI Assist from Today and Backlog.
3. Run Plan My Day with no eligible tasks and no capacity.
4. Remove the API key and confirm manual Save still works.
5. Simulate sidecar crash, timeout, malformed output, and provider rejection.
6. Verify 360 × 520 popover behavior and full-window behavior.
7. Build the packaged `.app` and verify the sidecar launches from the packaged bundle.
8. Verify code signing for the app and embedded sidecar.

Validation commands after implementation:

```bash
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run build:sidecar
npm run tauri -- build
```

Add the sidecar-specific command to `package.json` only after it exists; do not document a command that has not been implemented.

## Done criteria

- [ ] The sidecar can be packaged and launched from a Tauri development build.
- [ ] The sidecar can be packaged into a signed macOS `.app`.
- [ ] React invokes only the existing native AI commands.
- [ ] API keys travel only from Keychain to native code to the sidecar request and never through renderer state, command arguments, SQLite, logs, or change events.
- [ ] AI Assist and Plan My Day use AI SDK structured output schemas.
- [ ] Rust remains authoritative for dates, eligibility, capacity, ordering, and persistence.
- [ ] Sidecar failures become concise, retryable UI errors.
- [ ] Manual Save works when the sidecar, network, or API key is unavailable.
- [ ] The review tray behavior and compact-window acceptance matrix from plan 006 pass.
- [ ] Native tests, sidecar tests, and packaged macOS verification pass.

## References

- [Slate AI actions brief](../ai-actions-brief.md)
- [Slate product brief](../product-brief.md)
- [AI Assist and Plan My Day review tray plan](006-ai-assist-plan-my-day-review-tray.md)
- [Vercel AI SDK structured output](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [Vercel AI Gateway provider](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway)
- [OpenRouter AI SDK provider](https://github.com/OpenRouterTeam/ai-sdk-provider)
- [Tauri Node sidecar](https://v2.tauri.app/learn/sidecar-nodejs/)
- [Tauri external binaries](https://v2.tauri.app/develop/sidecar/)
- [Node single-executable applications](https://nodejs.org/api/single-executable-applications.html)

## Planned at

2026-07-21

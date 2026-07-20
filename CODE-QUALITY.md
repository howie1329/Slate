<!-- agentkit:start code-quality -->
# Code quality guide

- Prefer small route components with clear page-level ownership. Extract a component only when it has a meaningful reuse boundary.
- Keep route navigation declarative with TanStack Router `Link` and route definitions.
- Preserve strict TypeScript types; avoid `any` and untyped native payloads.
- Treat `src/routeTree.gen.ts` as generated output rather than a hand-maintained source file.
- Keep task-domain and persistence concerns explicit instead of burying them in presentation components.
- Limit Tauri changes to the smallest capability and Rust surface needed; do not broaden native access speculatively.
- Retain the existing accessibility baseline: semantic landmarks, labelled sections, visible focus styles, and readable contrast.

Use the real validation commands listed in `AGENTS.md`; no automated test command is configured yet.
<!-- agentkit:end code-quality -->

<!-- agentkit:start change-explanation -->
# Change explanation guide

When handing off Slate changes, lead with the user-visible outcome. Then state the affected surface: a route or shell in `src/`, the design foundation in `src/styles.css`, or native desktop behavior in `src-tauri/`.

Include:

- The task workflow or UI behavior that changed.
- Any local-first data or Tauri permission implications.
- The validation command run, such as `npm run build`, or why validation was not applicable.
- Follow-up work intentionally left deferred.

Keep explanations concise and distinguish implemented behavior from planned behavior.
<!-- agentkit:end change-explanation -->

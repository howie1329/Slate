# 028 — Make unsized Today commitments first-class

**Parent:** Plan 026 — Unified Daily workspace

**What to build:** Align native persistence, renderer classification, capacity, and AI eligibility with the Daily workspace contract so an incomplete task scheduled for today belongs to Today even when it has no estimate. Preserve the existing local task model and make the behavior durable through the native mutation boundary.

**Blocked by:** 027 — Build the canonical Daily workspace UI

**Status:** ready-for-agent

- [ ] An unestimated task scheduled for the current local day appears in the Today section of the Daily workspace.
- [ ] An unsized Today task is visibly marked Needs estimate and remains editable through the existing task-detail interaction.
- [ ] Known committed and remaining minutes ignore null estimates rather than assigning a guessed duration.
- [ ] The Daily workspace exposes the count or presence of unsized Today commitments alongside known capacity.
- [ ] Plan My Day and other AI planning eligibility continue to exclude unsized tasks.
- [ ] Returning an unsized Today task to Backlog clears its scheduled date without losing its null estimate or other task data.
- [ ] Native scope membership, ordering, revision increments, Planner Events, and planner-change notifications remain consistent and stale-safe.
- [ ] The behavior survives snapshot reads and application restart without a new persistent task-status field.
- [ ] Existing native persistence tests cover creation, scheduling, editing, completion, return-to-Backlog, capacity, AI eligibility, ordering, and stale rejection.
- [ ] The native test suite and renderer build pass.

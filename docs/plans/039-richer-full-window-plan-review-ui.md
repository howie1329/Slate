# 039 — Richer Full-window Plan My Day review

**Status:** Complete

**Priority:** Stage 3 / 2.1 planning acceleration

**Scope:** Connected Full-app inspector UI over the existing Plan My Day generation and atomic acceptance boundary

## Outcome

The Full app now gives Plan My Day a dedicated editable review mode inside the right Workspace inspector. The Planning Board or List remains visible, and the compact Daily workspace keeps its existing review tray.

The empty inspector is a real entry surface. It shows current Today capacity and an enabled **Plan my day** action when AI is configured. The adjacent toolbar AI action opens the same inspector review.

The connected review:

- Uses the packaged sidecar and native `generate_daily_plan` command for its starting proposal.
- Shows committed minutes, proposed minutes, and remaining or over-capacity minutes with the standard capacity rail.
- Starts with every generated proposal item included.
- Lets the user remove proposed additions or add other currently eligible estimated Ready tasks.
- Exposes a deterministic **Use a safer mix** action when the current candidate set can preserve at least 40 minutes of open capacity.
- Keeps Today commitments fixed and additive; it never removes or reorders existing Today work.
- Disables acceptance for an empty or over-capacity selection.
- Passes the final reviewed selection through the existing native stale-safe, capacity-aware, atomic Plan My Day acceptance command.
- Handles loading, empty, unavailable-provider, error, stale, and accepting states in the same inspector.
- Returns dismissal and successful acceptance to the empty inspector.

## Interaction decisions

- The experience is a Workspace inspector mode, not a modal, route, chat surface, or new planning model.
- Task detail and Plan My Day remain mutually exclusive inspector modes.
- **Add from Backlog** opens an inline inspector browser. It lists only estimated Ready tasks that are unscheduled or overdue under the authoritative Planning rules.
- Added tasks retain their current title, estimate, source date, and revision. They are not edited or persisted until acceptance.
- The final acceptance payload keeps the generated proposal's Today IDs, Today revisions, effective capacity, and pre-plan remaining-capacity guard. Native persistence revalidates every selected task and applies all assignments or none.
- Dismiss and Generate again are transient and perform no task writes.
- Existing Today commitments remain visible on the Board/List rather than being duplicated as editable rows in the inspector.

## Responsive and visual behavior

- The inspector uses Slate's existing 410px desktop width.
- Below 960px of Planning canvas width, it overlays the right side at no more than the viewport width minus a 40px context edge, preventing the Board or List from being crushed.
- Static regions use semantic task-detail colors, tonal separation, and hairline boundaries.
- The proposal body scrolls independently while the acceptance actions stay pinned to the inspector footer.
- Motion communicates inspector state with a short opacity/translation transition and is removed under Reduced Motion.
- Capacity, error, stale, disabled, and over-capacity states use text and structure as well as color.

## Domain boundaries preserved

- No new task status, schema, route, provider protocol, prompt, Keychain behavior, or Tauri command was introduced.
- The compact Plan My Day flow remains unchanged.
- Plan additions remain limited to the generated proposal and currently eligible Ready tasks already present in the authoritative renderer snapshot.
- Acceptance remains additive, stale-safe, capacity-aware, and atomic at the SQLite boundary.
- No task title, estimate, date, priority, energy, tag, project, subtask, dependency, or time block editing is introduced in this review.

## Validation

- `node --test src/lib/plan-builder.test.mjs`
- `npm run build`
- Manual browser-backed review against realistic Planner snapshot and proposal data covered:
  - Empty-inspector entry and generated result.
  - Proposed-task removal.
  - Eligible Backlog search and addition.
  - Over-capacity feedback and disabled acceptance.
  - Safer-mix recalculation.
  - Narrow-window inspector overlay with Board context preserved.
  - Accessible region, heading, button, search, busy, status, and alert names.

Packaged desktop acceptance with a live provider remains part of the broader Stage 2/Stage 3 release matrix rather than this component-level implementation record.

## Out of scope

- Reordering proposed additions.
- Editing proposal titles, estimates, or dates.
- Modifying existing Today commitments from the review.
- Showing ineligible, future-dated, completed, or unsized tasks.
- Per-task AI explanations, chain-of-thought, freeform chat, or conversation history.
- Planning Session, Make This Fit, unfinished-day review, changed-day recovery, batch planning, calendar grids, or time blocking.

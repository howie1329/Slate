# Slate implementation plan index

> **Status:** Canonical plan inventory and ownership map
>
> **Updated:** 2026-08-09

This file is the source of truth for plan status, ownership, and relationships. The numbered plan files remain useful implementation records, but their original checklists and file paths describe the repository state at the time they were written. An unchecked historical acceptance item does not mean the current product is missing that behavior; use the status and current product sources below first.

## Status vocabulary

- **Complete** — implemented and accepted for the stated release or slice.
- **Implemented** — current source and product documentation show the work is present, but the original plan did not record every packaged or manual acceptance step.
- **Proposed** — approved as a candidate, but not implemented.
- **Historical** — retained for context; it is not an execution queue.
- **Superseded** — the plan’s original decision or surface was replaced by a later plan. Its durable contracts may still be retained.

## Current sources of truth

- Product contract: [`docs/product-brief.md`](../product-brief.md)
- Direction and next-stage gates: [`docs/roadmap.md`](../roadmap.md)
- UI and interaction system: [`DESIGN.md`](../../DESIGN.md)
- Code boundaries: [`CODE-QUALITY.md`](../../CODE-QUALITY.md)
- Current release notes: [`docs/releases/v1.1.0.md`](../releases/v1.1.0.md)

Current renderer ownership is `src/routes/__root.tsx` for the shell, `src/components/daily-workspace.tsx` for the unified planner surface, `src/components/quick-capture-window.tsx` for the dedicated shortcut window, and `src/components/workspace-footer.tsx` for the persistent utility footer. Older route and `task-composer-footer.tsx` references inside historical plans are intentionally preserved as snapshots of their original implementation context.

## Plan relationships

These are intentional relationships, not duplicate plans:

- **001 → 003:** Plan 001 is the original MVP shape. Plan 003 supersedes its persistence-specific design.
- **006 → 011 + 012:** Plan 006 is a historical product behavior reference. Its native HTTP approach is superseded by the packaged sidecar slices in Plans 011 and 012.
- **021 ↔ 022:** Plan 021 is the onboarding brief; Plan 022 is its implementation plan. Keep both because they answer different questions.
- **023 → 024 → 025:** Plan 023 owns durable Stage 2 foundations. Plan 024 defines the quick-capture task, draft, event, and Undo contracts. Plan 025 supersedes only Plan 024’s original popover surface with the dedicated capture window and owns the current UI/native surface.
- **026 → 027, 028, 029 → 030 → 031:** Plan 026 is the unified workspace parent. Plans 027–029 are focused implementation slices, Plan 030 is their final polish/cleanup pass, and Plan 031 is the proposed behavior-preserving architecture hardening of the resulting planning boundary.

Do not create a new plan to restate one of these items. Update the owning plan, or add a narrowly scoped child plan with an explicit relationship here.

## Inventory

| Plan | Status | Ownership / disposition |
| --- | --- | --- |
| [001 MVP daily planning loop](001-mvp-daily-planning-loop.md) | Historical | Initial product baseline; persistence details moved to 003 and current behavior is governed by the product brief. |
| [002 menu-bar popover and native shell](002-menu-bar-popover-native-shell.md) | Historical | Original shell plan; retained as the native-surface baseline. |
| [003 SQLite persistence](003-sqlite-persistence.md) | Complete | Current local persistence foundation. |
| [004 Today capacity state](004-today-capacity-state.md) | Complete | Current capacity and over-capacity behavior. |
| [005 persistence recovery screen](005-persistence-recovery-screen.md) | Complete | Recovery behavior shipped with the local persistence boundary. |
| [006 AI Assist, Plan My Day, and review tray](006-ai-assist-plan-my-day-review-tray.md) | Historical | Behavior reference only; implementation is owned by 011 and 012. |
| [008 remove abandoned scaffolding](008-remove-abandoned-scaffolding.md) | Proposed | Open cleanup candidate from the maintainability audit. |
| [009 Number Flow header metrics](009-number-flow-animated-header-numbers.md) | Complete | Shipped visual behavior. |
| [011 AI Assist sidecar](011-ai-assist-sidecar-vertical-slice.md) | Complete | Release-accepted AI Assist path. |
| [012 Plan My Day sidecar](012-plan-my-day-sidecar-vertical-slice.md) | Complete | Release-accepted Plan My Day path. |
| [013 AI connection settings save flow](013-ai-connection-settings-save-flow.md) | Implemented | Current Settings save and credential boundary are shipped; the original plan’s packaged manual matrix was not re-recorded. |
| [014 AI boundary hardening](014-ai-boundary-hardening-and-cleanup.md) | Implemented | Current Keychain, timeout, catalog, and sidecar boundary are shipped; the original plan’s final packaged matrix was not re-recorded. |
| [015 reproducible sidecar bootstrap](015-reproducible-sidecar-bootstrap.md) | Complete | README bootstrap and stale-binary guard are present. |
| [016 bounded AI context titles](016-bound-ai-context-title-length.md) | Complete | Native regression coverage passes; stored titles remain lossless. |
| [017 align agent guidance](017-align-agent-guidance-ai-status.md) | Historical | Documentation alignment completed before Slate 1.0.0. |
| [018 complete task lifecycle](018-complete-task-lifecycle.md) | Implemented | Current task completion, restoration, and Backlog history behavior is shipped. |
| [019 long-title Plan My Day acceptance](019-fix-long-title-plan-my-day-acceptance.md) | Complete | Native long-title proposal and acceptance regressions pass. |
| [020 task-list drag-and-drop](020-task-list-drag-and-drop.md) | Complete | Release-accepted ordering behavior. |
| [021 onboarding brief](021-onboarding-brief.md) | Complete | Brief delivered; implementation is owned by 022. |
| [022 onboarding implementation](022-onboarding-implementation.md) | Implemented | Current product includes the skippable first-run onboarding flow. |
| [023 Stage 2 foundations](023-stage-2-foundations.md) | Implemented | Planner events, revisions, weekly capacity, and reviewed acceptance groundwork are present. Anchor/recovery UI remains conditional 2.3 work. |
| [024 global quick capture](024-stage-2-global-quick-capture.md) | Superseded | Durable task, draft, event, and Undo contracts remain; the original popover surface is replaced by 025. |
| [025 dedicated quick-capture window](025-stage-2-dedicated-quick-capture-window.md) | Complete | Current dedicated capture window and compact 520 × 72 geometry. |
| [026 unified Daily workspace](026-unified-daily-workspace.md) | Complete | Parent plan for the current workspace. |
| [027 Daily workspace UI](027-daily-workspace-ui.md) | Complete | Child implementation slice of 026. |
| [028 unsized Today commitments](028-unsized-today-commitments.md) | Complete | Child implementation slice of 026. |
| [029 explicit Daily movement actions](029-explicit-daily-movement-actions.md) | Complete | Child implementation slice of 026. |
| [030 Daily workspace polish](030-daily-workspace-polish-cleanup.md) | Complete | Final polish and cleanup pass for the 026–029 workspace sequence. |
| [031 planning workspace boundary](031-deepen-planning-workspace-boundary.md) | Complete | The shipped Daily workspace now uses one authoritative native projection and planning-order mutation boundary. |

Plan numbers 007 and 010 are intentionally unused. Do not invent placeholder files to fill those gaps; add a new numbered plan only when a genuinely new, scoped work item is approved.

## Planning rule

The next work queue comes from [`docs/roadmap.md`](../roadmap.md), not from the presence of an old unchecked box in a completed or implemented plan. The current roadmap gate is Stage 2 validation and evidence gathering; conditional 2.3 recovery work remains deferred until user evidence earns it.

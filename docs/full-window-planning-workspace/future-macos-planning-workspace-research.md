# Future macOS planning workspace research

> **Status:** Research input for Slate 2.0–2.x
>
> **Prepared:** 2026-08-10
>
> **Scope:** First-party product patterns, Kanban/flow guidance, accessibility guidance, and a recommended desktop direction for Slate.

## Executive conclusion

Slate should build a spacious full-window planning workspace with exactly three user-facing views:

1. **Commitment Board** — shape the relationship between captured, ready, Today, and completed work.
2. **Capacity List** — scan, estimate, reorder, and operate the same work model quickly with a keyboard.
3. **Review** — deliberately resolve Today, near-future, overdue, and pending-proposal decisions without silently rescheduling anything.

The board is worth building only as a derived view of Slate’s existing commitment model. It should not introduce generic `To Do / In Progress / Done` status, custom columns, an arbitrary card-count WIP system, or a second persistence model. Slate’s distinctive constraint is already stronger and more legible than a generic WIP count: a visible daily budget in minutes.

The full window should help a solo knowledge worker answer three questions:

- What have I captured but not made actionable?
- What realistic work deserves space in Today?
- What changed, and what do I want to do about it?

The menu-bar popover remains the primary surface for the ordinary daily loop. The full window is for shaping, comparing, and reviewing a larger pool of work. This follows Apple’s distinction between a popover for a small amount of related functionality and macOS windows for spacious, keyboard-oriented work. ([Apple, Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers/); [Apple, Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos/))

## Research method and source quality

This artifact uses official product documentation, official product help centers, Apple’s Human Interface Guidelines, the W3C accessibility recommendation, Kanban University’s official guide, and original empirical research papers. Product pages are treated as evidence of what a product supports or recommends, not as neutral evidence that the feature is effective.

The comparison deliberately separates:

- **Observed:** a behavior, affordance, constraint, or policy directly documented by the product or standard.
- **Inference:** a design implication inferred from that evidence for a solo knowledge worker or for Slate. Inferences are labeled rather than presented as measured user research.
- **Recommendation:** a proposed Slate decision.

There is good first-party evidence for product capabilities, Kanban principles, and interaction/accessibility constraints. There is not comparable primary evidence here for which product is “best” for every solo knowledge worker, or for every claimed pain point of consumer Kanban software. Those judgments remain hypotheses to validate with Slate use.

## 1. First-party product comparison

### Things

**What it does well for a solo knowledge worker — observed.** Things separates two organizing perspectives: context through Areas and Projects, and time through Today, Upcoming, Anytime, Someday, Inbox, and Logbook. Its Upcoming list exposes the next seven days specifically to help prevent overloading one day, while Inbox is an explicit staging area for unprocessed thoughts. ([Things, default lists](https://culturedcode.com/things/support/articles/4001304/)) This is a strong model for separating capture from actionable work and for giving a person a near-term planning horizon without requiring a calendar grid.

**Limitations and tradeoffs — observed.** Things’ default lists cannot be renamed, removed, or reordered. Its start-date model intentionally controls when work comes to attention; future-start items remain inactive and later appear in Today. Things also documents that alphabetical sorting is not available, with manual drag ordering as the alternative. ([Things, scheduling to-dos](https://culturedcode.com/things/support/articles/2803579/); [Things, FAQ](https://culturedcode.com/things/support/articles/2967034/))

**Inference for Slate.** Things demonstrates the value of named planning states and a short horizon, but its date-driven surfacing and richer Area/Project hierarchy would be a poor fit if copied literally. Slate should preserve explicit dates without silently rolling unfinished work forward, and should keep Backlog versus Today as the simpler commitment distinction.

### Todoist

**What it does well — observed.** Todoist supports a board layout in which sections become columns and tasks become cards; tasks can be created and reordered in the board. Its task view concentrates title, description, date, deadline, priority, label, comments, subtasks, attachments, and reminders in one place. Filters can query dates, projects, labels, priorities, creation dates, and more, and can be shown as list or board layouts. ([Todoist, board layout](https://www.todoist.com/help/articles/board-layout-in-todoist-nutzen-AiAVsyEI); [Todoist, task view](https://www.todoist.com/help/articles/use-the-task-view-to-manage-tasks-in-todoist-eDeRDO0C); [Todoist, filters](https://www.todoist.com/help/articles/introduction-to-filters-V98wIH))

**Limitations and tradeoffs — observed.** Todoist explicitly says it does not support actual start dates that hide tasks until a start date; its documented workaround is a separate “start” task or subtask, or a recurring date. Its filter model uses a query syntax with operators, nested expressions, and project/section/label vocabulary. ([Todoist, start dates](https://www.todoist.com/help/articles/does-todoist-support-start-dates-qhqlgZhk); [Todoist, filters](https://www.todoist.com/help/articles/introduction-to-filters-V98wIH))

**Inference for Slate.** Todoist is a good reference for fast capture, task detail, and optional filtered views. The start-date workaround shows how a missing domain concept can become extra task structure. Slate should avoid making users encode “ready to start” as a synthetic task or learn a query language; readiness should be derived from estimate, date, and commitment state.

### Linear

**What it does well — observed.** Linear gives board and list layouts near-parity, shared selection, keyboard movement, grouping, and multi-selection. Its Spacebar Peek previews the focused item while keeping the user in the current list or board, and arrow keys move through adjacent items. ([Linear, board layout](https://linear.app/docs/board-layout); [Linear, Peek](https://linear.app/docs/peek))

**Limitations and tradeoffs — observed.** Linear documents that board layout is not available in every part of the product, including Triage and Inbox. It also states that descriptions are not shown on cards and that not all issue properties fit on a card; users must peek or open the issue. Board and list ordering are shared rather than independently configured. ([Linear, board layout](https://linear.app/docs/board-layout))

**Inference for Slate.** Linear is the strongest interaction reference for Board/List parity, keyboard-first selection, and non-modal inspection. Its many grouping dimensions—status, project, priority, cycle, label, team, and more—also show how a board can become a configurable work-management surface. Slate should copy the interaction quality while limiting the domain to commitment-oriented derived lanes.

### Trello

**What it does well — observed.** Trello’s base model is immediately legible: a board contains lists, and lists contain cards; cards can move between lists and lists can be rearranged. Trello also supports board filtering, a personal Planner, card scheduling, and automation. ([Trello, create a board](https://support.atlassian.com/trello/docs/creating-a-new-board/); [Trello, navigation](https://support.atlassian.com/trello/docs/navigation-in-trello/); [Trello, Planner](https://support.atlassian.com/trello/docs/trello-planner/); [Trello, automation](https://support.atlassian.com/trello/docs/automation-overview/))

**Limitations and tradeoffs — observed.** Every board must belong to a Workspace, even when the board is private. Several perspective features are plan-gated: for example, Calendar view is documented as available to Premium and Enterprise Workspaces. Trello also documents that list sorting cannot be undone except by manually moving cards back. ([Trello, create a board](https://support.atlassian.com/trello/docs/creating-a-new-board/); [Trello, Calendar view](https://support.atlassian.com/trello/docs/calendar-view); [Trello, sorting](https://support.atlassian.com/trello/docs/sorting-lists/))

**Inference for Slate.** Trello demonstrates the low-learning-cost value of direct spatial movement. Its user-defined lists, Power-Ups, automation, Planner, and multiple board views also illustrate how a simple card model accumulates operational overhead. Slate should make the meaning of each lane fixed and keep movement reversible and explicit.

### Asana

**What it does well — observed.** Asana lets a project switch among List, Board, Timeline, and Calendar views, with filtering and saved views. Its Board view uses cards and columns to represent stages, and cards can show due date, assignee, and subtasks. ([Asana, project views](https://asana.com/features/project-management/project-views); [Asana, filter and save views](https://help.asana.com/s/article/filter-and-save-views))

**Limitations and tradeoffs — observed.** The same first-party descriptions expose a broad work-management model: stages, custom fields, assignees, subtasks, dependencies, rules, timeline/Gantt scheduling, and AI-assisted project management are all adjacent patterns in the product documentation. Asana also describes dragging tasks as instantly updating a project timeline. ([Asana, project views](https://asana.com/features/project-management/project-views); [Asana, organize your work](https://help.asana.com/s/topic/0TOPc0000001Kw2OAE/organize-your-work?language=en_US))

**Inference for Slate.** Asana is a useful reference for keeping multiple representations over one task set, but its team/project graph is not evidence that Slate needs those entities. A direct drag that changes schedule or stage can be efficient in a project system; for Slate, dragging into Today should preview minute impact before committing the date change.

### Notion

**What it does well — observed.** Notion lets one database appear as Table, Board, Timeline, Calendar, List, Gallery, or Chart, with filters, sorts, groups, linked views, and side-peek page opening. Its board view groups items by a property and can move tasks from one status to another. ([Notion, views, filters, sorts, and groups](https://www.notion.com/help/views-filters-and-sorts); [Notion, working with views](https://developers.notion.com/guides/data-apis/working-with-views))

**Limitations and tradeoffs — observed.** Notion’s advanced filters can combine nested `AND` and `OR` groups up to three layers deep. Its task guidance adds sub-items and dependencies when a task database grows beyond 50 rows. ([Notion, views, filters, sorts, and groups](https://www.notion.com/help/views-filters-and-sorts); [Notion, sub-tasks and dependencies](https://www.notion.com/en-gb/help/guides/tasks-manageable-steps-sub-tasks-dependencies))

**Inference for Slate.** Notion is a strong reference for keeping detail one peek away and for deriving multiple representations from one source. It is also a clear example of the setup/maintenance tax Slate should avoid: a flexible database can make the user responsible for defining properties, views, filters, relations, and sub-item semantics before the tool can answer “what fits today?”

### OmniFocus

**What it does well — observed.** OmniFocus offers standard perspectives for Inbox, Projects, Tags, Forecast, Flagged, Nearby, Review, Completed, and Changed. Its outline supports projects, action groups, actions, folders, and tags; estimated duration is a first-class field and can drive the Latest Start Date and custom perspectives. ([OmniFocus, perspectives](https://support.omnigroup.com/documentation/omnifocus/universal/4.8.11/en/perspectives/); [OmniFocus, outline](https://support.omnigroup.com/documentation/omnifocus/universal/4.8.11/en/outline/); [OmniFocus, estimated duration](https://support.omnigroup.com/documentation/omnifocus/universal/4.8.11/en/glossary/))

**Limitations and tradeoffs — observed.** The standard perspectives expose many simultaneous ways to slice the same work. OmniFocus also supports custom perspectives with rules for availability, dates, tags, project/folder containment, duration, and other properties; the outline can contain multiple hierarchy types. ([OmniFocus, perspectives](https://support.omnigroup.com/documentation/omnifocus/universal/4.8.11/en/perspectives/); [OmniFocus, custom perspectives](https://support.omnigroup.com/documentation/omnifocus/universal/4.8/en/custom-perspectives/))

**Inference for Slate.** OmniFocus validates duration-aware planning, review, and “available next” concepts. Its taxonomy and custom-filter power are valuable for expert GTD users but would make Slate feel like a system to maintain. Slate should expose minutes and review decisions directly, without requiring projects, contexts, tags, or custom perspectives.

### Apple Reminders

**What it does well — observed.** Apple Reminders is a particularly relevant macOS reference because it supports list and column layouts, Smart Lists, pinned lists, sections, subtasks, tags, templates, and Calendar integration. Apple documents that sections become column headings in column view. ([Apple, Reminders User Guide](https://support.apple.com/guide/reminders/welcome/mac); [Apple, sections in Reminders](https://support.apple.com/en-ca/guide/reminders/remn14bf0e77/mac); [Apple, tags in Reminders](https://support.apple.com/en-gb/guide/reminders/remn45640f4f/mac))

**Limitations and tradeoffs — observed.** Apple notes that the full set of Reminders features in the guide depends on updated iCloud reminders and that some features are unavailable with other providers. The documented model emphasizes lists, dates, tags, sections, and subtasks rather than an explicit personal capacity budget in minutes. ([Apple, Reminders User Guide](https://support.apple.com/guide/reminders/welcome/mac))

**Inference for Slate.** Reminders is a useful native interaction and compact-column reference, but it reinforces Slate’s opportunity: a private desktop planner can be differentiated by making the cost of Today commitments visible rather than adding another general reminder taxonomy.

## 2. Exactly three desktop views for Slate

These are the only three views recommended for the 2.x full-window workspace. “Peek,” detail panels, filters, selection modes, and horizon controls are interaction modes within these views, not additional top-level views.

### View 1 — Commitment Board

**User job.** “Show me the shape of my available work so I can deliberately pull a realistic amount into Today.”

**Why it fits Slate.** Backlog and Today already encode an intentional commitment boundary. A derived board can make that boundary spatially obvious without adding a persistent status field. The full-window board is appropriate for a planning session; the popover remains the quick daily surface. This is consistent with the existing [full-window product direction](full-window-planning-workspace/full-window-planning-workspace.md) and [roadmap Stage 3](../roadmap.md).

**Leading products and patterns.** Trello provides the simplest board/list/card model. Linear provides Board/List parity, multi-selection, keyboard movement, and Spacebar Peek. Asana and Notion show how a single underlying task set can support a board representation. Kanban University provides the governing practices: visualize work, limit WIP, manage flow, make policies explicit, and improve through feedback. ([Trello, board model](https://support.atlassian.com/trello/docs/creating-a-new-board/); [Linear, board layout](https://linear.app/docs/board-layout); [Linear, Peek](https://linear.app/docs/peek); [Kanban University, official guide](https://kanban.university/kanban-guide/))

**Risks.** A board can make a status field feel mandatory even when Slate’s domain does not need one. User-created columns can create workflow maintenance. Cards can become miniature documents. Dragging can turn a deliberate commitment into an accidental write. A visible Done lane can encourage completion theater or make “moving the card” feel equivalent to doing the work. An overloaded board can increase rather than reduce prioritization pressure.

**Concrete elevation opportunities.**

- Use derived lanes with fixed meaning: **Capture**, **Ready**, **Today**, and a quiet **Done** history lane. Capture means unsized, vague, or otherwise not ready to commit; Ready means estimated and uncommitted; Today means an explicit current-day commitment; Done means actually completed work.
- Make Ready → Today a capacity-aware pull action. Before the write, show `Today 240 / 360 min`, `Selected +75 min`, and `After move 315 / 360 min`; warn on over-capacity without silently blocking a deliberate choice.
- Keep card anatomy small: title, estimate or `Needs estimate`, date/status signal, and selection affordance. Use Spacebar Peek or the existing detail interaction for the rest.
- Provide click/menu/keyboard movement with the same semantics as drag-and-drop. Support `⌘Z` with a precise operation label and stale-state rejection.
- Keep lane policy visible near the board. Do not let “In Progress” emerge as a cosmetic column that has no product meaning.

### View 2 — Capacity List

**User job.** “Let me scan and operate my work precisely: estimate it, reorder it, edit it, and commit it without fighting a spatial board.”

**Why it fits Slate.** A dense list is better than a board for keyboard-heavy work, long titles, unsized tasks, exact ordering, and compact-window continuity. It also keeps Slate usable when the user has many captured tasks but only a few realistic Today commitments. It is a second representation of the same data, not a second workflow.

**Leading products and patterns.** Linear documents near-parity between board and list, shared ordering, selection, and shortcuts. Things demonstrates a focused Today list plus a short Upcoming horizon. OmniFocus demonstrates an outline with focused perspectives and duration-aware sorting. Apple’s macOS guidance explicitly recommends keyboard shortcuts and using large windows to present more content in fewer nested levels. ([Linear, board layout](https://linear.app/docs/board-layout); [Things, default lists](https://culturedcode.com/things/support/articles/4001304/); [OmniFocus, outline](https://support.omnigroup.com/documentation/omnifocus/universal/4.8.11/en/outline/); [Apple, Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos/))

**Risks.** The list can become a dense database with too many properties. If list ordering and board ordering diverge, users will no longer understand which representation is authoritative. If it exposes every future, overdue, completed, and unsized item at once, it can recreate the pressure the board was meant to reduce.

**Concrete elevation opportunities.**

- Use the same derived lane grouping, selection state, ordering, mutations, and capacity summary as the board.
- Make `Needs estimate`, `Overdue / needs reschedule`, and `Over capacity` explicit, compact states rather than new routes or persistent statuses.
- Support arrow-key navigation, `Space` Peek, direct estimate editing, `⌘` movement actions, multi-select, and a command menu before treating drag-and-drop as the primary mechanism.
- Show capacity at the point of commitment, not as a productivity score: active minutes, remaining minutes, and overage only.
- Allow a user to start in the list and switch to the board without losing selection or context.

### View 3 — Review

**User job.** “Help me resolve the decisions that the passage of time or a changed plan has made important, while preserving my right to leave work unchanged.”

**Why it fits Slate.** Slate explicitly does not silently roll unfinished work into tomorrow. A full window has enough room to review unfinished Today commitments, overdue work, the next seven days, later work, and pending AI proposals with deliberate choices. This is the right home for the conditional 2.3 unfinished-day and changed-day recovery candidates in the [product brief](../product-brief.md) and [roadmap](../roadmap.md), without making either flow a popover requirement.

**Leading products and patterns.** Things’ Upcoming list provides a short seven-day horizon and separates future work from current focus. OmniFocus provides Forecast and Review perspectives. Trello Planner shows a focused day/week surface and requires review of scheduling suggestions before acceptance. Linear’s Peek pattern supports reviewing detail without losing list context. ([Things, default lists](https://culturedcode.com/things/support/articles/4001304/); [OmniFocus, perspectives](https://support.omnigroup.com/documentation/omnifocus/universal/4.8.11/en/perspectives/); [Trello, Planner](https://support.atlassian.com/trello/docs/trello-planner/); [Linear, Peek](https://linear.app/docs/peek))

**Risks.** Review can become a calendar replacement, a productivity dashboard, or a guilt surface. A “next” horizon can accidentally become precommitment. An automatic recovery proposal can feel like silent rollover, especially when AI is involved. Too much history can turn a simple decision into an audit.

**Concrete elevation opportunities.**

- Keep one Review view with restrained scopes such as **Today**, **Next 7 Days**, **Later**, and **Needs attention**. These are review scopes within the view, not additional top-level views.
- For unfinished Today work, offer explicit actions: complete, edit estimate/title, schedule a selected date, return to Backlog, or leave unchanged. Never preselect tomorrow.
- Surface only actionable attention: missing estimates, overdue commitments, current over-capacity, and pending proposals. Hide the rail when empty.
- Show pending AI changes as a diff with exact tasks, dates, and minute totals. Acceptance writes atomically; dismissal writes nothing.
- Use event history to explain what changed, not to grade the person. Defer repeated-deferral insights until Calibration has enough evidence.

## 3. Kanban and flow research

### What Kanban contributes

Kanban University describes Kanban as a method focused on flow rather than a prescribed software-development process. Its official guide emphasizes visualizing work and workflow, limiting WIP, managing flow, making policies explicit, using feedback, and improving collaboratively. It specifically warns against optimizing individual utilization at the expense of system flow and describes context switching as a reason to limit WIP. ([Kanban University, official guide](https://kanban.university/kanban-guide/); [Kanban University, principles and practices](https://kanban.university/principles-general-practices-kanban-method/))

For Slate, the important translation is not “add columns.” It is:

- make the commitment boundary visible;
- make the pull criteria understandable;
- limit commitments using a meaningful capacity constraint;
- keep policies explicit;
- observe aging and unfinished work without turning observation into a score;
- improve the system without asking the user to maintain a project-management bureaucracy.

### Pain points and practical responses

| Pain point | Evidence and interpretation | Slate response |
| --- | --- | --- |
| **WIP overload** | Kanban University says WIP limits balance utilization and flow, and that fully utilizing resources can produce poor flow; it also calls out context switching in knowledge work. An empirical study of 141 software developers found that participants perceived task switching as disruptive and associated it with cognitive cost and lower performance. ([Kanban University](https://kanban.university/kanban-guide/); [Shakeri Hossein Abad et al., task switching study](https://arxiv.org/abs/1805.05504)) | Use daily capacity in minutes as Slate’s primary WIP constraint. Keep the count of Today tasks visible as context, not as an arbitrary hard limit. Show over-capacity clearly and make returning work explicit and reversible. |
| **Column/status ambiguity** | Kanban guidance says policies and pull criteria should be explicit. Trello lets each user create and rename lists, while Todoist explicitly treats sections as project phases. The affordance is flexible, but the meaning is user-defined. ([Kanban University](https://kanban.university/kanban-guide/); [Trello, board model](https://support.atlassian.com/trello/docs/creating-a-new-board/); [Todoist, board layout](https://www.todoist.com/help/articles/board-layout-in-todoist-nutzen-AiAVsyEI)) | Derive fixed lanes from existing fields. Document what each lane means beside the board. Do not add `In Progress` merely because it is conventional. A task’s presence in Today is a commitment; it is not a claim about live execution. |
| **Drag-and-drop state changes** | Apple says drag-and-drop should communicate source/destination semantics and notes that macOS supports keyboard access and VoiceOver. WCAG 2.2 requires a single-pointer alternative to dragging unless dragging is essential. Apple’s undo guidance says users expect `⌘Z` and that the result of undo should be predictable. ([Apple, Drag and drop](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop); [W3C, WCAG 2.2 dragging movements](https://www.w3.org/TR/WCAG22/#dragging-movements); [Apple, Undo and redo](https://developer.apple.com/design/human-interface-guidelines/undo-and-redo?changes=___3)) | Make drag a convenience, not the only path. Preview capacity before Ready → Today. Provide keyboard and menu equivalents, visible drop targets, a clear operation label, atomic native writes, and standard undo. Announce or visibly confirm the lane/date change. |
| **Stale boards** | A board is a visualization of mutable work, so a view can become stale between inspection and mutation. This is an engineering inference, not a claim made by Kanban University. Linear’s shared board/list data model and Slate’s existing expected-state boundary point to the same practical requirement. ([Linear, board layout](https://linear.app/docs/board-layout); [Slate, full-window direction](full-window-planning-workspace.md); [Slate, roadmap](../roadmap.md)) | Every movement and batch action should carry expected task revisions or expected state. Revalidate in SQLite and reject the whole change set on mismatch. Refresh both windows through the existing native change event. |
| **Card bloat** | Linear explicitly says descriptions and all properties do not fit on board cards; Notion defaults several database layouts to side peek; Todoist centralizes many task properties in task view. The inference is that a card cannot be the complete record without becoming noisy. ([Linear, board layout](https://linear.app/docs/board-layout); [Notion, database views](https://www.notion.com/help/views-filters-and-sorts); [Todoist, task view](https://www.todoist.com/help/articles/use-the-task-view-to-manage-tasks-in-todoist-eDeRDO0C)) | Keep the card to title, estimate, commitment/date cue, and a few exception states. Use Peek/detail for context. Defer rich notes, subtasks, dependencies, tags, and arbitrary custom fields. |
| **Prioritization pressure** | Kanban University says the method focuses on flow and the system rather than managing individual performance. It recommends data for improving the system, not a worker-utilization contest. ([Kanban University](https://kanban.university/kanban-guide/)) | Keep “priority” subordinate to capacity and deliberate commitment. Show what fits, what exceeds capacity, and what needs a decision. Do not add rankings, streaks, completion percentages, or productivity scores. |
| **Overhead** | Asana, Notion, OmniFocus, and Trello each document extensive adjacent structures: views, filters, fields, dependencies, perspectives, automation, and multiple planning surfaces. The conclusion that this creates maintenance overhead for some solo users is an inference, not a measured cross-product finding. ([Asana, project views](https://asana.com/features/project-management/project-views); [Notion, database views](https://www.notion.com/help/views-filters-and-sorts); [OmniFocus, perspectives](https://support.omnigroup.com/documentation/omnifocus/universal/4.8.11/en/perspectives/); [Trello, automation](https://support.atlassian.com/trello/docs/automation-overview/)) | Start with no board setup. Lanes, policies, filters, and capacity semantics ship with Slate. Add a concept only when it makes deciding what fits today easier and evidence shows the current model cannot express the decision. |
| **Accessibility** | WCAG 2.2’s dragging criterion requires a non-dragging alternative. Apple recommends sufficiently sized controls, Full Keyboard Access, VoiceOver support, visible focus, and not relying on auto-dismiss timing for people who need longer to process an interface. ([W3C, WCAG 2.2](https://www.w3.org/TR/WCAG22/); [Apple, Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility); [Apple, Focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection/); [Apple, Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards)) | Define lane movement as a command with focusable task rows, visible focus, keyboard movement, context-menu actions, sufficient hit targets, reduced-motion behavior, and no essential information conveyed by color alone. Ensure popover dismissal does not strand an in-progress edit or review. |
| **Mobile/compact-window mismatch** | Apple describes popovers as appropriate for a small amount of related functionality and macOS as a spacious environment for deep work. Apple also recommends using large displays to reduce nested levels. ([Apple, Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers/); [Apple, Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos/)) | Do not compress the full board into the 360 × 520 popover. Keep capture, Today capacity, task edits, completion, return, and AI review available there. Reserve the three-view workspace for an intentionally opened full window, and make the list usable at narrower widths than the board. |
| **Completion theater** | This is an inference risk: if a board visually rewards cards reaching Done, a user may optimize visible movement rather than meaningful completion. Kanban University’s emphasis on system flow rather than individual performance is a useful guardrail, not direct evidence of this consumer behavior. ([Kanban University](https://kanban.university/kanban-guide/)) | Completion must remain the existing explicit task action. Keep Done visually secondary and collapsible. Do not show progress scores or “velocity.” Preserve incomplete work in its actual state and make recovery a choice rather than a rollover. |

### What to borrow from Kanban, and what not to borrow

**Borrow:** visualization, explicit policies, pull criteria, visible bottlenecks, limited WIP, reversible movement, flow-aware review, and feedback loops.

**Do not borrow by default:** arbitrary per-column card limits, custom workflow states, throughput dashboards, team ceremonies, swimlane taxonomies, service classes, or a persistent execution status. Those are useful in some systems, but they would turn Slate’s daily commitment problem into a generic workflow-management problem.

## 4. Recommended Slate desktop direction

### Product direction

Build the full-window workspace as a three-view shell over one authoritative local task model:

- **Commitment Board** for spatial shaping.
- **Capacity List** for precise scan/edit/reorder work.
- **Review** for explicit recovery and horizon decisions.

The Board and List must be genuinely equivalent representations where the task model supports equivalence: selection, ordering, filters, detail, batch actions, capacity context, keyboard operations, and persistence. Review is not a generic dashboard; it is a decision queue for current exceptions and explicitly dated future work.

### Domain boundary

Keep lanes derived from completion, estimate, and date. Do not add a persistent Kanban status field in 2.0. A task’s state should remain understandable from the existing facts:

- captured but unestimated or unclear → Capture;
- estimated, uncommitted, and eligible → Ready;
- explicitly dated for today and incomplete → Today;
- completed → Done/history;
- future-dated or overdue → Review scopes, not automatic rollover lanes.

This preserves SQLite as the local source of truth, the existing native command boundary, the Stage 2 expected-state and reviewed-change-set contracts, and the product rule that AI proposals require acceptance. ([Slate product brief](../product-brief.md); [Slate roadmap](../roadmap.md); [Slate full-window direction](full-window-planning-workspace.md))

### Interaction contract

1. **Capture stays cheap.** A title-only capture goes to Backlog/Capture and never silently enters Today.
2. **Commitment is legible.** Ready → Today shows minute impact before the write and may warn without blocking a deliberate over-capacity choice.
3. **Movement is reversible.** Every user-initiated movement has keyboard/menu parity and `⌘Z` undo. Batch actions use one reviewed, atomic change set.
4. **Review is explicit.** Unfinished Today work never becomes tomorrow by default. Review offers schedule a selected date, return to Backlog, edit, complete, or leave unchanged.
5. **AI is subordinate.** AI can propose cleanup, estimates, fit, or recovery; it cannot write or move work until the user accepts an exact diff.
6. **Details stay one step away.** Spacebar Peek or the existing detail panel exposes title, estimate, date, lane, capacity impact, and history without forcing a modal detour.
7. **The popover remains sufficient.** A user can capture, understand Today capacity, edit/complete/return work, and review AI proposals without opening the full window.

### Engineering slices

**2.0 — Workspace foundation**

- Add the three-view shell and a derived Commitment Board.
- Add Capacity List parity over the same selectors, ordering, and mutation commands.
- Implement keyboard movement and focus states alongside pointer movement.
- Add Ready → Today capacity preview, stale-safe validation, atomic writes, and undo.
- Add a restrained native macOS toolbar with view selection, search, capacity summary, and context actions.

**2.1 — Planning acceleration**

- Add Review scopes for Today, Next 7 Days, Later, and Needs attention.
- Add multi-select and reviewed batch actions such as Fit into Today, schedule, estimate, return, and release where the existing domain supports them.
- Expand Plan My Day review in the full window without changing its additive, reviewable semantics.

**2.2 — Distinctive polish**

- Add temporary Focus mode as a transient presentation of existing Today commitments, not a new status.
- Add reviewable Make This Fit proposals for oversized or unclear work.
- Add recent capture/completion and per-task history inspection only where the Stage 2 event ledger can explain the evidence.

**2.3 — Conditional review and recovery**

- Ship unfinished-day review or changed-day recovery only if real use demonstrates recurring friction that task-level controls do not solve.
- Preserve no-op/leave-unchanged decisions and never preselect tomorrow.
- Remove provisional recovery-only state if neither candidate earns its complexity.

### Validation questions

Before adding more structure, measure whether:

- users understand Capture, Ready, Today, and Done without a tutorial;
- the capacity preview changes decisions before commitment rather than merely explaining an overage afterward;
- users can complete the core board/list flow with keyboard and menu actions alone;
- the Board and List feel like two views of one planner rather than two competing systems;
- the Review view resolves real unfinished-day friction without becoming a calendar or analytics dashboard;
- the popover remains sufficient for ordinary daily planning;
- users describe the workspace as helping them make fewer, clearer commitments rather than as a project tracker.

## Bibliography

### Product documentation

- [Things — An In-Depth Look at Today, Upcoming, Anytime, and Someday](https://culturedcode.com/things/support/articles/4001304/)
- [Things — Scheduling To-Dos](https://culturedcode.com/things/support/articles/2803579/)
- [Things — Frequently Asked Questions](https://culturedcode.com/things/support/articles/2967034/)
- [Todoist — Board layout](https://www.todoist.com/help/articles/board-layout-in-todoist-nutzen-AiAVsyEI)
- [Todoist — Task view](https://www.todoist.com/help/articles/use-the-task-view-to-manage-tasks-in-todoist-eDeRDO0C)
- [Todoist — Filters](https://www.todoist.com/help/articles/introduction-to-filters-V98wIH)
- [Todoist — Start dates](https://www.todoist.com/help/articles/does-todoist-support-start-dates-qhqlgZhk)
- [Linear — Board layout](https://linear.app/docs/board-layout)
- [Linear — Peek preview](https://linear.app/docs/peek)
- [Trello — Create a board](https://support.atlassian.com/trello/docs/creating-a-new-board/)
- [Trello — Navigation](https://support.atlassian.com/trello/docs/navigation-in-trello/)
- [Trello — Planner](https://support.atlassian.com/trello/docs/trello-planner/)
- [Trello — Automation overview](https://support.atlassian.com/trello/docs/automation-overview/)
- [Trello — Calendar view](https://support.atlassian.com/trello/docs/calendar-view)
- [Trello — Sort cards in a list](https://support.atlassian.com/trello/docs/sorting-lists/)
- [Asana — Project views](https://asana.com/features/project-management/project-views)
- [Asana — Filter and save views](https://help.asana.com/s/article/filter-and-save-views)
- [Notion — Views, filters, sorts, and groups](https://www.notion.com/help/views-filters-and-sorts)
- [Notion — Working with views](https://developers.notion.com/guides/data-apis/working-with-views)
- [Notion — Sub-tasks and dependencies](https://www.notion.com/en-gb/help/guides/tasks-manageable-steps-sub-tasks-dependencies)
- [OmniFocus — Perspectives](https://support.omnigroup.com/documentation/omnifocus/universal/4.8.11/en/perspectives/)
- [OmniFocus — Outline](https://support.omnigroup.com/documentation/omnifocus/universal/4.8.11/en/outline/)
- [OmniFocus — Glossary / Estimated Duration](https://support.omnigroup.com/documentation/omnifocus/universal/4.8.11/en/glossary/)
- [OmniFocus — Custom Perspectives](https://support.omnigroup.com/documentation/omnifocus/universal/4.8/en/custom-perspectives/)
- [Apple — Reminders User Guide for Mac](https://support.apple.com/guide/reminders/welcome/mac)
- [Apple — Manage sections in reminder lists on Mac](https://support.apple.com/en-ca/guide/reminders/remn14bf0e77/mac)
- [Apple — Tag reminders on Mac](https://support.apple.com/en-gb/guide/reminders/remn45640f4f/mac)

### Kanban, accessibility, macOS, and research

- [Kanban University — The Official Guide to The Kanban Method](https://kanban.university/kanban-guide/)
- [Kanban University — Principles and General Practices](https://kanban.university/principles-general-practices-kanban-method/)
- [Kanban University — Kanban Method Infographic](https://kanban.university/resources/kanbanmethodinfographic/)
- [W3C — Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C — Understanding Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements)
- [Apple — Drag and drop](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop)
- [Apple — Undo and redo](https://developer.apple.com/design/human-interface-guidelines/undo-and-redo?changes=___3)
- [Apple — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Apple — Focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection/)
- [Apple — Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards)
- [Apple — Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers/)
- [Apple — Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos/)
- [Z. Shakeri Hossein Abad et al. — Two Sides of the Same Coin: Software Developers’ Perceptions of Task Switching and Task Interruption](https://arxiv.org/abs/1805.05504)
- [Z. Shakeri Hossein Abad et al. — Task Interruption in Software Development Projects](https://arxiv.org/abs/1805.05508)


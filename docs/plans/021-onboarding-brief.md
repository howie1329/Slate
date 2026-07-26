# Plan 021: Slate first-run onboarding brief

> **Status:** Proposed
> **Priority:** P1 after 1.0 validation
> **Effort:** S–M
> **Risk:** LOW–MEDIUM
> **Category:** Product / first-run UX
> **Researched:** 2026-07-26

## Executive recommendation

Slate should have onboarding, but it should be a short, optional first-plan experience rather than a product tour or setup wizard.

The product is intentionally small, yet its central model is not completely conventional:

- Backlog is captured work, not a commitment.
- Today is a deliberate commitment.
- Estimates make the cost of a commitment visible.
- Capacity is a planning constraint, not a score.

The onboarding should help a new user experience that model with one real task. It should not attempt to explain every control or configure AI before the user has received value.

## Product outcome

The aha moment is:

> “I can see what this task costs, decide whether it fits today, and understand what capacity I have left.”

Onboarding succeeds when the user has captured, estimated, and committed one real task to Today, then understands the remaining-minute signal without further explanation.

This is an extension of the existing 1.0 contract, not a new product area. The normal app should remain usable when onboarding is skipped.

## Research conclusions

### 1. Teach through the task, not through a tour

Apple recommends that onboarding be fast, optional, and interactive; it specifically favors letting people perform the task they are learning and using context-specific tips when possible. [Apple Human Interface Guidelines: Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding)

Nielsen Norman Group similarly recommends avoiding dedicated onboarding when the interface can be learned through use. When a workflow is genuinely novel, the guidance should be brief, optional, and focused on the minimum unfamiliar concepts. [NN/g: Mobile-App Onboarding](https://www.nngroup.com/articles/mobile-app-onboarding/)

For Slate, the meaningful lesson is not where the buttons are. It is the difference between captured work and a realistic commitment. The user should perform that decision.

### 2. Make the first action accomplish something useful

The strongest onboarding definition in the research is not “introduce the interface”; it is increasing the chance that users succeed at the outcome they came for. The product should help users make progress toward their goal instead of asking them to reverse-engineer a feature tour. [Intercom interview with Samuel Hulick](https://www.intercom.com/blog/podcasts/user-onboarding-interview-samuel-hulick/)

Todoist’s official guide starts with adding a first task and uses examples in the task field to make the expected action concrete. [Todoist: Get started with Todoist](https://www.todoist.com/help/articles/get-started-with-todoist-OgNNJR)

Slate should ask for a real task, not make the user read about capture, estimation, and planning before doing them.

### 3. Defer optional complexity

Progressive disclosure means showing only the important choices first and revealing specialized options when they become relevant. This reduces cognitive load without limiting the product. [NN/g: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)

For Slate, daily capacity is relevant to the first plan; theme, AI provider, model, API key, and planning instruction are not. AI should appear as an optional contextual capability after the manual loop is understood.

### 4. Empty states are part of onboarding

Onboarding is broader than a first-launch screen. Empty states, contextual tips, and later feature introductions all help users become successful. This is consistent with both the onboarding research and the way Things teaches its Inbox-to-planning habit through its normal workflow rather than a long setup sequence. [Things: Getting Productive with Things](https://culturedcode.com/things/guide/)

Slate’s existing empty states are a strong base. They should carry the ongoing explanation of Backlog and Today after the first-run flow is dismissed or completed.

## Proposed experience

### Entry condition

Show the first-run experience only when all of the following are true:

- The local planner has no tasks.
- The user has not completed or skipped onboarding.
- Persistence has loaded successfully.

Do not show it on every launch, after a user has imported or captured work, or while the app is in a recovery/error state.

### Welcome state

Use a compact in-product panel in the normal Today surface. Do not replace the app with a branded splash screen or a full-screen carousel.

Suggested copy:

> **Make today realistic.**
> Slate helps you see what your work costs before you commit to it. We’ll make one real plan together.
>
> **Start planning** · **I’ll explore on my own**

The welcome state should communicate an honest time estimate: “About a minute.” It should not list features, mention AI, or ask for an account.

### Step 1 — Set the day’s budget

Show the current default capacity, 240 minutes, as an editable value.

Suggested copy:

> **How much focused work fits in a day?**
> Start with 240 minutes, or choose a number that feels realistic. You can change this anytime in Settings.

Primary action: **Use this capacity**

The default should be immediately usable. Capacity setup is included because it makes the first commitment meaningful, but it must not become a survey or require the user to know their exact number.

### Step 2 — Capture one real task

Move the user into the real capture flow, preferably with the Backlog concept visible.

Suggested copy:

> **Capture something you actually need to do.**
> Backlog is where work waits before you decide whether it belongs in Today.

Primary action: use the existing composer. The field should keep its normal placeholder and behavior. Do not create sample data automatically.

If the user adds a task directly from Today, preserve the existing behavior and explain that it is being committed today. If the onboarding implementation needs a clearer distinction, add an explicit **Commit to Today** action to the task detail rather than relying on a calendar icon alone.

### Step 3 — Estimate and commit

After the task exists, guide the user to set a positive whole-minute estimate and place the task on Today.

Suggested copy:

> **Give it a time cost.**
> A rough estimate is enough. Then choose whether it deserves space in Today.

The task must remain a real task and the save boundary must remain the normal persistence path. Avoid a fake “practice task” mode.

When the task reaches Today, show the actual capacity result:

> **60 minutes committed · 180 minutes remaining**

Use the existing header summary and capacity rail as the proof of value. Do not introduce a separate onboarding metric, score, streak, or celebration animation.

### Completion state

End in the normal Today workspace, with a small non-blocking confirmation:

> **You’ve made your first plan.**
> Capture more work in Backlog, then bring only what fits into Today.

The confirmation should disappear after the next meaningful action or be dismissible. It should not block the task list or footer.

## Contextual guidance after first run

The first-run flow should remain small because the rest of the education belongs at the moment of need.

### Today empty state

Keep the current calm treatment, but make the distinction explicit:

> **Your day is open.**
> Choose a task from Backlog when you’re ready to make a commitment.

If there is no Backlog work, the action can remain **Add a task** and explain that adding from Today commits it to the current day.

### Backlog empty state

Suggested copy:

> **Your backlog is clear.**
> Capture work here first. Add a rough estimate and decide later whether it deserves space in Today.

### Estimate discovery

If the user opens an unsized task, the estimate control should use plain language such as **Set time** rather than relying on an icon or placeholder alone. A single contextual hint may appear the first time:

> **A rough estimate is enough.**

### AI discovery

Do not include AI in first-run onboarding. After the user has completed the manual loop, the AI control can have a one-time contextual hint:

> **Optional:** AI can suggest a title and estimate. Nothing changes until you review it.

If no provider key is configured, keep the existing unavailable-state explanation and do not treat AI setup as unfinished onboarding.

## Interaction and visual requirements

- The experience must work at the 360 × 520 popover minimum.
- The user can skip from every state and immediately use the normal app.
- There is no dimmed five-step tour, spotlighting of standard controls, or forced navigation.
- Each state teaches one concept and has one primary action.
- Use the existing Slate surfaces, type, buttons, focus rings, and motion vocabulary.
- Keep the panel inline or footer-adjacent; avoid a large modal unless compact-window testing proves an inline treatment cannot work.
- Respect keyboard navigation, Escape dismissal, screen-reader announcements, and reduced motion.
- Keep onboarding state in the existing local persistence/preferences boundary. Do not add an account, network request, analytics SDK, or secret-bearing state.
- Persist distinct `completed` and `skipped` outcomes so a skipped user is not repeatedly interrupted.
- Provide a later **Review the basics** action from Settings or Help if replay is desired. It must not appear automatically again.

## Scope for the first implementation

### In scope

- A first-run, optional, three-step first-plan flow.
- Local persistence of onboarding completion/skip state.
- One small affordance or copy improvement that makes “commit to Today” legible if the current date control is insufficient during testing.
- Updated Today and Backlog empty-state copy.
- One-time contextual hints for estimate and optional AI review.
- Compact-window and keyboard accessibility verification.

### Out of scope

- Account creation, sync, permissions, notifications, email sequences, or analytics.
- AI configuration as a prerequisite.
- Sample tasks that remain in the user’s planner without explicit consent.
- Feature tours for Settings, themes, task ordering, completion, or future roadmap features.
- A new onboarding route, generated router edits, or a separate tutorial mode.
- New productivity metrics, scores, streaks, or completion percentages.

## Validation plan

Before shipping, test the existing empty states without onboarding against the same task. If users already complete the loop and understand Backlog versus Today, prefer improving the empty states over adding dedicated flow. This follows NN/g’s recommendation to first make the UI more learnable and only add onboarding if it measurably improves success.

Then run a small qualitative test with five people who have not used Slate:

1. Can they state what Slate is for after seeing the first screen?
2. Can they capture a real task without being told where to start?
3. Do they understand where an uncommitted task belongs?
4. Can they estimate and commit one task?
5. Can they explain the remaining-minute value after the task is committed?
6. Can they skip onboarding and still use the app normally?

The go/no-go bar is behavioral, not completion-rate theater: users should reach the first realistic plan quickly and be able to explain the Backlog/Today distinction in their own words. If they fail, fix the underlying labels and affordances before adding more instructional copy.

## Decision

Proceed with a small first-run first-plan experience after a short usability check of the current 1.0 empty states. The right Slate onboarding is a guided first success embedded in the product—not a tour of the product.


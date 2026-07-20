# agentkit learn (skill workflow)

Teach the user what changed in the codebase and help them build durable understanding after an implementation, bug fix, refactor, or agent session.

This workflow is read-only by default. Do not create Markdown notes, edit guidance files, or modify repo state unless the user explicitly asks.

## Preconditions

- Inspect the change context before explaining.
- Prefer current repo facts, diffs, changed files, and test output over memory of the session.
- If there are no visible changes, ask which change, branch, commit, or files the user wants to learn.
- Do not run mutating commands, formatters, code generators, or file writes during learn.

## Non-negotiables

- Teach incrementally; do not dump the whole explanation at once.
- Start by asking the user to restate their current understanding.
- Explain the problem before the solution.
- Cover why, what, and how: motivation, root cause, design choices, business logic, edge cases, validation, and impact.
- Use real code references and short snippets when useful.
- Keep the running learning checklist in the conversation, not in a file, unless the user explicitly asks for notes.
- Check understanding before moving to the next stage, but let the user skip ahead if they ask.

## Procedure

### 1. Build Change Context

Inspect the repository enough to teach accurately.

Use available context such as:

- `git status --short`
- `git diff --stat`
- `git diff`
- changed files relevant to the user's question
- recent commits only when the user asks about committed work or no working-tree diff exists
- test, build, or check output when relevant

Identify:

- What changed
- What problem the change addressed
- Why the problem existed
- What branches, cases, or constraints mattered
- What solution was chosen
- What tradeoffs were accepted
- What edge cases or risks remain
- What tests or checks validate the change
- What broader behavior, workflow, or maintenance impact exists

### 2. Start With The User's Current Understanding

Before teaching, ask a short calibration question:

```md
Before I explain, tell me your current read: what problem do you think we solved, and what changed?
```

Use the answer to fill gaps instead of repeating what the user already understands.

If the user asks for a specific level, adapt to it:

- `ELI5`: plain language and analogies, minimal code
- `ELI14`: plain language plus simple technical terms
- `intern`: practical engineering detail, with code walkthroughs
- `engineer`: concise, precise, tradeoff-aware
- `expert`: focus on invariants, edge cases, and design alternatives

### 3. Teach In Stages

Use this order:

1. Problem
   - What was wrong or missing
   - Why it mattered
   - Why it existed
   - What branches or cases were involved

2. Solution
   - What changed
   - Why this approach was chosen
   - What alternatives were avoided
   - What behavior is now explicit

3. Code walkthrough
   - Important files and functions
   - How data or control flows through the changed code
   - Business logic and edge cases
   - Short snippets or file references where helpful

4. Validation and impact
   - Tests or checks that support the change
   - What users or developers will notice
   - What remains unchanged
   - What follow-up work or risks remain

After each stage, ask the user to restate the key idea or answer a small check question before continuing.

### 4. Maintain A Conversation Checklist

Keep a visible checklist in the conversation:

```md
Learning checklist

- [ ] The original problem and why it existed
- [ ] The main solution and why this design was chosen
- [ ] The changed files and how code flows through them
- [ ] The business logic and edge cases
- [ ] The tests or checks that validate the behavior
- [ ] The broader impact and maintenance implications
```

Mark items as understood only after the user demonstrates understanding or asks to move on.

### 5. Use Code Well

When discussing code:

- Cite real files and line numbers when possible.
- Prefer short snippets over large pasted sections.
- Show before/after comparisons when they clarify the change.
- Trace one important value, branch, or request through the code when useful.
- Avoid overwhelming the user with every changed line.

### 6. Mastery Checks

Use lightweight checks such as:

- "Can you explain why this bug happened in your own words?"
- "What would break if we removed this branch?"
- "Which file would you inspect first if this regressed?"
- "What edge case is this guard protecting?"
- "Why did this solution fit better than the simpler alternative?"

If the user struggles, explain again at a simpler level and ask a narrower question.

### 7. Final Recap

End with a concise recap:

- What changed
- Why it changed
- How it works
- What validates it
- What to watch for
- What the user now understands

Do not create files unless explicitly requested.

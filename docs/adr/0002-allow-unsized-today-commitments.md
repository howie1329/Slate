---
status: accepted
---

# Allow unsized commitments in Today

Slate allows a user to deliberately move an unestimated task into Today. The task remains visible in the active commitment surface with a Needs estimate state, contributes no known minutes to capacity, and is excluded from AI planning until it receives a positive estimate. This preserves user agency when duration is unknown without inventing an estimate or silently hiding the commitment in Backlog.

## Considered Options

- Keep an estimate as a hard prerequisite for entering Today.
- Assign an arbitrary default estimate to every new Today task.

## Consequences

- Capacity must distinguish known remaining minutes from the presence of unsized commitments so remaining capacity is not falsely reassuring.
- Today and Backlog selectors must classify an incomplete task scheduled for today as Today even when its estimate is null.
- Manual movement may commit an unsized task, but AI planning continues to require an estimate.
- Product and persistence tests must cover creation, movement, completion, editing, and return-to-Backlog for unsized Today tasks.

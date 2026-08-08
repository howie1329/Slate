# Slate Planning Context

Slate helps one person decide what work realistically fits into the current day. This context defines the planning language shared by the compact daily surface and the later full-window planning surface.

## Planning surfaces

**Daily workspace**:
The compact menu-bar popover's unified surface for everyday capture, commitment, and completion. Today remains visible and dominant; Backlog and Done provide adjacent context without turning the popover into a project-management board.
_Avoid_: Unified workspace as an unqualified product name, planning workspace

**Planning workspace**:
The future full-window surface for shaping and reviewing a larger pool of work. It complements the Daily workspace and does not replace the popover for ordinary daily planning.
_Avoid_: Daily workspace, board as the product name

## Commitment language

**Today**:
Work the user has deliberately committed to the current local day. A Today task may be sized or unsized; completed Today work may remain visible as history, while unfinished Today work is the active capacity decision.
_Avoid_: automatically rolled-forward work, calendar schedule

**Backlog**:
Captured work that is not currently committed to Today. It may need an estimate, a date decision, or deliberate movement into Today; only sized active work contributes a known minute cost to daily capacity.
_Avoid_: inbox, queue

**Unsized commitment**:
A task deliberately placed in Today before the user knows its duration. It is visible as needing an estimate, does not contribute known minutes to capacity, and is not eligible for AI planning until it is sized.
_Avoid_: zero-minute task, placeholder estimate, draft commitment

**Daily capture**:
A newly typed task from the Daily workspace that is saved to the persisted Backlog by default. Capture records work; an explicit movement action creates a Today commitment.
_Avoid_: capture as commitment, automatic Today placement

**Done**:
Completed work shown as quiet history in the Daily workspace. Done is not a planning destination for incomplete work.
_Avoid_: another commitment state, archive

**Commitment state**:
The meaning of a task in the planning workflow, derived from its estimate, scheduled date, and completion state rather than stored as an independent board status.
_Avoid_: kanban status, workflow column

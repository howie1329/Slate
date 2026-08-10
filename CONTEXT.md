# Slate Planning Context

Slate helps one person decide what work realistically fits into the current day. This context defines the planning language shared by the compact daily surface and the later full-window planning surface.

## Planning surfaces

**Daily workspace**:
The compact menu-bar popover's unified surface for everyday capture, commitment, and completion. Today remains visible and dominant; Backlog and Done provide adjacent context without turning the popover into a project-management board.
_Avoid_: Unified workspace as an unqualified product name, planning workspace

**Planning workspace**:
The distinct full-app surface for shaping and reviewing a larger pool of work. It complements the Daily workspace and does not replace the popover for ordinary daily planning.
_Avoid_: Daily workspace, board as the product name

**Planning workspace shell**:
The full-app composition that frames the Planning workspace: its background, toolbar, navigation, content frame, and global transient layers. It hosts planning views and shared task interactions without defining a separate planning model.
_Avoid_: shell as a synonym for every Planning workspace feature, native window frame

**Full app**:
Slate's dedicated macOS application window. Opening it enters a frameless native full-screen Space; leaving full-screen keeps the window open and movable rather than forcing a return to full-screen.
_Avoid_: enlarged popover, maximized window

**Planning toolbar**:
The persistent top control surface of the Planning workspace shell. It provides search and capture, entry into reviewable AI actions, Planning view selection, and current capacity context without becoming a permanent navigation sidebar.
_Avoid_: native macOS toolbar, second command row

**Workspace status bar**:
The compact bottom edge of the Planning workspace shell, redefined from the Daily workspace utility footer. It is the sole home for Settings access and holds quiet global status or utility actions rather than task content.
_Avoid_: unchanged popover footer, task-detail tray

**Workspace inspector**:
The right-side contextual region of the Planning workspace shell. It shows either task detail or a reviewable AI action without losing the surrounding Planning workspace context.
_Avoid_: modal, bottom review tray, simultaneous task and AI panels

**Task inspector**:
The task-detail mode of the Workspace inspector, used to view and edit the selected task.
_Avoid_: separate task-detail window, bottom task-detail panel

**Planning view**:
An interchangeable presentation of the same Planning workspace. Board and List are local views rather than separate destinations or planning systems.
_Avoid_: top-level workspace, separate board route, separate list route

**Planning lane**:
One of the four exhaustive commitment groupings in the Planning workspace: Capture, Ready, Today, or Done. Every non-deleted task belongs to exactly one lane; filtering or collapsing changes visibility, not lane membership.
_Avoid_: stored status, optional category, filter result

**Lane order**:
The user-controlled order of active work within Capture, Ready, or Today, shared by every Planning view and the Daily workspace's flat Backlog. Date context does not create hidden ordering groups inside a lane.
_Avoid_: automatic urgency sort, view-specific order, date-group order

**Capture lane**:
Active work outside Today that does not yet have an estimate, regardless of when it was captured or the date attached to it. It is a readiness state, not a history of recent capture actions.
_Avoid_: recent captures, inbox, unsized Today commitments

**Ready lane**:
Active estimated work outside Today. It includes unscheduled, overdue, and future-dated work, with date meaning carried as task context rather than additional lanes.
_Avoid_: automatic Today candidate, upcoming lane, overdue lane

## Commitment language

**Today**:
Work the user has deliberately committed to the current local day. A Today task may be sized or unsized; completed Today work may remain visible as history, while unfinished Today work is the active capacity decision.
_Avoid_: automatically rolled-forward work, calendar schedule

**Backlog**:
Captured work that is not currently committed to Today. It may need an estimate, a date decision, or deliberate movement into Today; only sized active work contributes a known minute cost to daily capacity.
_Avoid_: inbox, queue

**Unsized commitment**:
A task deliberately moved directly from Capture into Today before the user knows its duration. It is visible as needing an estimate, does not contribute known minutes to capacity, and is not eligible for AI planning until it is sized.
_Avoid_: zero-minute task, placeholder estimate, draft commitment

**Plan candidate**:
A Ready task that Plan My Day may propose for Today. It is estimated and either unscheduled or overdue; future-dated Ready work remains outside AI planning eligibility.
_Avoid_: every Ready task, future commitment, automatic commitment

**Daily capture**:
A newly typed task from the Daily workspace that is saved to the persisted Backlog by default. Capture records work; an explicit movement action creates a Today commitment.
_Avoid_: capture as commitment, automatic Today placement

**Done**:
Completed work shown as quiet history, ordered with the most recently completed work first. In the Planning workspace it is an exhaustive lane for completed tasks and is visually secondary by default; it is never a planning destination for incomplete work.
_Avoid_: another commitment state, archive

**Reopen**:
The return of completed work to active planning while retaining its estimate and scheduled date. Its active Planning lane is rederived from those current facts rather than remembered separately.
_Avoid_: restore previous lane, reset task, duplicate task

**Commitment state**:
The meaning of a task in the planning workflow, derived from its estimate, scheduled date, and completion state rather than stored as an independent board status.
_Avoid_: kanban status, workflow column

## Implementation boundary

**Planning projection**:
The native, SQLite-derived read model that authoritatively classifies and orders Today and Backlog tasks, calculates capacity, supplies reorder guards, and produces Plan My Day facts. Renderer code may filter and present this projection but does not recreate its planning rules.
_Avoid_: renderer-owned task classification, raw persistence scopes as UI state

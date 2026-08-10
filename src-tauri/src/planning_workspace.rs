use std::collections::HashMap;

use chrono::NaiveDate;
use rusqlite::{params, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};

use crate::persistence::{insert_event, Task, TaskEventState, TaskRevision};

pub(crate) const CAPTURE_SCOPE: &str = "planning:capture";
pub(crate) const READY_SCOPE: &str = "planning:ready";

pub(crate) const NEEDS_ESTIMATE_SCOPE: &str = "log:needs-estimate";
pub(crate) const UNSCHEDULED_SCOPE: &str = "log:unscheduled";
pub(crate) const OVERDUE_SCOPE: &str = "log:overdue";
pub(crate) const UPCOMING_SCOPE: &str = "log:upcoming";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PlanningLane {
    Capture,
    Ready,
    Today,
    Done,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum WorkspaceBadge {
    NeedsEstimate,
    Unscheduled,
    Overdue,
    Upcoming,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PlanningTask {
    #[serde(flatten)]
    pub(crate) task: Task,
    pub(crate) badges: Vec<WorkspaceBadge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReorderGuard {
    pub(crate) scope: String,
    pub(crate) expected_revisions: Vec<TaskRevision>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PlanningSection {
    pub(crate) tasks: Vec<PlanningTask>,
    pub(crate) reorder: Option<ReorderGuard>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PlanningLaneCounts {
    pub(crate) capture: usize,
    pub(crate) ready: usize,
    pub(crate) today: usize,
    pub(crate) done: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PlanningLanes {
    pub(crate) capture: PlanningSection,
    pub(crate) ready: PlanningSection,
    pub(crate) today: PlanningSection,
    pub(crate) done: PlanningSection,
    pub(crate) counts: PlanningLaneCounts,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CapacityView {
    pub(crate) limit_minutes: i64,
    pub(crate) committed_minutes: i64,
    pub(crate) remaining_minutes: i64,
    pub(crate) overage_minutes: i64,
    pub(crate) is_over_capacity: bool,
    pub(crate) overflow_task_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PlanningView {
    pub(crate) lanes: PlanningLanes,
    pub(crate) capacity: CapacityView,
}

struct PlanningState<'a> {
    capture: Vec<&'a Task>,
    ready: Vec<&'a Task>,
    today: Vec<&'a Task>,
    done: Vec<&'a Task>,
}

pub(crate) struct PlanningWorkspace<'a> {
    tasks: &'a [Task],
    order_by_scope: &'a HashMap<String, Vec<String>>,
    today: &'a str,
    effective_capacity_minutes: i64,
}

impl<'a> PlanningWorkspace<'a> {
    pub(crate) fn new(
        tasks: &'a [Task],
        order_by_scope: &'a HashMap<String, Vec<String>>,
        today: &'a str,
        effective_capacity_minutes: i64,
    ) -> Self {
        Self {
            tasks,
            order_by_scope,
            today,
            effective_capacity_minutes,
        }
    }

    pub(crate) fn view(&self) -> PlanningView {
        let state = self.state();
        let today_scope = today_scope(self.today);
        let capacity = capacity_view(&state.today, self.effective_capacity_minutes);

        let lanes = PlanningLanes {
            capture: self.section(&state.capture, Some(CAPTURE_SCOPE.into())),
            ready: self.section(&state.ready, Some(READY_SCOPE.into())),
            today: self.section(&state.today, Some(today_scope)),
            done: self.section(&state.done, None),
            counts: PlanningLaneCounts {
                capture: state.capture.len(),
                ready: state.ready.len(),
                today: state.today.len(),
                done: state.done.len(),
            },
        };

        PlanningView { lanes, capacity }
    }

    pub(crate) fn ordered_active(&self, scope: &str) -> Vec<&'a Task> {
        ordered_tasks(self.tasks, self.order_by_scope, scope, self.today)
    }

    pub(crate) fn today_active(&self) -> Vec<&'a Task> {
        self.state().today
    }

    pub(crate) fn plan_candidates(&self) -> Vec<PlanCandidate<'a>> {
        self.state()
            .ready
            .into_iter()
            .enumerate()
            .filter_map(|(position, task)| {
                let scheduled_date = task.scheduled_date.as_deref();
                if scheduled_date.is_some_and(|date| date >= self.today) {
                    return None;
                }
                task.estimate_minutes.map(|estimate_minutes| PlanCandidate {
                    task,
                    estimate_minutes,
                    source_scope: READY_SCOPE,
                    backlog_position: position,
                })
            })
            .collect()
    }

    pub(crate) fn remaining_minutes(&self) -> i64 {
        let committed = self
            .state()
            .today
            .into_iter()
            .filter_map(|task| task.estimate_minutes)
            .fold(0_i64, i64::saturating_add);
        self.effective_capacity_minutes
            .saturating_sub(committed)
            .max(0)
    }

    pub(crate) fn plan_context(&self) -> PlanningContext<'a> {
        PlanningContext {
            today_tasks: self.today_active(),
            candidates: self.plan_candidates(),
            remaining_minutes: self.remaining_minutes(),
        }
    }

    pub(crate) fn reconcile_task(
        transaction: &Transaction<'_>,
        before: &TaskEventState,
        after: &TaskEventState,
        today: &str,
        source: &str,
        operation_id: &str,
    ) -> Result<(), String> {
        let previous_scope = active_scope(
            before.estimate_minutes,
            before.scheduled_date.as_deref(),
            today,
        );
        let destination_scope = active_scope(
            after.estimate_minutes,
            after.scheduled_date.as_deref(),
            today,
        );
        let active_before = before.completed_at.is_none();
        let active_after = after.completed_at.is_none();

        if !active_after {
            remove_task_order(transaction, &after.id)?;
        } else if !active_before || previous_scope != destination_scope {
            move_task_to_scope_start(transaction, &after.id, &destination_scope)?;
        }

        let before_json = serde_json::to_value(before).map_err(json_error)?;
        let after_json = serde_json::to_value(after).map_err(json_error)?;
        insert_event(
            transaction,
            Some(&after.id),
            task_event_kind(before, after, today),
            source,
            operation_id,
            Some(&before_json),
            Some(&after_json),
        )
    }

    pub(crate) fn record_created_task(
        transaction: &Transaction<'_>,
        task: &TaskEventState,
        source: &str,
        operation_id: &str,
    ) -> Result<(), String> {
        let after_json = serde_json::to_value(task).map_err(json_error)?;
        insert_event(
            transaction,
            Some(&task.id),
            "task-created",
            source,
            operation_id,
            None,
            Some(&after_json),
        )
    }

    pub(crate) fn record_deleted_task(
        transaction: &Transaction<'_>,
        task: &TaskEventState,
        source: &str,
        operation_id: &str,
    ) -> Result<(), String> {
        let before_json = serde_json::to_value(task).map_err(json_error)?;
        insert_event(
            transaction,
            Some(&task.id),
            "task-deleted",
            source,
            operation_id,
            Some(&before_json),
            None,
        )?;
        remove_task_order(transaction, &task.id)
    }

    pub(crate) fn replace_order(
        transaction: &Transaction<'_>,
        guard: &ReorderGuard,
        task_ids: &[String],
        today: &str,
        source: &str,
        operation_id: &str,
    ) -> Result<(), String> {
        validate_reorder_scope(&guard.scope)?;
        ensure_unique_ids(task_ids)?;
        let current_ids = validate_reorder_guard(transaction, guard, task_ids, today)?;
        let before_states = task_ids
            .iter()
            .map(|task_id| task_event_state(transaction, task_id))
            .collect::<Result<Vec<_>, _>>()?;
        replace_order_rows(transaction, &guard.scope, task_ids)?;
        for (position, before) in before_states.into_iter().enumerate() {
            transaction
                .execute(
                    "UPDATE tasks SET revision = revision + 1 WHERE id = ?1 AND revision = ?2",
                    params![before.id, before.revision],
                )
                .map_err(database_error)?;
            let after = task_event_state(transaction, &before.id)?;
            let before_position = current_ids
                .iter()
                .position(|task_id| task_id == &before.id)
                .unwrap_or(position);
            let before_json = serde_json::json!({
                "task": serde_json::to_value(&before).map_err(json_error)?,
                "scope": guard.scope.as_str(),
                "position": before_position,
            });
            let after_json = serde_json::json!({
                "task": serde_json::to_value(&after).map_err(json_error)?,
                "scope": guard.scope.as_str(),
                "position": position,
            });
            insert_event(
                transaction,
                Some(&before.id),
                "task-reordered",
                source,
                operation_id,
                Some(&before_json),
                Some(&after_json),
            )?;
        }
        Ok(())
    }

    pub(crate) fn replace_today_order(
        transaction: &Transaction<'_>,
        today: &str,
        task_ids: &[String],
    ) -> Result<(), String> {
        replace_order_rows(transaction, &today_scope(today), task_ids)
    }

    pub(crate) fn today_state(
        transaction: &Transaction<'_>,
        today: &str,
        capacity_minutes: i64,
    ) -> Result<PlanningTodayState, String> {
        let task_ids = scope_task_ids(transaction, &today_scope(today), today)?;
        let mut task_revisions = Vec::with_capacity(task_ids.len());
        let mut committed_minutes = 0_i64;
        for task_id in &task_ids {
            let (revision, estimate_minutes) = transaction
                .query_row(
                    "SELECT revision, estimate_minutes FROM tasks WHERE id = ?1",
                    [task_id],
                    |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Option<i64>>(1)?)),
                )
                .map_err(database_error)?;
            task_revisions.push(TaskRevision {
                id: task_id.clone(),
                revision,
            });
            if let Some(estimate_minutes) = estimate_minutes {
                committed_minutes = committed_minutes.saturating_add(estimate_minutes);
            }
        }

        Ok(PlanningTodayState {
            task_ids,
            task_revisions,
            committed_minutes,
            remaining_minutes: capacity_minutes.saturating_sub(committed_minutes).max(0),
        })
    }

    fn state(&self) -> PlanningState<'a> {
        PlanningState {
            capture: self.ordered_active(CAPTURE_SCOPE),
            ready: self.ordered_active(READY_SCOPE),
            today: self.ordered_active(&today_scope(self.today)),
            done: completed_tasks(self.tasks),
        }
    }

    fn section(&self, tasks: &[&Task], scope: Option<String>) -> PlanningSection {
        PlanningSection {
            tasks: tasks.iter().map(|task| self.planning_task(task)).collect(),
            reorder: scope.map(|scope| ReorderGuard {
                scope,
                expected_revisions: tasks
                    .iter()
                    .map(|task| TaskRevision {
                        id: task.id.clone(),
                        revision: task.revision,
                    })
                    .collect(),
            }),
        }
    }

    fn planning_task(&self, task: &Task) -> PlanningTask {
        let lane = planning_lane(task, self.today);
        let mut badges = Vec::new();
        if lane != PlanningLane::Done && task.estimate_minutes.is_none() {
            badges.push(WorkspaceBadge::NeedsEstimate);
        }
        if lane != PlanningLane::Done && lane != PlanningLane::Today {
            match task.scheduled_date.as_deref() {
                None => badges.push(WorkspaceBadge::Unscheduled),
                Some(date) if date < self.today => badges.push(WorkspaceBadge::Overdue),
                Some(date) if date > self.today => badges.push(WorkspaceBadge::Upcoming),
                Some(_) => {}
            }
        }
        PlanningTask {
            task: task.clone(),
            badges,
        }
    }
}

pub(crate) struct PlanningContext<'a> {
    pub(crate) today_tasks: Vec<&'a Task>,
    pub(crate) candidates: Vec<PlanCandidate<'a>>,
    pub(crate) remaining_minutes: i64,
}

pub(crate) struct PlanningTodayState {
    pub(crate) task_ids: Vec<String>,
    pub(crate) task_revisions: Vec<TaskRevision>,
    pub(crate) committed_minutes: i64,
    pub(crate) remaining_minutes: i64,
}

pub(crate) struct PlanCandidate<'a> {
    pub(crate) task: &'a Task,
    pub(crate) estimate_minutes: i64,
    pub(crate) source_scope: &'static str,
    pub(crate) backlog_position: usize,
}

pub(crate) fn today_scope(today: &str) -> String {
    format!("today:{today}")
}

fn active_scope(
    estimate_minutes: Option<i64>,
    scheduled_date: Option<&str>,
    today: &str,
) -> String {
    match scheduled_date {
        Some(date) if date == today => today_scope(today),
        _ if estimate_minutes.is_none() => CAPTURE_SCOPE.into(),
        _ => READY_SCOPE.into(),
    }
}

fn task_event_kind(before: &TaskEventState, after: &TaskEventState, today: &str) -> &'static str {
    if before.completed_at != after.completed_at {
        return if after.completed_at.is_some() {
            "task-completed"
        } else {
            "task-reopened"
        };
    }
    if before.scheduled_date != after.scheduled_date
        && after.scheduled_date.as_deref() == Some(today)
    {
        return "task-committed";
    }
    if before.scheduled_date.is_some() && after.scheduled_date.is_none() {
        return "task-returned-to-backlog";
    }
    if before.anchor_date != after.anchor_date {
        return if after.anchor_date.is_some() {
            "task-anchored"
        } else {
            "task-unanchored"
        };
    }
    "task-updated"
}

fn ensure_unique_ids(task_ids: &[String]) -> Result<(), String> {
    let mut unique_ids = std::collections::HashSet::new();
    if task_ids.iter().all(|task_id| unique_ids.insert(task_id)) {
        Ok(())
    } else {
        Err("Task order contains duplicate tasks.".into())
    }
}

fn validate_reorder_scope(scope: &str) -> Result<(), String> {
    if scope == CAPTURE_SCOPE
        || scope == READY_SCOPE
        || scope.strip_prefix("today:").is_some_and(|date| {
            NaiveDate::parse_from_str(date, "%Y-%m-%d")
                .map(|parsed| parsed.format("%Y-%m-%d").to_string() == date)
                .unwrap_or(false)
        })
    {
        Ok(())
    } else {
        Err("Task ordering scope is invalid.".into())
    }
}

fn scope_task_ids(
    connection: &Transaction<'_>,
    scope: &str,
    today: &str,
) -> Result<Vec<String>, String> {
    let mut statement = connection
        .prepare(
            "SELECT t.id, t.estimate_minutes, t.scheduled_date, t.completed_at
             FROM tasks t
             LEFT JOIN task_orders o ON o.task_id = t.id AND o.scope = ?1
             ORDER BY COALESCE(o.position, 9223372036854775807) ASC, t.created_at ASC, t.id ASC",
        )
        .map_err(database_error)?;
    let rows = statement
        .query_map([scope], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<i64>>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
            ))
        })
        .map_err(database_error)?;
    let mut ids = Vec::new();
    for row in rows {
        let (id, estimate, scheduled_date, completed_at) = row.map_err(database_error)?;
        if completed_at.is_none()
            && active_scope(estimate, scheduled_date.as_deref(), today) == scope
        {
            ids.push(id);
        }
    }
    Ok(ids)
}

fn move_task_to_scope_start(
    transaction: &Transaction<'_>,
    task_id: &str,
    scope: &str,
) -> Result<(), String> {
    transaction
        .execute("DELETE FROM task_orders WHERE task_id = ?1", [task_id])
        .map_err(database_error)?;
    transaction
        .execute(
            "UPDATE task_orders SET position = position + 1 WHERE scope = ?1",
            [scope],
        )
        .map_err(database_error)?;
    transaction
        .execute(
            "INSERT INTO task_orders (scope, task_id, position) VALUES (?1, ?2, 0)",
            params![scope, task_id],
        )
        .map_err(database_error)?;
    Ok(())
}

fn remove_task_order(transaction: &Transaction<'_>, task_id: &str) -> Result<(), String> {
    transaction
        .execute("DELETE FROM task_orders WHERE task_id = ?1", [task_id])
        .map_err(database_error)?;
    Ok(())
}

fn replace_order_rows(
    transaction: &Transaction<'_>,
    scope: &str,
    task_ids: &[String],
) -> Result<(), String> {
    transaction
        .execute("DELETE FROM task_orders WHERE scope = ?1", [scope])
        .map_err(database_error)?;
    for (position, task_id) in task_ids.iter().enumerate() {
        transaction
            .execute(
                "INSERT INTO task_orders (scope, task_id, position) VALUES (?1, ?2, ?3)",
                params![scope, task_id, position as i64],
            )
            .map_err(database_error)?;
    }
    Ok(())
}

fn task_event_state(
    transaction: &Transaction<'_>,
    task_id: &str,
) -> Result<TaskEventState, String> {
    transaction
        .query_row(
            "SELECT id, title, estimate_minutes, scheduled_date, completed_at, revision, anchor_date
             FROM tasks WHERE id = ?1",
            [task_id],
            |row| {
                Ok(TaskEventState {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    estimate_minutes: row.get(2)?,
                    scheduled_date: row.get(3)?,
                    completed_at: row.get(4)?,
                    revision: row.get(5)?,
                    anchor_date: row.get(6)?,
                })
            },
        )
        .optional()
        .map_err(database_error)?
        .ok_or_else(|| "Task was not found.".into())
}

fn validate_reorder_guard(
    transaction: &Transaction<'_>,
    guard: &ReorderGuard,
    requested_ids: &[String],
    today: &str,
) -> Result<Vec<String>, String> {
    let current_ids = scope_task_ids(transaction, &guard.scope, today)?;
    let mut current_membership = current_ids.clone();
    let mut requested_membership = requested_ids.to_vec();
    current_membership.sort();
    requested_membership.sort();
    if current_membership != requested_membership {
        return Err("stale-task-order".into());
    }

    let expected = guard
        .expected_revisions
        .iter()
        .map(|item| (item.id.as_str(), item.revision))
        .collect::<HashMap<_, _>>();
    if expected.len() != guard.expected_revisions.len() || expected.len() != requested_ids.len() {
        return Err("stale-task-order".into());
    }

    for task_id in requested_ids {
        let revision = transaction
            .query_row(
                "SELECT revision FROM tasks WHERE id = ?1",
                [task_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(database_error)?
            .ok_or_else(|| "stale-task-order".to_string())?;
        if expected.get(task_id.as_str()).copied() != Some(revision) {
            return Err("stale-task-order".into());
        }
    }

    Ok(current_ids)
}

fn planning_lane(task: &Task, today: &str) -> PlanningLane {
    if task.completed_at.is_some() {
        PlanningLane::Done
    } else if task.scheduled_date.as_deref() == Some(today) {
        PlanningLane::Today
    } else if task.estimate_minutes.is_none() {
        PlanningLane::Capture
    } else {
        PlanningLane::Ready
    }
}

fn completed_tasks<'a>(tasks: &'a [Task]) -> Vec<&'a Task> {
    let mut completed = tasks
        .iter()
        .filter(|task| task.completed_at.is_some())
        .collect::<Vec<_>>();
    completed.sort_by(|first, second| {
        second
            .completed_at
            .cmp(&first.completed_at)
            .then_with(|| second.created_at.cmp(&first.created_at))
            .then_with(|| second.id.cmp(&first.id))
    });
    completed
}

fn ordered_tasks<'a>(
    tasks: &'a [Task],
    order_by_scope: &HashMap<String, Vec<String>>,
    scope: &str,
    today: &str,
) -> Vec<&'a Task> {
    let positions = order_by_scope
        .get(scope)
        .into_iter()
        .flat_map(|task_ids| task_ids.iter().enumerate())
        .map(|(position, task_id)| (task_id.as_str(), position))
        .collect::<HashMap<_, _>>();
    let mut scoped_tasks = tasks
        .iter()
        .filter(|task| planning_lane(task, today) != PlanningLane::Done)
        .filter(|task| {
            active_scope(task.estimate_minutes, task.scheduled_date.as_deref(), today) == scope
        })
        .collect::<Vec<_>>();
    scoped_tasks.sort_by(|first, second| {
        positions
            .get(first.id.as_str())
            .copied()
            .unwrap_or(usize::MAX)
            .cmp(
                &positions
                    .get(second.id.as_str())
                    .copied()
                    .unwrap_or(usize::MAX),
            )
            .then_with(|| first.created_at.cmp(&second.created_at))
            .then_with(|| first.id.cmp(&second.id))
    });
    scoped_tasks
}

fn capacity_view(tasks: &[&Task], limit_minutes: i64) -> CapacityView {
    let mut committed_minutes = 0_i64;
    let mut overflow_task_id = None;
    for task in tasks {
        let Some(estimate) = task.estimate_minutes else {
            continue;
        };
        if estimate <= 0 {
            continue;
        }
        committed_minutes = committed_minutes.saturating_add(estimate);
        if overflow_task_id.is_none() && committed_minutes > limit_minutes {
            overflow_task_id = Some(task.id.clone());
        }
    }
    let overage_minutes = committed_minutes.saturating_sub(limit_minutes).max(0);
    CapacityView {
        limit_minutes,
        committed_minutes,
        remaining_minutes: limit_minutes.saturating_sub(committed_minutes).max(0),
        overage_minutes,
        is_over_capacity: overage_minutes > 0,
        overflow_task_id,
    }
}

fn database_error(error: rusqlite::Error) -> String {
    format!("Local planner database error: {error}")
}

fn json_error(error: serde_json::Error) -> String {
    format!("Local planner history error: {error}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn task(
        id: &str,
        estimate_minutes: Option<i64>,
        scheduled_date: Option<&str>,
        completed_at: Option<&str>,
    ) -> Task {
        Task {
            id: id.into(),
            title: id.into(),
            estimate_minutes,
            scheduled_date: scheduled_date.map(str::to_string),
            created_at: format!("2026-08-09T00:00:0{id}Z"),
            completed_at: completed_at.map(str::to_string),
            revision: 1,
            anchor_date: None,
        }
    }

    fn task_event_state(
        id: &str,
        estimate_minutes: Option<i64>,
        scheduled_date: Option<&str>,
        completed_at: Option<&str>,
        revision: i64,
    ) -> TaskEventState {
        TaskEventState {
            id: id.into(),
            title: id.into(),
            estimate_minutes,
            scheduled_date: scheduled_date.map(str::to_string),
            completed_at: completed_at.map(str::to_string),
            revision,
            anchor_date: None,
        }
    }

    fn planning_database() -> Connection {
        let connection = Connection::open_in_memory().expect("open planning database");
        connection
            .execute_batch(
                "CREATE TABLE tasks (
                   id TEXT PRIMARY KEY,
                   title TEXT NOT NULL,
                   estimate_minutes INTEGER,
                   scheduled_date TEXT,
                   completed_at TEXT,
                   revision INTEGER NOT NULL,
                   anchor_date TEXT,
                   created_at TEXT NOT NULL
                 );
                 CREATE TABLE task_orders (
                   scope TEXT NOT NULL,
                   task_id TEXT NOT NULL,
                   position INTEGER NOT NULL,
                   PRIMARY KEY (scope, task_id)
                 );
                 CREATE TABLE planner_events (
                   id TEXT PRIMARY KEY,
                   task_id TEXT,
                   local_date TEXT NOT NULL,
                   occurred_at TEXT NOT NULL,
                   kind TEXT NOT NULL,
                   source TEXT NOT NULL,
                   operation_id TEXT NOT NULL,
                   before_json TEXT,
                   after_json TEXT
                 );",
            )
            .expect("create planning schema");
        connection
    }

    #[test]
    fn projects_unsized_today_without_counting_it_toward_capacity() {
        let tasks = vec![
            task("1", None, Some("2026-08-09"), None),
            task("2", Some(90), Some("2026-08-09"), None),
        ];
        let orders = HashMap::new();
        let state = PlanningWorkspace::new(&tasks, &orders, "2026-08-09", 60);
        let view = state.view();

        assert_eq!(view.lanes.today.tasks.len(), 2);
        assert_eq!(view.lanes.counts.today, 2);
        assert_eq!(view.capacity.committed_minutes, 90);
        assert_eq!(view.capacity.overage_minutes, 30);
        assert_eq!(view.capacity.overflow_task_id.as_deref(), Some("2"));
        assert_eq!(state.today_active().len(), 2);
    }

    #[test]
    fn projects_exhaustive_derived_lanes() {
        let tasks = vec![
            task("capture", None, None, None),
            task("overdue", Some(30), Some("2026-08-08"), None),
            task("upcoming", Some(30), Some("2026-08-10"), None),
            task("today", Some(30), Some("2026-08-09"), None),
            task("done", None, None, Some("2026-08-09T12:00:00Z")),
        ];
        let orders = HashMap::new();
        let state = PlanningWorkspace::new(&tasks, &orders, "2026-08-09", 120);
        let view = state.view();

        assert_eq!(view.lanes.counts.capture, 1);
        assert_eq!(view.lanes.counts.ready, 2);
        assert_eq!(view.lanes.counts.today, 1);
        assert_eq!(view.lanes.counts.done, 1);
        assert_eq!(
            view.lanes
                .capture
                .tasks
                .iter()
                .chain(view.lanes.ready.tasks.iter())
                .map(|task| task.task.id.as_str())
                .collect::<Vec<_>>(),
            vec!["capture", "overdue", "upcoming"]
        );
        assert_eq!(
            view.lanes.ready.tasks[0].badges,
            vec![WorkspaceBadge::Overdue]
        );
    }

    #[test]
    fn plan_candidates_are_a_filtered_ready_projection() {
        let tasks = vec![
            task("future", Some(30), Some("2026-08-10"), None),
            task("unscheduled", Some(30), None, None),
            task("overdue", Some(30), Some("2026-08-08"), None),
            task("capture", None, None, None),
        ];
        let orders = HashMap::from([(
            READY_SCOPE.into(),
            vec!["future".into(), "overdue".into(), "unscheduled".into()],
        )]);
        let state = PlanningWorkspace::new(&tasks, &orders, "2026-08-09", 120);
        let candidates = state.plan_candidates();

        assert_eq!(
            candidates
                .iter()
                .map(|candidate| candidate.task.id.as_str())
                .collect::<Vec<_>>(),
            vec!["overdue", "unscheduled"]
        );
        assert_eq!(candidates[0].source_scope, READY_SCOPE);
        assert_eq!(candidates[0].backlog_position, 1);
    }

    #[test]
    fn done_is_ordered_by_completion_recency() {
        let tasks = vec![
            task("older", Some(30), None, Some("2026-08-09T10:00:00Z")),
            task("newer", Some(30), None, Some("2026-08-09T11:00:00Z")),
        ];
        let orders = HashMap::new();
        let state = PlanningWorkspace::new(&tasks, &orders, "2026-08-09", 120);

        assert_eq!(state.view().lanes.done.tasks[0].task.id, "newer");
    }

    #[test]
    fn changing_the_local_date_rederives_membership_without_reordering_ready_work() {
        let tasks = vec![
            task("yesterday", Some(30), Some("2026-08-09"), None),
            task("ready", Some(30), None, None),
        ];
        let orders = HashMap::from([(READY_SCOPE.into(), vec!["ready".into()])]);
        let state = PlanningWorkspace::new(&tasks, &orders, "2026-08-10", 120);

        assert_eq!(
            state
                .view()
                .lanes
                .ready
                .tasks
                .iter()
                .map(|task| task.task.id.as_str())
                .collect::<Vec<_>>(),
            vec!["ready", "yesterday"]
        );
        assert_eq!(
            state.view().lanes.ready.tasks[1]
                .task
                .scheduled_date
                .as_deref(),
            Some("2026-08-09")
        );
    }

    #[test]
    fn canonical_projection_contains_each_task_once() {
        let tasks = vec![
            task("capture", None, None, None),
            task("ready", Some(30), None, None),
            task("today", Some(30), Some("2026-08-09"), None),
            task("done", Some(30), None, Some("2026-08-09T12:00:00Z")),
        ];
        let orders = HashMap::new();
        let view = PlanningWorkspace::new(&tasks, &orders, "2026-08-09", 120).view();

        let task_ids = view
            .lanes
            .capture
            .tasks
            .iter()
            .chain(view.lanes.ready.tasks.iter())
            .chain(view.lanes.today.tasks.iter())
            .chain(view.lanes.done.tasks.iter())
            .map(|task| task.task.id.as_str())
            .collect::<Vec<_>>();

        assert_eq!(task_ids, vec!["capture", "ready", "today", "done"]);
        assert_eq!(view.lanes.counts.capture, 1);
        assert_eq!(view.lanes.counts.ready, 1);
        assert_eq!(view.lanes.counts.today, 1);
        assert_eq!(view.lanes.counts.done, 1);
    }

    #[test]
    fn reconcile_task_owns_lane_order_and_event_semantics() {
        let mut connection = planning_database();
        connection
            .execute(
                "INSERT INTO task_orders (scope, task_id, position) VALUES (?1, ?2, 0)",
                params![CAPTURE_SCOPE, "moved"],
            )
            .expect("insert capture order");
        connection
            .execute(
                "INSERT INTO task_orders (scope, task_id, position) VALUES (?1, ?2, 0)",
                params![READY_SCOPE, "existing"],
            )
            .expect("insert ready order");
        let transaction = connection.transaction().expect("begin transaction");
        let before = task_event_state("moved", None, None, None, 1);
        let after = task_event_state("moved", Some(30), None, None, 2);

        PlanningWorkspace::reconcile_task(
            &transaction,
            &before,
            &after,
            "2026-08-10",
            "manual",
            "operation",
        )
        .expect("reconcile task");
        let ready_ids = transaction
            .prepare("SELECT task_id FROM task_orders WHERE scope = ?1 ORDER BY position")
            .expect("prepare order query")
            .query_map([READY_SCOPE], |row| row.get::<_, String>(0))
            .expect("query ready order")
            .collect::<Result<Vec<_>, _>>()
            .expect("collect ready order");

        assert_eq!(
            transaction
                .query_row("SELECT kind FROM planner_events", [], |row| row
                    .get::<_, String>(0))
                .expect("read event kind"),
            "task-updated"
        );
        assert_eq!(ready_ids, vec!["moved", "existing"]);
        assert_eq!(
            transaction
                .query_row(
                    "SELECT COUNT(*) FROM task_orders WHERE scope = ?1",
                    [CAPTURE_SCOPE],
                    |row| row.get::<_, i64>(0),
                )
                .expect("count capture order"),
            0
        );
    }

    #[test]
    fn today_state_and_reorder_share_one_sqlite_seam() {
        let mut connection = planning_database();
        for (position, (id, estimate)) in [("first", Some(30)), ("second", None)]
            .into_iter()
            .enumerate()
        {
            connection
                .execute(
                    "INSERT INTO tasks
                     (id, title, estimate_minutes, scheduled_date, completed_at, revision, anchor_date, created_at)
                     VALUES (?1, ?1, ?2, '2026-08-10', NULL, 1, NULL, ?3)",
                    params![id, estimate, format!("2026-08-10T00:00:0{position}Z")],
                )
                .expect("insert today task");
            connection
                .execute(
                    "INSERT INTO task_orders (scope, task_id, position) VALUES (?1, ?2, ?3)",
                    params![today_scope("2026-08-10"), id, position as i64],
                )
                .expect("insert today order");
        }
        let transaction = connection.transaction().expect("begin transaction");
        let state = PlanningWorkspace::today_state(&transaction, "2026-08-10", 120)
            .expect("read today state");
        let guard = ReorderGuard {
            scope: today_scope("2026-08-10"),
            expected_revisions: state.task_revisions.clone(),
        };

        PlanningWorkspace::replace_order(
            &transaction,
            &guard,
            &["second".into(), "first".into()],
            "2026-08-10",
            "manual",
            "operation",
        )
        .expect("replace today order");

        assert_eq!(state.task_ids, vec!["first", "second"]);
        assert_eq!(state.committed_minutes, 30);
        assert_eq!(state.remaining_minutes, 90);
        assert_eq!(
            scope_task_ids(&transaction, &today_scope("2026-08-10"), "2026-08-10")
                .expect("read reordered ids"),
            vec!["second", "first"]
        );
        assert_eq!(
            transaction
                .query_row("SELECT COUNT(*) FROM planner_events", [], |row| row
                    .get::<_, i64>(0))
                .expect("count reorder events"),
            2
        );
    }
}

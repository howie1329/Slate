use std::collections::HashMap;

use rusqlite::{params, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};

use crate::persistence::{Task, TaskRevision};

pub(crate) const NEEDS_ESTIMATE_SCOPE: &str = "log:needs-estimate";
pub(crate) const UNSCHEDULED_SCOPE: &str = "log:unscheduled";
pub(crate) const OVERDUE_SCOPE: &str = "log:overdue";
pub(crate) const UPCOMING_SCOPE: &str = "log:upcoming";

const BACKLOG_SCOPES: [&str; 4] = [
    NEEDS_ESTIMATE_SCOPE,
    OVERDUE_SCOPE,
    UPCOMING_SCOPE,
    UNSCHEDULED_SCOPE,
];

#[derive(Debug, Clone, Serialize)]
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
pub(crate) struct TodayPlanningView {
    pub(crate) active: PlanningSection,
    pub(crate) completed: PlanningSection,
    pub(crate) capacity: CapacityView,
    pub(crate) total_task_count: usize,
    pub(crate) unsized_task_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BacklogPlanningView {
    pub(crate) active: PlanningSection,
    pub(crate) completed: PlanningSection,
    pub(crate) total_task_count: usize,
    pub(crate) active_task_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PlanningView {
    pub(crate) today: TodayPlanningView,
    pub(crate) backlog: BacklogPlanningView,
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
        let today_scope = today_scope(self.today);
        let today_active = self.ordered_active(&today_scope);
        let today_completed = self.completed_tasks(true);
        let backlog_active = BACKLOG_SCOPES
            .iter()
            .flat_map(|scope| self.ordered_active(scope))
            .collect::<Vec<_>>();
        let backlog_completed = self.completed_tasks(false);
        let capacity = capacity_view(&today_active, self.effective_capacity_minutes);
        let unsized_task_count = today_active
            .iter()
            .filter(|task| task.estimate_minutes.is_none())
            .count();

        PlanningView {
            today: TodayPlanningView {
                active: PlanningSection {
                    tasks: today_active
                        .iter()
                        .map(|task| self.planning_task(task, true))
                        .collect(),
                    reorder: Some(ReorderGuard {
                        scope: today_scope,
                        expected_revisions: today_active
                            .iter()
                            .map(|task| TaskRevision {
                                id: task.id.clone(),
                                revision: task.revision,
                            })
                            .collect(),
                    }),
                },
                completed: PlanningSection {
                    tasks: today_completed
                        .iter()
                        .map(|task| self.planning_task(task, true))
                        .collect(),
                    reorder: None,
                },
                capacity,
                total_task_count: today_active.len() + today_completed.len(),
                unsized_task_count,
            },
            backlog: BacklogPlanningView {
                active: PlanningSection {
                    tasks: backlog_active
                        .iter()
                        .map(|task| self.planning_task(task, false))
                        .collect(),
                    reorder: None,
                },
                completed: PlanningSection {
                    tasks: backlog_completed
                        .iter()
                        .map(|task| self.planning_task(task, false))
                        .collect(),
                    reorder: None,
                },
                total_task_count: backlog_active.len() + backlog_completed.len(),
                active_task_count: backlog_active.len(),
            },
        }
    }

    pub(crate) fn ordered_active(&self, scope: &str) -> Vec<&'a Task> {
        ordered_tasks(self.tasks, self.order_by_scope, scope, self.today)
    }

    pub(crate) fn today_active(&self) -> Vec<&'a Task> {
        self.ordered_active(&today_scope(self.today))
    }

    pub(crate) fn plan_candidates(&self) -> Vec<PlanCandidate<'a>> {
        [UNSCHEDULED_SCOPE, OVERDUE_SCOPE]
            .into_iter()
            .flat_map(|scope| {
                self.ordered_active(scope)
                    .into_iter()
                    .enumerate()
                    .filter_map(move |(position, task)| {
                        task.estimate_minutes.map(|estimate_minutes| PlanCandidate {
                            task,
                            estimate_minutes,
                            source_scope: scope,
                            backlog_position: position,
                        })
                    })
            })
            .collect()
    }

    pub(crate) fn remaining_minutes(&self) -> i64 {
        let committed = self
            .today_active()
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

    pub(crate) fn apply(
        transaction: &Transaction<'_>,
        command: PlanningCommand<'_>,
    ) -> Result<(), String> {
        match command {
            PlanningCommand::CreateTask => Ok(()),
            PlanningCommand::DeleteTask { task_id } => {
                transaction
                    .execute("DELETE FROM task_orders WHERE task_id = ?1", [task_id])
                    .map_err(database_error)?;
                Ok(())
            }
            PlanningCommand::ReconcileTask {
                task_id,
                previous_scope,
                destination_scope,
                active_before,
                active_after,
            } => {
                if !active_after {
                    transaction
                        .execute("DELETE FROM task_orders WHERE task_id = ?1", [task_id])
                        .map_err(database_error)?;
                } else if !active_before || previous_scope != destination_scope {
                    move_task_to_scope_start(transaction, task_id, destination_scope)?;
                }
                Ok(())
            }
            PlanningCommand::ReplaceOrder { scope, task_ids } => {
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
        }
    }

    fn completed_tasks(&self, today: bool) -> Vec<&'a Task> {
        let mut tasks = self
            .tasks
            .iter()
            .filter(|task| {
                task.completed_at.is_some()
                    && (task.scheduled_date.as_deref() == Some(self.today)) == today
            })
            .collect::<Vec<_>>();
        tasks.sort_by(|first, second| {
            second
                .completed_at
                .cmp(&first.completed_at)
                .then_with(|| second.created_at.cmp(&first.created_at))
                .then_with(|| second.id.cmp(&first.id))
        });
        tasks
    }

    fn planning_task(&self, task: &Task, today: bool) -> PlanningTask {
        let mut badges = Vec::new();
        if task.completed_at.is_none() && task.estimate_minutes.is_none() {
            badges.push(WorkspaceBadge::NeedsEstimate);
        }
        if task.completed_at.is_none() && !today {
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

pub(crate) enum PlanningCommand<'a> {
    CreateTask,
    DeleteTask {
        task_id: &'a str,
    },
    ReconcileTask {
        task_id: &'a str,
        previous_scope: &'a str,
        destination_scope: &'a str,
        active_before: bool,
        active_after: bool,
    },
    ReplaceOrder {
        scope: &'a str,
        task_ids: &'a [String],
    },
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

pub(crate) fn active_scope(
    estimate_minutes: Option<i64>,
    scheduled_date: Option<&str>,
    today: &str,
) -> String {
    match scheduled_date {
        Some(date) if date == today => today_scope(today),
        _ if estimate_minutes.is_none() => NEEDS_ESTIMATE_SCOPE.into(),
        None => UNSCHEDULED_SCOPE.into(),
        Some(date) if date < today => OVERDUE_SCOPE.into(),
        Some(_) => UPCOMING_SCOPE.into(),
    }
}

pub(crate) fn scope_task_ids(
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

pub(crate) fn move_task_to_scope_start(
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

pub(crate) fn validate_reorder_guard(
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
        .filter(|task| {
            task.completed_at.is_none()
                && active_scope(task.estimate_minutes, task.scheduled_date.as_deref(), today)
                    == scope
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

#[cfg(test)]
mod tests {
    use super::*;

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

    #[test]
    fn projects_unsized_today_without_counting_it_toward_capacity() {
        let tasks = vec![
            task("1", None, Some("2026-08-09"), None),
            task("2", Some(90), Some("2026-08-09"), None),
        ];
        let orders = HashMap::new();
        let state = PlanningWorkspace::new(&tasks, &orders, "2026-08-09", 60);
        let view = state.view();

        assert_eq!(view.today.active.tasks.len(), 2);
        assert_eq!(view.today.unsized_task_count, 1);
        assert_eq!(view.today.capacity.committed_minutes, 90);
        assert_eq!(view.today.capacity.overage_minutes, 30);
        assert_eq!(view.today.capacity.overflow_task_id.as_deref(), Some("2"));
        assert_eq!(state.today_active().len(), 2);
    }

    #[test]
    fn projects_backlog_in_product_precedence_order() {
        let tasks = vec![
            task("1", Some(30), None, None),
            task("2", Some(30), Some("2026-08-08"), None),
            task("3", Some(30), Some("2026-08-10"), None),
            task("4", None, None, None),
        ];
        let orders = HashMap::new();
        let state = PlanningWorkspace::new(&tasks, &orders, "2026-08-09", 120);
        let ids = state
            .view()
            .backlog
            .active
            .tasks
            .into_iter()
            .map(|task| task.task.id)
            .collect::<Vec<_>>();

        assert_eq!(ids, vec!["4", "2", "3", "1"]);
    }

    #[test]
    fn plan_candidates_share_authoritative_scope_and_order_rules() {
        let tasks = vec![
            task("1", Some(30), None, None),
            task("2", Some(30), Some("2026-08-08"), None),
            task("3", None, None, None),
            task("4", Some(30), Some("2026-08-10"), None),
        ];
        let orders = HashMap::from([
            (UNSCHEDULED_SCOPE.into(), vec!["1".into()]),
            (OVERDUE_SCOPE.into(), vec!["2".into()]),
        ]);
        let state = PlanningWorkspace::new(&tasks, &orders, "2026-08-09", 120);
        let candidates = state.plan_candidates();

        assert_eq!(
            candidates
                .iter()
                .map(|candidate| candidate.task.id.as_str())
                .collect::<Vec<_>>(),
            vec!["1", "2"]
        );
    }
}

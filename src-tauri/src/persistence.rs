use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
};

use chrono::{Datelike, Local, NaiveDate, Utc, Weekday};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

use crate::credentials;
use crate::shortcut_controller;

const DATABASE_FILE_NAME: &str = "slate.sqlite";
const MAX_AI_CONTEXT_TASKS: usize = 50;
const MAX_AI_CONTEXT_TITLE_CHARS: usize = 240;
pub(crate) const DEFAULT_QUICK_CAPTURE_SHORTCUT: &str = "CommandOrControl+Shift+Space";
const MIGRATION_1_PREFIX: &str = r#"
CREATE TABLE tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  estimate_minutes INTEGER CHECK (estimate_minutes IS NULL OR estimate_minutes > 0),
  scheduled_date TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX tasks_scheduled_date_index ON tasks (scheduled_date);
CREATE INDEX tasks_completed_at_index ON tasks (completed_at);

CREATE TABLE task_orders (
  scope TEXT NOT NULL,
  task_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (scope, task_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX task_orders_scope_position_index ON task_orders (scope, position, task_id);

CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  daily_capacity_minutes INTEGER NOT NULL CHECK (daily_capacity_minutes > 0),
  planning_instruction TEXT NOT NULL,
  ai_provider TEXT NOT NULL,
  ai_model TEXT NOT NULL,
  theme TEXT NOT NULL CHECK (theme IN ('light', 'dark'))
);

INSERT INTO settings (
  id,
  daily_capacity_minutes,
  planning_instruction,
  ai_provider,
  ai_model,
  theme
)
VALUES (1, 240, '', '"#;
const MIGRATION_1_SUFFIX: &str = r#"', 'light');
"#;

fn migration_1() -> String {
    format!(
        "{}{}','{}{}",
        MIGRATION_1_PREFIX,
        credentials::default_provider(),
        credentials::default_model(),
        MIGRATION_1_SUFFIX
    )
}

fn migration_2() -> &'static str {
    r#"
ALTER TABLE settings
ADD COLUMN onboarding_status TEXT NOT NULL DEFAULT 'not-started'
CHECK (onboarding_status IN ('not-started', 'completed', 'skipped'));
"#
}

fn migration_3() -> &'static str {
    r#"
ALTER TABLE tasks ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tasks ADD COLUMN anchor_date TEXT;
ALTER TABLE settings ADD COLUMN capacity_mode TEXT NOT NULL DEFAULT 'global'
CHECK (capacity_mode IN ('global', 'weekly'));
ALTER TABLE settings ADD COLUMN monday_capacity_minutes INTEGER NOT NULL DEFAULT 240
CHECK (monday_capacity_minutes >= 0);
ALTER TABLE settings ADD COLUMN tuesday_capacity_minutes INTEGER NOT NULL DEFAULT 240
CHECK (tuesday_capacity_minutes >= 0);
ALTER TABLE settings ADD COLUMN wednesday_capacity_minutes INTEGER NOT NULL DEFAULT 240
CHECK (wednesday_capacity_minutes >= 0);
ALTER TABLE settings ADD COLUMN thursday_capacity_minutes INTEGER NOT NULL DEFAULT 240
CHECK (thursday_capacity_minutes >= 0);
ALTER TABLE settings ADD COLUMN friday_capacity_minutes INTEGER NOT NULL DEFAULT 240
CHECK (friday_capacity_minutes >= 0);
ALTER TABLE settings ADD COLUMN saturday_capacity_minutes INTEGER NOT NULL DEFAULT 240
CHECK (saturday_capacity_minutes >= 0);
ALTER TABLE settings ADD COLUMN sunday_capacity_minutes INTEGER NOT NULL DEFAULT 240
CHECK (sunday_capacity_minutes >= 0);
UPDATE settings
SET monday_capacity_minutes = daily_capacity_minutes,
    tuesday_capacity_minutes = daily_capacity_minutes,
    wednesday_capacity_minutes = daily_capacity_minutes,
    thursday_capacity_minutes = daily_capacity_minutes,
    friday_capacity_minutes = daily_capacity_minutes,
    saturday_capacity_minutes = daily_capacity_minutes,
    sunday_capacity_minutes = daily_capacity_minutes;

CREATE TABLE planner_events (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT,
  local_date TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  source TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT
);

CREATE INDEX planner_events_task_date_index ON planner_events (task_id, occurred_at);
CREATE INDEX planner_events_local_date_index ON planner_events (local_date, occurred_at);
CREATE INDEX planner_events_operation_index ON planner_events (operation_id);
"#
}

fn migration_4() -> String {
    format!(
        r#"
ALTER TABLE settings ADD COLUMN quick_capture_enabled INTEGER NOT NULL DEFAULT 1
CHECK (quick_capture_enabled IN (0, 1));
ALTER TABLE settings ADD COLUMN quick_capture_shortcut TEXT NOT NULL DEFAULT '{DEFAULT_QUICK_CAPTURE_SHORTCUT}';
"#
    )
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    id: String,
    title: String,
    estimate_minutes: Option<i64>,
    scheduled_date: Option<String>,
    created_at: String,
    completed_at: Option<String>,
    revision: i64,
    anchor_date: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskEventState {
    id: String,
    title: String,
    estimate_minutes: Option<i64>,
    scheduled_date: Option<String>,
    completed_at: Option<String>,
    revision: i64,
    anchor_date: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    daily_capacity_minutes: i64,
    planning_instruction: String,
    ai_provider: String,
    ai_model: String,
    theme: String,
    onboarding_status: String,
    capacity_mode: String,
    weekly_capacity_minutes: WeeklyCapacityMinutes,
    quick_capture_enabled: bool,
    quick_capture_shortcut: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WeeklyCapacityMinutes {
    monday: i64,
    tuesday: i64,
    wednesday: i64,
    thursday: i64,
    friday: i64,
    saturday: i64,
    sunday: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlannerSnapshot {
    tasks: Vec<Task>,
    order_by_scope: HashMap<String, Vec<String>>,
    settings: Settings,
    ai_availability: String,
    ai_availability_by_provider: HashMap<String, String>,
    today: String,
    effective_capacity_minutes: i64,
}

#[derive(Clone)]
pub(crate) struct AiAssistTaskContext {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) estimate_minutes: Option<i64>,
    pub(crate) scheduled_date: Option<String>,
    pub(crate) revision: i64,
}

pub(crate) struct AiAssistContext {
    pub(crate) provider: String,
    pub(crate) model: String,
    pub(crate) today: String,
}

pub(crate) struct AiPlanTaskContext {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) context_title: String,
    pub(crate) estimate_minutes: i64,
    pub(crate) scheduled_date: Option<String>,
    pub(crate) source_scope: String,
    pub(crate) backlog_position: usize,
    pub(crate) revision: i64,
}

pub(crate) struct AiPlanContext {
    pub(crate) provider: String,
    pub(crate) model: String,
    pub(crate) today: String,
    pub(crate) daily_capacity_minutes: i64,
    pub(crate) remaining_minutes: i64,
    pub(crate) today_tasks: Vec<AiAssistTaskContext>,
    pub(crate) today_task_ids: Vec<String>,
    pub(crate) today_task_revisions: Vec<TaskRevision>,
    pub(crate) candidates: Vec<AiPlanTaskContext>,
    pub(crate) planning_instruction: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TaskRevision {
    pub(crate) id: String,
    pub(crate) revision: i64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PlannerChanged {
    revision: u64,
}

pub struct PersistenceState {
    repository: Mutex<Result<Repository, String>>,
    revision: AtomicU64,
}

struct Repository {
    connection: Connection,
}

impl Repository {
    fn open(path: PathBuf) -> Result<Self, String> {
        let mut connection = Connection::open(path).map_err(database_error)?;
        connection
            .execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
            .map_err(database_error)?;
        apply_migrations(&connection)?;
        backfill_history_boundaries(&mut connection)?;
        Ok(Self { connection })
    }

    fn snapshot(
        &self,
        ai_availability_by_provider: HashMap<String, String>,
    ) -> Result<PlannerSnapshot, String> {
        let settings = self.settings()?;
        let tasks = self.tasks()?;
        let order_by_scope = self.orders()?;
        let today = local_today();
        let effective_capacity = effective_capacity_minutes(&settings, &today)?;
        let ai_availability = ai_availability_by_provider
            .get(&settings.ai_provider)
            .cloned()
            .unwrap_or_else(|| "unconfigured".into());

        Ok(PlannerSnapshot {
            tasks,
            order_by_scope,
            settings,
            ai_availability,
            ai_availability_by_provider,
            effective_capacity_minutes: effective_capacity,
            today,
        })
    }

    fn ai_assist_context(&self) -> Result<AiAssistContext, String> {
        let settings = self.settings()?;
        let today = local_today();

        Ok(AiAssistContext {
            provider: settings.ai_provider,
            model: settings.ai_model,
            today,
        })
    }

    fn ai_plan_context(&self) -> Result<AiPlanContext, String> {
        let settings = self.settings()?;
        let tasks = self.tasks()?;
        let order_by_scope = self.orders()?;
        let today = local_today();
        let today_scope = format!("today:{today}");
        let all_today_tasks = ordered_ai_context(&tasks, &order_by_scope, &today_scope, &today);
        let today_task_ids = all_today_tasks
            .iter()
            .map(|task| task.id.clone())
            .collect::<Vec<_>>();
        let today_task_revisions = all_today_tasks
            .iter()
            .map(|task| TaskRevision {
                id: task.id.clone(),
                revision: task.revision,
            })
            .collect::<Vec<_>>();
        let committed_minutes = tasks
            .iter()
            .filter(|task| {
                task.completed_at.is_none()
                    && active_scope(
                        task.estimate_minutes,
                        task.scheduled_date.as_deref(),
                        &today,
                    ) == today_scope
            })
            .filter_map(|task| task.estimate_minutes)
            .fold(0_i64, i64::saturating_add);
        let effective_capacity = effective_capacity_minutes(&settings, &today)?;
        let remaining_minutes = effective_capacity.saturating_sub(committed_minutes).max(0);
        let candidates = ["log:unscheduled", "log:overdue"]
            .into_iter()
            .flat_map(|scope| ordered_plan_context(&tasks, &order_by_scope, scope, &today))
            .take(MAX_AI_CONTEXT_TASKS)
            .collect();

        Ok(AiPlanContext {
            provider: settings.ai_provider,
            model: settings.ai_model,
            today,
            daily_capacity_minutes: effective_capacity,
            remaining_minutes,
            today_tasks: all_today_tasks
                .into_iter()
                .take(MAX_AI_CONTEXT_TASKS)
                .collect(),
            today_task_ids,
            today_task_revisions,
            candidates,
            planning_instruction: settings.planning_instruction.chars().take(2_000).collect(),
        })
    }

    fn tasks(&self) -> Result<Vec<Task>, String> {
        let mut statement = self
            .connection
            .prepare(
                "SELECT id, title, estimate_minutes, scheduled_date, created_at, completed_at, revision, anchor_date
                 FROM tasks
                 ORDER BY created_at ASC, id ASC",
            )
            .map_err(database_error)?;

        let tasks = statement
            .query_map([], task_from_row)
            .map_err(database_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(database_error)?;
        Ok(tasks)
    }

    fn orders(&self) -> Result<HashMap<String, Vec<String>>, String> {
        let mut statement = self
            .connection
            .prepare("SELECT scope, task_id FROM task_orders ORDER BY scope ASC, position ASC, task_id ASC")
            .map_err(database_error)?;
        let mut orders = HashMap::<String, Vec<String>>::new();
        let rows = statement
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(database_error)?;

        for row in rows {
            let (scope, task_id) = row.map_err(database_error)?;
            orders.entry(scope).or_default().push(task_id);
        }

        Ok(orders)
    }

    fn settings(&self) -> Result<Settings, String> {
        let settings = self
            .connection
            .query_row(
                "SELECT daily_capacity_minutes, planning_instruction, ai_provider, ai_model, theme, onboarding_status,
                        capacity_mode, monday_capacity_minutes, tuesday_capacity_minutes,
                        wednesday_capacity_minutes, thursday_capacity_minutes,
                        friday_capacity_minutes, saturday_capacity_minutes, sunday_capacity_minutes,
                        quick_capture_enabled, quick_capture_shortcut
                 FROM settings WHERE id = 1",
                [],
                |row| {
                    Ok(Settings {
                        daily_capacity_minutes: row.get(0)?,
                        planning_instruction: row.get(1)?,
                        ai_provider: row.get(2)?,
                        ai_model: row.get(3)?,
                        theme: row.get(4)?,
                        onboarding_status: row.get(5)?,
                        capacity_mode: row.get(6)?,
                        weekly_capacity_minutes: WeeklyCapacityMinutes {
                            monday: row.get(7)?,
                            tuesday: row.get(8)?,
                            wednesday: row.get(9)?,
                            thursday: row.get(10)?,
                            friday: row.get(11)?,
                            saturday: row.get(12)?,
                            sunday: row.get(13)?,
                        },
                        quick_capture_enabled: row.get(14)?,
                        quick_capture_shortcut: row.get(15)?,
                    })
                },
            )
            .map_err(database_error)?;
        validate_settings_values(
            settings.daily_capacity_minutes,
            &settings.planning_instruction,
            &settings.ai_provider,
            &settings.ai_model,
            &settings.theme,
            &settings.onboarding_status,
            &settings.capacity_mode,
            settings.weekly_capacity_minutes.monday,
            settings.weekly_capacity_minutes.tuesday,
            settings.weekly_capacity_minutes.wednesday,
            settings.weekly_capacity_minutes.thursday,
            settings.weekly_capacity_minutes.friday,
            settings.weekly_capacity_minutes.saturday,
            settings.weekly_capacity_minutes.sunday,
            &settings.quick_capture_shortcut,
        )?;
        Ok(settings)
    }

    fn create_task(&mut self, input: TaskInput) -> Result<CreatedTask, String> {
        validate_task_input(&input)?;
        let transaction = self.connection.transaction().map_err(database_error)?;
        let id = Uuid::new_v4().to_string();
        transaction
            .execute(
                "INSERT INTO tasks
                 (id, title, estimate_minutes, scheduled_date, created_at, completed_at, revision, anchor_date)
                 VALUES (?1, ?2, ?3, ?4, ?5, NULL, 1, NULL)",
                params![
                    id,
                    input.title.trim(),
                    input.estimate_minutes,
                    input.scheduled_date,
                    utc_now(),
                ],
            )
            .map_err(database_error)?;
        let after = task_state(&transaction, &id)?;
        let revision = after.revision;
        let after_json = serde_json::to_value(after).map_err(json_error)?;
        insert_event(
            &transaction,
            Some(&id),
            "task-created",
            &input.source,
            &Uuid::new_v4().to_string(),
            None,
            Some(&after_json),
        )?;
        transaction.commit().map_err(database_error)?;
        Ok(CreatedTask { id, revision })
    }

    fn update_task(&mut self, input: UpdateTaskInput) -> Result<(), String> {
        validate_task_fields(
            &input.title,
            input.estimate_minutes,
            input.scheduled_date.as_deref(),
        )?;
        let transaction = self.connection.transaction().map_err(database_error)?;
        let before = task_state(&transaction, &input.id)?;
        ensure_expected_revision(&before, input.expected_revision)?;
        let today = local_today();
        let normalized_anchor = normalize_anchor_date(
            input.anchor_date.as_deref(),
            input.scheduled_date.as_deref(),
            input.estimate_minutes,
            before.completed_at.is_some(),
            &today,
        )?;
        if normalized_anchor.is_some() && before.anchor_date.is_none() {
            let anchor_count = transaction
                .query_row(
                    "SELECT COUNT(*) FROM tasks
                     WHERE id != ?1 AND anchor_date = ?2 AND scheduled_date = ?2
                       AND estimate_minutes IS NOT NULL AND completed_at IS NULL",
                    params![input.id, today],
                    |row| row.get::<_, i64>(0),
                )
                .map_err(database_error)?;
            if anchor_count >= 2 {
                return Err("anchor-limit".into());
            }
        }
        let previous_scope = active_scope(
            before.estimate_minutes,
            before.scheduled_date.as_deref(),
            &today,
        );
        let destination_scope = active_scope(
            input.estimate_minutes,
            input.scheduled_date.as_deref(),
            &today,
        );
        transaction
            .execute(
                "UPDATE tasks
                 SET title = ?1, estimate_minutes = ?2, scheduled_date = ?3,
                     anchor_date = ?4, revision = revision + 1
                 WHERE id = ?5 AND revision = ?6",
                params![
                    input.title.trim(),
                    input.estimate_minutes,
                    input.scheduled_date,
                    normalized_anchor,
                    input.id,
                    input.expected_revision,
                ],
            )
            .map_err(database_error)?;
        if before.completed_at.is_none() && previous_scope != destination_scope {
            move_task_to_scope_start(&transaction, &input.id, &destination_scope)?;
        }
        let after = task_state(&transaction, &input.id)?;
        let kind = if before.scheduled_date != after.scheduled_date
            && after.scheduled_date.as_deref() == Some(today.as_str())
        {
            "task-committed"
        } else if before.scheduled_date.is_some() && after.scheduled_date.is_none() {
            "task-returned-to-backlog"
        } else if before.anchor_date != after.anchor_date {
            if after.anchor_date.is_some() {
                "task-anchored"
            } else {
                "task-unanchored"
            }
        } else {
            "task-updated"
        };
        let operation_id = Uuid::new_v4().to_string();
        let before_json = serde_json::to_value(before).map_err(json_error)?;
        let after_json = serde_json::to_value(after).map_err(json_error)?;
        insert_event(
            &transaction,
            Some(&input.id),
            kind,
            "manual",
            &operation_id,
            Some(&before_json),
            Some(&after_json),
        )?;
        transaction.commit().map_err(database_error)
    }

    fn set_task_completed(&mut self, input: CompletionInput) -> Result<(), String> {
        let transaction = self.connection.transaction().map_err(database_error)?;
        let before = task_state(&transaction, &input.id)?;
        ensure_expected_revision(&before, input.expected_revision)?;
        transaction
            .execute(
                "UPDATE tasks SET completed_at = ?1, anchor_date = NULL, revision = revision + 1
                 WHERE id = ?2 AND revision = ?3",
                params![
                    if input.completed {
                        Some(utc_now())
                    } else {
                        None
                    },
                    input.id,
                    input.expected_revision,
                ],
            )
            .map_err(database_error)?;
        if !input.completed {
            let destination_scope = active_scope(
                before.estimate_minutes,
                before.scheduled_date.as_deref(),
                &local_today(),
            );
            move_task_to_scope_start(&transaction, &input.id, &destination_scope)?;
        }
        let after = task_state(&transaction, &input.id)?;
        let before_json = serde_json::to_value(before).map_err(json_error)?;
        let after_json = serde_json::to_value(after).map_err(json_error)?;
        insert_event(
            &transaction,
            Some(&input.id),
            if input.completed {
                "task-completed"
            } else {
                "task-reopened"
            },
            "manual",
            &Uuid::new_v4().to_string(),
            Some(&before_json),
            Some(&after_json),
        )?;
        transaction.commit().map_err(database_error)
    }

    fn set_task_scheduled_date(&mut self, input: ScheduledDateInput) -> Result<(), String> {
        validate_scheduled_date(input.scheduled_date.as_deref())?;
        let transaction = self.connection.transaction().map_err(database_error)?;
        let before = task_state(&transaction, &input.id)?;
        ensure_expected_revision(&before, input.expected_revision)?;
        let today = local_today();
        let previous_scope = active_scope(
            before.estimate_minutes,
            before.scheduled_date.as_deref(),
            &today,
        );
        let destination_scope = active_scope(
            before.estimate_minutes,
            input.scheduled_date.as_deref(),
            &today,
        );
        transaction
            .execute(
                "UPDATE tasks SET scheduled_date = ?1, anchor_date = NULL, revision = revision + 1
                 WHERE id = ?2 AND revision = ?3",
                params![input.scheduled_date, input.id, input.expected_revision],
            )
            .map_err(database_error)?;
        if before.completed_at.is_none() && previous_scope != destination_scope {
            move_task_to_scope_start(&transaction, &input.id, &destination_scope)?;
        }
        let after = task_state(&transaction, &input.id)?;
        let kind = if after.scheduled_date.is_none() {
            "task-returned-to-backlog"
        } else if after.scheduled_date.as_deref() == Some(today.as_str()) {
            "task-committed"
        } else {
            "task-updated"
        };
        let before_json = serde_json::to_value(before).map_err(json_error)?;
        let after_json = serde_json::to_value(after).map_err(json_error)?;
        insert_event(
            &transaction,
            Some(&input.id),
            kind,
            "manual",
            &Uuid::new_v4().to_string(),
            Some(&before_json),
            Some(&after_json),
        )?;
        transaction.commit().map_err(database_error)
    }

    fn delete_task(&mut self, input: DeleteTaskInput) -> Result<(), String> {
        let transaction = self.connection.transaction().map_err(database_error)?;
        let before = task_state(&transaction, &input.id)?;
        ensure_expected_revision(&before, input.expected_revision)?;
        let before_json = serde_json::to_value(before).map_err(json_error)?;
        insert_event(
            &transaction,
            Some(&input.id),
            "task-deleted",
            "manual",
            &Uuid::new_v4().to_string(),
            Some(&before_json),
            None,
        )?;
        transaction
            .execute(
                "DELETE FROM tasks WHERE id = ?1 AND revision = ?2",
                params![input.id, input.expected_revision],
            )
            .map_err(database_error)?;
        transaction.commit().map_err(database_error)
    }

    fn undo_quick_capture(&mut self, input: UndoQuickCaptureInput) -> Result<(), String> {
        let transaction = self.connection.transaction().map_err(database_error)?;
        let task = task_state(&transaction, &input.id).map_err(|error| {
            if error == "Task not found." {
                "stale-quick-capture".into()
            } else {
                error
            }
        })?;
        if task.revision != input.expected_revision {
            return Err("stale-quick-capture".into());
        }
        if task.completed_at.is_some()
            || task.scheduled_date.is_some()
            || task.estimate_minutes.is_some()
            || task.anchor_date.is_some()
        {
            return Err("quick-capture-not-undoable".into());
        }
        let created_by_quick_capture: Option<String> = transaction
            .query_row(
                "SELECT source FROM planner_events
                 WHERE task_id = ?1 AND kind = 'task-created'
                 ORDER BY occurred_at ASC, id ASC LIMIT 1",
                [&input.id],
                |row| row.get(0),
            )
            .optional()
            .map_err(database_error)?;
        if created_by_quick_capture.as_deref() != Some("manual-quick-capture") {
            return Err("quick-capture-not-undoable".into());
        }
        let before_json = serde_json::to_value(&task).map_err(json_error)?;
        insert_event(
            &transaction,
            Some(&input.id),
            "task-deleted",
            "manual-quick-capture-undo",
            &Uuid::new_v4().to_string(),
            Some(&before_json),
            None,
        )?;
        transaction
            .execute(
                "DELETE FROM tasks WHERE id = ?1 AND revision = ?2",
                params![input.id, input.expected_revision],
            )
            .map_err(database_error)?;
        transaction.commit().map_err(database_error)
    }

    fn reorder_tasks(&mut self, input: ReorderTasksInput) -> Result<(), String> {
        validate_scope(&input.scope)?;
        ensure_unique_ids(&input.task_ids)?;
        let transaction = self.connection.transaction().map_err(database_error)?;
        let current_ids = scope_task_ids(&transaction, &input.scope, &local_today())?;
        let mut current_membership = current_ids.clone();
        let mut requested_membership = input.task_ids.clone();
        current_membership.sort();
        requested_membership.sort();
        if current_membership != requested_membership {
            return Err("stale-task-order".into());
        }
        let expected = input
            .expected_revisions
            .iter()
            .map(|item| (item.id.as_str(), item.revision))
            .collect::<HashMap<_, _>>();
        if expected.len() != input.expected_revisions.len()
            || expected.len() != input.task_ids.len()
        {
            return Err("stale-task-order".into());
        }
        let mut before_states = Vec::with_capacity(input.task_ids.len());
        for task_id in &input.task_ids {
            let before = task_state(&transaction, task_id)?;
            ensure_expected_revision(
                &before,
                *expected
                    .get(task_id.as_str())
                    .ok_or_else(|| "stale-task-order".to_string())?,
            )?;
            before_states.push(before);
        }
        transaction
            .execute("DELETE FROM task_orders WHERE scope = ?1", [&input.scope])
            .map_err(database_error)?;
        for (position, task_id) in input.task_ids.iter().enumerate() {
            transaction
                .execute(
                    "INSERT INTO task_orders (scope, task_id, position) VALUES (?1, ?2, ?3)",
                    params![input.scope, task_id, position as i64],
                )
                .map_err(database_error)?;
        }
        let operation_id = Uuid::new_v4().to_string();
        for (position, before) in before_states.into_iter().enumerate() {
            transaction
                .execute(
                    "UPDATE tasks SET revision = revision + 1 WHERE id = ?1 AND revision = ?2",
                    params![before.id, before.revision],
                )
                .map_err(database_error)?;
            let after = task_state(&transaction, &before.id)?;
            let before_position = current_ids
                .iter()
                .position(|task_id| task_id == &before.id)
                .unwrap_or(position);
            let before_json = serde_json::json!({
                "task": serde_json::to_value(&before).map_err(json_error)?,
                "scope": input.scope.as_str(),
                "position": before_position,
            });
            let after_json = serde_json::json!({
                "task": serde_json::to_value(&after).map_err(json_error)?,
                "scope": input.scope.as_str(),
                "position": position,
            });
            insert_event(
                &transaction,
                Some(&before.id),
                "task-reordered",
                "manual",
                &operation_id,
                Some(&before_json),
                Some(&after_json),
            )?;
        }
        transaction.commit().map_err(database_error)
    }

    fn update_settings(&mut self, input: UpdateSettingsInput, source: &str) -> Result<(), String> {
        validate_settings(&input)?;
        validate_settings_source(source)?;
        let previous = self.settings()?;
        let capacity_changed = previous.daily_capacity_minutes != input.daily_capacity_minutes
            || previous.capacity_mode != input.capacity_mode
            || previous.weekly_capacity_minutes.monday != input.weekly_capacity_minutes.monday
            || previous.weekly_capacity_minutes.tuesday != input.weekly_capacity_minutes.tuesday
            || previous.weekly_capacity_minutes.wednesday
                != input.weekly_capacity_minutes.wednesday
            || previous.weekly_capacity_minutes.thursday != input.weekly_capacity_minutes.thursday
            || previous.weekly_capacity_minutes.friday != input.weekly_capacity_minutes.friday
            || previous.weekly_capacity_minutes.saturday != input.weekly_capacity_minutes.saturday
            || previous.weekly_capacity_minutes.sunday != input.weekly_capacity_minutes.sunday;
        let transaction = self.connection.transaction().map_err(database_error)?;
        transaction
            .execute(
                "UPDATE settings
                 SET daily_capacity_minutes = ?1, planning_instruction = ?2, ai_provider = ?3,
                     ai_model = ?4, theme = ?5, onboarding_status = ?6, capacity_mode = ?7,
                     monday_capacity_minutes = ?8, tuesday_capacity_minutes = ?9,
                     wednesday_capacity_minutes = ?10, thursday_capacity_minutes = ?11,
                     friday_capacity_minutes = ?12, saturday_capacity_minutes = ?13,
                     sunday_capacity_minutes = ?14, quick_capture_enabled = ?15,
                     quick_capture_shortcut = ?16
                 WHERE id = 1",
                params![
                    input.daily_capacity_minutes,
                    input.planning_instruction.trim(),
                    input.ai_provider,
                    input.ai_model,
                    input.theme,
                    input.onboarding_status,
                    input.capacity_mode,
                    input.weekly_capacity_minutes.monday,
                    input.weekly_capacity_minutes.tuesday,
                    input.weekly_capacity_minutes.wednesday,
                    input.weekly_capacity_minutes.thursday,
                    input.weekly_capacity_minutes.friday,
                    input.weekly_capacity_minutes.saturday,
                    input.weekly_capacity_minutes.sunday,
                    input.quick_capture_enabled,
                    input.quick_capture_shortcut,
                ],
            )
            .map_err(database_error)?;
        if capacity_changed {
            let before_json = serde_json::json!({
                "dailyCapacityMinutes": previous.daily_capacity_minutes,
                "capacityMode": previous.capacity_mode,
                "weeklyCapacityMinutes": weekly_capacity_json(&previous),
            });
            let after_json = serde_json::json!({
                "dailyCapacityMinutes": input.daily_capacity_minutes,
                "capacityMode": input.capacity_mode,
                "weeklyCapacityMinutes": weekly_capacity_json_from_input(&input),
            });
            insert_event(
                &transaction,
                None,
                "capacity-settings-updated",
                source,
                &Uuid::new_v4().to_string(),
                Some(&before_json),
                Some(&after_json),
            )?;
        }
        transaction.commit().map_err(database_error)
    }

    fn accept_daily_plan(&mut self, input: DailyPlanAcceptanceInput) -> Result<(), String> {
        if input.items.is_empty()
            || input.items.len() > MAX_AI_CONTEXT_TASKS
            || input.expected_daily_capacity_minutes < 0
            || input.expected_remaining_minutes < 0
        {
            return Err("invalid-request".into());
        }
        ensure_unique_ids(
            &input
                .items
                .iter()
                .map(|item| item.id.clone())
                .collect::<Vec<_>>(),
        )?;

        let today = local_today();
        let today_scope = format!("today:{today}");
        let settings = self.settings()?;
        let current_capacity = effective_capacity_minutes(&settings, &today)?;
        let transaction = self.connection.transaction().map_err(database_error)?;
        let current_today_ids = scope_task_ids(&transaction, &today_scope, &today)?;
        let current_today_revisions = current_today_ids
            .iter()
            .map(|id| {
                task_state(&transaction, id).map(|task| TaskRevision {
                    id: id.clone(),
                    revision: task.revision,
                })
            })
            .collect::<Result<Vec<_>, _>>()?;
        let committed_minutes = transaction
            .query_row(
                "SELECT COALESCE(SUM(estimate_minutes), 0)
                 FROM tasks
                 WHERE completed_at IS NULL
                   AND estimate_minutes IS NOT NULL
                   AND scheduled_date = ?1",
                [&today],
                |row| row.get::<_, i64>(0),
            )
            .map_err(database_error)?;
        let current_remaining = current_capacity.saturating_sub(committed_minutes).max(0);
        let proposed_total_minutes = input
            .items
            .iter()
            .map(|item| item.estimate_minutes)
            .fold(0_i64, i64::saturating_add);

        let change_set = ReviewedChangeSet {
            source: "plan-my-day".into(),
            expected_effective_capacity_minutes: input.expected_daily_capacity_minutes,
            expected_remaining_minutes: input.expected_remaining_minutes,
            expected_today_task_ids: input.today_task_ids,
            expected_today_task_revisions: input.today_task_revisions,
            operations: input
                .items
                .into_iter()
                .map(|item| ReviewedTaskOperation {
                    id: item.id,
                    title: item.title,
                    estimate_minutes: item.estimate_minutes,
                    source_scheduled_date: item.source_scheduled_date,
                    revision: item.revision,
                    reason: "Fits the remaining capacity as an additive Today commitment.".into(),
                })
                .collect(),
            before_total_minutes: committed_minutes,
            after_total_minutes: committed_minutes.saturating_add(proposed_total_minutes),
        };

        if current_capacity != change_set.expected_effective_capacity_minutes
            || current_remaining != change_set.expected_remaining_minutes
            || current_today_ids != change_set.expected_today_task_ids
            || current_today_revisions
                .iter()
                .map(|revision| (&revision.id, revision.revision))
                .ne(change_set
                    .expected_today_task_revisions
                    .iter()
                    .map(|revision| (&revision.id, revision.revision)))
        {
            return Err("stale-plan".into());
        }

        let mut total_minutes = 0_i64;
        for operation in &change_set.operations {
            let current =
                task_state(&transaction, &operation.id).map_err(|_| "stale-plan".to_string())?;

            if current.revision != operation.revision
                || current.title != operation.title
                || current.estimate_minutes != Some(operation.estimate_minutes)
                || current.scheduled_date != operation.source_scheduled_date
                || current.completed_at.is_some()
                || current
                    .scheduled_date
                    .as_deref()
                    .is_some_and(|date| date >= today.as_str())
                || operation.estimate_minutes <= 0
                || operation.reason.trim().is_empty()
            {
                return Err("stale-plan".into());
            }
            total_minutes = total_minutes
                .checked_add(operation.estimate_minutes)
                .ok_or_else(|| "stale-plan".to_string())?;
        }

        if change_set.before_total_minutes != committed_minutes
            || change_set.after_total_minutes != committed_minutes + total_minutes
            || total_minutes > current_remaining
        {
            return Err("stale-plan".into());
        }

        let operation_id = Uuid::new_v4().to_string();
        for operation in &change_set.operations {
            let before =
                task_state(&transaction, &operation.id).map_err(|_| "stale-plan".to_string())?;
            transaction
                .execute(
                    "DELETE FROM task_orders WHERE task_id = ?1",
                    [&operation.id],
                )
                .map_err(database_error)?;
            transaction
                .execute(
                    "UPDATE tasks SET scheduled_date = ?1, anchor_date = NULL, revision = revision + 1
                     WHERE id = ?2 AND revision = ?3",
                    params![today, operation.id, operation.revision],
                )
                .map_err(database_error)?;
            let after =
                task_state(&transaction, &operation.id).map_err(|_| "stale-plan".to_string())?;
            let before_json = serde_json::to_value(before).map_err(json_error)?;
            let after_json = serde_json::to_value(after).map_err(json_error)?;
            insert_event(
                &transaction,
                Some(&operation.id),
                "task-committed",
                &change_set.source,
                &operation_id,
                Some(&before_json),
                Some(&after_json),
            )?;
        }
        transaction
            .execute("DELETE FROM task_orders WHERE scope = ?1", [&today_scope])
            .map_err(database_error)?;
        for (position, task_id) in current_today_ids
            .iter()
            .chain(change_set.operations.iter().map(|operation| &operation.id))
            .enumerate()
        {
            transaction
                .execute(
                    "INSERT INTO task_orders (scope, task_id, position) VALUES (?1, ?2, ?3)",
                    params![today_scope, task_id, position as i64],
                )
                .map_err(database_error)?;
        }
        transaction.commit().map_err(database_error)
    }
}

pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    app.manage(PersistenceState {
        repository: Mutex::new(initialize_repository(app)),
        revision: AtomicU64::new(0),
    });
    Ok(())
}

pub(crate) fn read_quick_capture_settings(
    state: &PersistenceState,
) -> Result<(bool, String), String> {
    with_repository(state, |repository| {
        let settings = repository.settings()?;
        Ok((
            settings.quick_capture_enabled,
            settings.quick_capture_shortcut,
        ))
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskInput {
    title: String,
    estimate_minutes: Option<i64>,
    scheduled_date: Option<String>,
    source: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedTask {
    id: String,
    revision: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoQuickCaptureInput {
    id: String,
    expected_revision: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskInput {
    id: String,
    title: String,
    estimate_minutes: Option<i64>,
    scheduled_date: Option<String>,
    anchor_date: Option<String>,
    expected_revision: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletionInput {
    id: String,
    completed: bool,
    expected_revision: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledDateInput {
    id: String,
    scheduled_date: Option<String>,
    expected_revision: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteTaskInput {
    id: String,
    expected_revision: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskRevisionInput {
    id: String,
    revision: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderTasksInput {
    scope: String,
    task_ids: Vec<String>,
    expected_revisions: Vec<TaskRevisionInput>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettingsInput {
    daily_capacity_minutes: i64,
    planning_instruction: String,
    ai_provider: String,
    ai_model: String,
    theme: String,
    onboarding_status: String,
    capacity_mode: String,
    weekly_capacity_minutes: WeeklyCapacityMinutes,
    quick_capture_enabled: bool,
    quick_capture_shortcut: String,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ApiKeyChange {
    Unchanged,
    Replace {
        #[serde(rename = "apiKey")]
        api_key: String,
    },
    Remove,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSettingsInput {
    settings: UpdateSettingsInput,
    api_key_change: ApiKeyChange,
    source: String,
}

pub(crate) struct DailyPlanAcceptanceItem {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) estimate_minutes: i64,
    pub(crate) source_scheduled_date: Option<String>,
    pub(crate) revision: i64,
}

pub(crate) struct DailyPlanAcceptanceInput {
    pub(crate) items: Vec<DailyPlanAcceptanceItem>,
    pub(crate) today_task_ids: Vec<String>,
    pub(crate) today_task_revisions: Vec<TaskRevision>,
    pub(crate) expected_daily_capacity_minutes: i64,
    pub(crate) expected_remaining_minutes: i64,
}

struct ReviewedTaskOperation {
    id: String,
    title: String,
    estimate_minutes: i64,
    source_scheduled_date: Option<String>,
    revision: i64,
    reason: String,
}

struct ReviewedChangeSet {
    source: String,
    expected_effective_capacity_minutes: i64,
    expected_remaining_minutes: i64,
    expected_today_task_ids: Vec<String>,
    expected_today_task_revisions: Vec<TaskRevision>,
    operations: Vec<ReviewedTaskOperation>,
    before_total_minutes: i64,
    after_total_minutes: i64,
}

#[tauri::command]
pub fn get_planner_snapshot(state: State<PersistenceState>) -> Result<PlannerSnapshot, String> {
    planner_snapshot(&state)
}

pub(crate) fn read_ai_assist_context(state: &PersistenceState) -> Result<AiAssistContext, String> {
    with_repository(state, |repository| repository.ai_assist_context())
}

pub(crate) fn read_ai_plan_context(state: &PersistenceState) -> Result<AiPlanContext, String> {
    with_repository(state, |repository| repository.ai_plan_context())
}

pub(crate) fn accept_daily_plan(
    state: &PersistenceState,
    input: DailyPlanAcceptanceInput,
) -> Result<(), String> {
    with_repository(state, |repository| repository.accept_daily_plan(input))
}

#[tauri::command]
pub fn create_task(
    app: AppHandle,
    state: State<PersistenceState>,
    input: TaskInput,
) -> Result<CreatedTask, String> {
    let created = with_repository(&state, |repository| repository.create_task(input))?;
    emit_change(&app, &state)?;
    Ok(created)
}

#[tauri::command]
pub fn undo_quick_capture(
    app: AppHandle,
    state: State<PersistenceState>,
    input: UndoQuickCaptureInput,
) -> Result<(), String> {
    with_repository(&state, |repository| repository.undo_quick_capture(input))?;
    emit_change(&app, &state)
}

#[tauri::command]
pub fn update_task(
    app: AppHandle,
    state: State<PersistenceState>,
    input: UpdateTaskInput,
) -> Result<(), String> {
    with_repository(&state, |repository| repository.update_task(input))?;
    emit_change(&app, &state)
}

#[tauri::command]
pub fn set_task_completed(
    app: AppHandle,
    state: State<PersistenceState>,
    input: CompletionInput,
) -> Result<(), String> {
    with_repository(&state, |repository| repository.set_task_completed(input))?;
    emit_change(&app, &state)
}

#[tauri::command]
pub fn set_task_scheduled_date(
    app: AppHandle,
    state: State<PersistenceState>,
    input: ScheduledDateInput,
) -> Result<(), String> {
    with_repository(&state, |repository| {
        repository.set_task_scheduled_date(input)
    })?;
    emit_change(&app, &state)
}

#[tauri::command]
pub fn delete_task(
    app: AppHandle,
    state: State<PersistenceState>,
    input: DeleteTaskInput,
) -> Result<(), String> {
    with_repository(&state, |repository| repository.delete_task(input))?;
    emit_change(&app, &state)
}

#[tauri::command]
pub fn reorder_tasks(
    app: AppHandle,
    state: State<PersistenceState>,
    input: ReorderTasksInput,
) -> Result<(), String> {
    with_repository(&state, |repository| repository.reorder_tasks(input))?;
    emit_change(&app, &state)
}

#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    state: State<PersistenceState>,
    input: SaveSettingsInput,
) -> Result<PlannerSnapshot, String> {
    validate_save_settings_input(&input)?;

    let previous_settings = with_repository(&state, |repository| repository.settings())?;
    let shortcut_changed = previous_settings.quick_capture_enabled
        != input.settings.quick_capture_enabled
        || previous_settings.quick_capture_shortcut != input.settings.quick_capture_shortcut;
    if shortcut_changed {
        if let Err(error) = shortcut_controller::rebind(
            &app,
            previous_settings.quick_capture_enabled,
            &previous_settings.quick_capture_shortcut,
            input.settings.quick_capture_enabled,
            &input.settings.quick_capture_shortcut,
        ) {
            shortcut_controller::report_registration_error(&app, &error);
            return Err(error);
        }
    }

    let next_quick_capture_enabled = input.settings.quick_capture_enabled;
    let next_quick_capture_shortcut = input.settings.quick_capture_shortcut.clone();
    let credential_result = match &input.api_key_change {
        ApiKeyChange::Unchanged => Ok(()),
        ApiKeyChange::Replace { api_key } => {
            credentials::write_api_key(&input.settings.ai_provider, api_key)
        }
        ApiKeyChange::Remove => credentials::remove_api_key(&input.settings.ai_provider),
    };
    if let Err(error) = credential_result {
        if shortcut_changed {
            let _ = shortcut_controller::rebind(
                &app,
                next_quick_capture_enabled,
                &next_quick_capture_shortcut,
                previous_settings.quick_capture_enabled,
                &previous_settings.quick_capture_shortcut,
            );
        }
        return Err(error);
    }

    let result = with_repository(&state, |repository| {
        repository.update_settings(input.settings, &input.source)
    });
    if let Err(error) = result {
        if shortcut_changed {
            let _ = shortcut_controller::rebind(
                &app,
                next_quick_capture_enabled,
                &next_quick_capture_shortcut,
                previous_settings.quick_capture_enabled,
                &previous_settings.quick_capture_shortcut,
            );
        }
        return Err(error);
    }
    let snapshot = planner_snapshot(&state)?;
    emit_change(&app, &state)?;
    Ok(snapshot)
}

#[tauri::command]
pub fn retry_persistence(app: AppHandle, state: State<PersistenceState>) -> Result<(), String> {
    let repository = initialize_repository(&app);
    let mut current_repository = state.repository.lock().map_err(lock_error)?;
    *current_repository = repository;
    let error = current_repository.as_ref().err().cloned();
    drop(current_repository);

    if let Some(error) = error {
        return Err(error);
    }

    emit_change(&app, &state)
}

pub fn emit_change(app: &AppHandle, state: &PersistenceState) -> Result<(), String> {
    let revision = state.revision.fetch_add(1, Ordering::Relaxed) + 1;
    app.emit("planner://changed", PlannerChanged { revision })
        .map_err(|error| format!("Could not notify Slate windows about a planner change: {error}"))
}

fn planner_snapshot(state: &PersistenceState) -> Result<PlannerSnapshot, String> {
    let availability_by_provider = credential_availability_by_provider();
    with_repository(state, |repository| {
        repository.snapshot(availability_by_provider)
    })
}

fn credential_availability_by_provider() -> HashMap<String, String> {
    credentials::supported_providers()
        .map(|provider| {
            let availability = match credentials::credential_availability(provider) {
                credentials::CredentialAvailability::Configured => "configured",
                credentials::CredentialAvailability::Unconfigured => "unconfigured",
                credentials::CredentialAvailability::Unavailable => "unavailable",
            };
            (provider.to_string(), availability.to_string())
        })
        .collect()
}

fn apply_migrations(connection: &Connection) -> Result<(), String> {
    let version: i64 = connection
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(database_error)?;

    if version < 1 {
        connection
            .execute_batch(&format!(
                "BEGIN IMMEDIATE; {} PRAGMA user_version = 1; COMMIT;",
                migration_1()
            ))
            .map_err(database_error)?;
    }

    if version < 2 {
        connection
            .execute_batch(&format!(
                "BEGIN IMMEDIATE; {} PRAGMA user_version = 2; COMMIT;",
                migration_2()
            ))
            .map_err(database_error)?;
    }

    if version < 3 {
        connection
            .execute_batch(&format!(
                "BEGIN IMMEDIATE; {} PRAGMA user_version = 3; COMMIT;",
                migration_3()
            ))
            .map_err(database_error)?;
    }

    if version < 4 {
        connection
            .execute_batch(&format!(
                "BEGIN IMMEDIATE; {} PRAGMA user_version = 4; COMMIT;",
                migration_4()
            ))
            .map_err(database_error)?;
    }

    Ok(())
}

fn backfill_history_boundaries(connection: &mut Connection) -> Result<(), String> {
    let mut statement = connection
        .prepare(
            "SELECT id, title, estimate_minutes, scheduled_date, completed_at, revision, anchor_date
             FROM tasks ORDER BY id ASC",
        )
        .map_err(database_error)?;
    let tasks = statement
        .query_map([], |row| {
            Ok(Task {
                id: row.get(0)?,
                title: row.get(1)?,
                estimate_minutes: row.get(2)?,
                scheduled_date: row.get(3)?,
                created_at: String::new(),
                completed_at: row.get(4)?,
                revision: row.get(5)?,
                anchor_date: row.get(6)?,
            })
        })
        .map_err(database_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(database_error)?;
    drop(statement);

    let transaction = connection.transaction().map_err(database_error)?;
    for task in tasks {
        let already_exists = transaction
            .query_row(
                "SELECT 1 FROM planner_events WHERE task_id = ?1 AND kind = 'history-started' LIMIT 1",
                [&task.id],
                |_| Ok(()),
            )
            .optional()
            .map_err(database_error)?
            .is_some();
        if !already_exists {
            let state = TaskEventState::from(&task);
            insert_event(
                &transaction,
                Some(&task.id),
                "history-started",
                "migration",
                &Uuid::new_v4().to_string(),
                None,
                Some(&serde_json::to_value(state).map_err(json_error)?),
            )?;
        }
    }
    transaction.commit().map_err(database_error)
}

fn initialize_repository(app: &AppHandle) -> Result<Repository, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not find Slate's app-data directory: {error}"))?;
    fs::create_dir_all(&data_dir)
        .map_err(|error| format!("Could not create Slate's app-data directory: {error}"))?;
    Repository::open(data_dir.join(DATABASE_FILE_NAME))
}

fn with_repository<T>(
    state: &PersistenceState,
    action: impl FnOnce(&mut Repository) -> Result<T, String>,
) -> Result<T, String> {
    let mut repository = state.repository.lock().map_err(lock_error)?;
    let repository = repository.as_mut().map_err(|error| error.clone())?;
    action(repository)
}

fn task_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get(0)?,
        title: row.get(1)?,
        estimate_minutes: row.get(2)?,
        scheduled_date: row.get(3)?,
        created_at: row.get(4)?,
        completed_at: row.get(5)?,
        revision: row.get(6)?,
        anchor_date: row.get(7)?,
    })
}

impl From<&Task> for TaskEventState {
    fn from(task: &Task) -> Self {
        Self {
            id: task.id.clone(),
            title: task.title.clone(),
            estimate_minutes: task.estimate_minutes,
            scheduled_date: task.scheduled_date.clone(),
            completed_at: task.completed_at.clone(),
            revision: task.revision,
            anchor_date: task.anchor_date.clone(),
        }
    }
}

fn insert_event(
    transaction: &rusqlite::Transaction<'_>,
    task_id: Option<&str>,
    kind: &str,
    source: &str,
    operation_id: &str,
    before: Option<&serde_json::Value>,
    after: Option<&serde_json::Value>,
) -> Result<(), String> {
    let before_json = before
        .map(serde_json::to_string)
        .transpose()
        .map_err(json_error)?;
    let after_json = after
        .map(serde_json::to_string)
        .transpose()
        .map_err(json_error)?;
    transaction
        .execute(
            "INSERT INTO planner_events
             (id, task_id, local_date, occurred_at, kind, source, operation_id, before_json, after_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                Uuid::new_v4().to_string(),
                task_id,
                local_today(),
                utc_now(),
                kind,
                source,
                operation_id,
                before_json,
                after_json,
            ],
        )
        .map_err(database_error)?;
    Ok(())
}

fn task_state(
    connection: &rusqlite::Transaction<'_>,
    task_id: &str,
) -> Result<TaskEventState, String> {
    connection
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

fn ensure_expected_revision(task: &TaskEventState, expected_revision: i64) -> Result<(), String> {
    if task.revision == expected_revision {
        Ok(())
    } else {
        Err("stale-task".into())
    }
}

fn normalize_anchor_date(
    anchor_date: Option<&str>,
    scheduled_date: Option<&str>,
    estimate_minutes: Option<i64>,
    completed: bool,
    today: &str,
) -> Result<Option<String>, String> {
    let Some(anchor_date) = anchor_date else {
        return Ok(None);
    };
    validate_scheduled_date(Some(anchor_date))?;
    if completed
        || estimate_minutes.is_none()
        || scheduled_date != Some(today)
        || anchor_date != today
    {
        return Err(
            "Anchors are only available for estimated active tasks scheduled today.".into(),
        );
    }
    Ok(Some(anchor_date.to_string()))
}

fn scope_task_ids(
    connection: &rusqlite::Transaction<'_>,
    scope: &str,
    today: &str,
) -> Result<Vec<String>, String> {
    let mut statement = connection
        .prepare(
            "SELECT t.id, t.estimate_minutes, t.scheduled_date, t.completed_at, t.created_at,
                    COALESCE(o.position, 9223372036854775807)
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

fn active_scope(
    estimate_minutes: Option<i64>,
    scheduled_date: Option<&str>,
    today: &str,
) -> String {
    if estimate_minutes.is_none() {
        return "log:needs-estimate".into();
    }

    match scheduled_date {
        Some(date) if date == today => format!("today:{today}"),
        None => "log:unscheduled".into(),
        Some(date) if date < today => "log:overdue".into(),
        Some(_) => "log:upcoming".into(),
    }
}

fn ordered_ai_context(
    tasks: &[Task],
    order_by_scope: &HashMap<String, Vec<String>>,
    scope: &str,
    today: &str,
) -> Vec<AiAssistTaskContext> {
    ordered_tasks(tasks, order_by_scope, scope, today)
        .into_iter()
        .map(|task| AiAssistTaskContext {
            id: task.id.clone(),
            title: ai_context_title(&task.title),
            estimate_minutes: task.estimate_minutes,
            scheduled_date: task.scheduled_date.clone(),
            revision: task.revision,
        })
        .collect()
}

fn ordered_plan_context(
    tasks: &[Task],
    order_by_scope: &HashMap<String, Vec<String>>,
    scope: &str,
    today: &str,
) -> Vec<AiPlanTaskContext> {
    ordered_tasks(tasks, order_by_scope, scope, today)
        .into_iter()
        .enumerate()
        .filter_map(|(position, task)| {
            Some(AiPlanTaskContext {
                id: task.id.clone(),
                title: task.title.clone(),
                context_title: ai_context_title(&task.title),
                estimate_minutes: task.estimate_minutes?,
                scheduled_date: task.scheduled_date.clone(),
                source_scope: scope.to_string(),
                backlog_position: position,
                revision: task.revision,
            })
        })
        .collect()
}

fn ai_context_title(title: &str) -> String {
    title.chars().take(MAX_AI_CONTEXT_TITLE_CHARS).collect()
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
        let first_position = positions
            .get(first.id.as_str())
            .copied()
            .unwrap_or(usize::MAX);
        let second_position = positions
            .get(second.id.as_str())
            .copied()
            .unwrap_or(usize::MAX);

        first_position
            .cmp(&second_position)
            .then_with(|| first.created_at.cmp(&second.created_at))
            .then_with(|| first.id.cmp(&second.id))
    });

    scoped_tasks
}

fn move_task_to_scope_start(
    transaction: &rusqlite::Transaction<'_>,
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

fn validate_task_input(input: &TaskInput) -> Result<(), String> {
    validate_task_fields(
        &input.title,
        input.estimate_minutes,
        input.scheduled_date.as_deref(),
    )?;
    if input.source == "manual-quick-capture"
        && (input.estimate_minutes.is_some() || input.scheduled_date.is_some())
    {
        return Err("Quick capture tasks cannot have an estimate or scheduled date.".into());
    }
    if !matches!(
        input.source.as_str(),
        "manual" | "ai-assist" | "onboarding" | "manual-quick-capture"
    ) {
        return Err("Task source is invalid.".into());
    }
    Ok(())
}

fn validate_task_fields(
    title: &str,
    estimate_minutes: Option<i64>,
    scheduled_date: Option<&str>,
) -> Result<(), String> {
    if title.trim().is_empty() {
        return Err("Task title is required.".into());
    }
    if estimate_minutes.is_some_and(|minutes| minutes <= 0) {
        return Err("Task estimate must be a positive number of minutes.".into());
    }
    validate_scheduled_date(scheduled_date)
}

fn validate_scheduled_date(date: Option<&str>) -> Result<(), String> {
    let Some(date) = date else {
        return Ok(());
    };
    match NaiveDate::parse_from_str(date, "%Y-%m-%d") {
        Ok(parsed) if parsed.format("%Y-%m-%d").to_string() == date => Ok(()),
        _ => Err("Scheduled date must use YYYY-MM-DD.".into()),
    }
}

fn validate_scope(scope: &str) -> Result<(), String> {
    if scope == "log:needs-estimate"
        || scope == "log:unscheduled"
        || scope == "log:upcoming"
        || scope == "log:overdue"
        || scope
            .strip_prefix("today:")
            .is_some_and(|date| validate_scheduled_date(Some(date)).is_ok())
    {
        Ok(())
    } else {
        Err("Task ordering scope is invalid.".into())
    }
}

fn validate_settings(input: &UpdateSettingsInput) -> Result<(), String> {
    validate_settings_values(
        input.daily_capacity_minutes,
        &input.planning_instruction,
        &input.ai_provider,
        &input.ai_model,
        &input.theme,
        &input.onboarding_status,
        &input.capacity_mode,
        input.weekly_capacity_minutes.monday,
        input.weekly_capacity_minutes.tuesday,
        input.weekly_capacity_minutes.wednesday,
        input.weekly_capacity_minutes.thursday,
        input.weekly_capacity_minutes.friday,
        input.weekly_capacity_minutes.saturday,
        input.weekly_capacity_minutes.sunday,
        &input.quick_capture_shortcut,
    )
}

fn validate_settings_values(
    daily_capacity_minutes: i64,
    planning_instruction: &str,
    ai_provider: &str,
    ai_model: &str,
    theme: &str,
    onboarding_status: &str,
    capacity_mode: &str,
    monday_capacity_minutes: i64,
    tuesday_capacity_minutes: i64,
    wednesday_capacity_minutes: i64,
    thursday_capacity_minutes: i64,
    friday_capacity_minutes: i64,
    saturday_capacity_minutes: i64,
    sunday_capacity_minutes: i64,
    quick_capture_shortcut: &str,
) -> Result<(), String> {
    if daily_capacity_minutes <= 0 {
        return Err("Daily capacity must be a positive number of minutes.".into());
    }
    if planning_instruction.chars().count() > 2_000 {
        return Err("Planning instruction must be 2,000 characters or fewer.".into());
    }
    if !credentials::is_supported_provider(ai_provider) {
        return Err("AI provider is invalid.".into());
    }
    if !credentials::is_supported_model(ai_model) {
        return Err("AI model is invalid.".into());
    }
    if !matches!(theme, "light" | "dark") {
        return Err("Theme is invalid.".into());
    }
    if !matches!(onboarding_status, "not-started" | "completed" | "skipped") {
        return Err("Onboarding status is invalid.".into());
    }
    if !matches!(capacity_mode, "global" | "weekly") {
        return Err("Capacity mode is invalid.".into());
    }
    validate_shortcut(quick_capture_shortcut)?;
    if [
        monday_capacity_minutes,
        tuesday_capacity_minutes,
        wednesday_capacity_minutes,
        thursday_capacity_minutes,
        friday_capacity_minutes,
        saturday_capacity_minutes,
        sunday_capacity_minutes,
    ]
    .into_iter()
    .any(|minutes| minutes < 0)
    {
        return Err("Weekly capacity cannot be negative.".into());
    }
    Ok(())
}

fn validate_shortcut(shortcut: &str) -> Result<(), String> {
    let parts = shortcut.split('+').collect::<Vec<_>>();
    if parts.len() < 2 || parts.iter().any(|part| part.trim().is_empty()) {
        return Err("Quick capture shortcut is invalid.".into());
    }
    let modifiers = [
        "Command",
        "Control",
        "CommandOrControl",
        "Alt",
        "Option",
        "Shift",
        "Super",
    ];
    let key = parts.last().copied().unwrap_or_default();
    if modifiers.iter().any(|modifier| *modifier == key) {
        return Err("Quick capture shortcut needs a key.".into());
    }
    if parts[..parts.len() - 1]
        .iter()
        .any(|modifier| !modifiers.iter().any(|allowed| allowed == modifier))
    {
        return Err("Quick capture shortcut is invalid.".into());
    }
    if parts[..parts.len() - 1]
        .iter()
        .collect::<std::collections::HashSet<_>>()
        .len()
        != parts.len() - 1
    {
        return Err("Quick capture shortcut is invalid.".into());
    }
    if key.chars().count() != 1
        && !matches!(
            key,
            "Space"
                | "Enter"
                | "Tab"
                | "Escape"
                | "Backspace"
                | "Delete"
                | "Home"
                | "End"
                | "PageUp"
                | "PageDown"
                | "Up"
                | "Down"
                | "Left"
                | "Right"
        )
        && !key.starts_with('F')
    {
        return Err("Quick capture shortcut key is unsupported.".into());
    }
    Ok(())
}

fn validate_settings_source(source: &str) -> Result<(), String> {
    if matches!(source, "settings" | "onboarding") {
        Ok(())
    } else {
        Err("Settings source is invalid.".into())
    }
}

fn validate_save_settings_input(input: &SaveSettingsInput) -> Result<(), String> {
    validate_settings(&input.settings)?;
    validate_settings_source(&input.source)?;
    if matches!(
        &input.api_key_change,
        ApiKeyChange::Replace { api_key } if api_key.trim().is_empty()
    ) {
        return Err("API key cannot be empty.".into());
    }
    Ok(())
}

fn ensure_unique_ids(task_ids: &[String]) -> Result<(), String> {
    let mut unique_ids = std::collections::HashSet::new();
    if task_ids.iter().all(|task_id| unique_ids.insert(task_id)) {
        Ok(())
    } else {
        Err("Task order contains duplicate tasks.".into())
    }
}

fn effective_capacity_minutes(settings: &Settings, date: &str) -> Result<i64, String> {
    if settings.capacity_mode == "global" {
        return Ok(settings.daily_capacity_minutes);
    }

    let parsed = NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map_err(|_| "Capacity date must use YYYY-MM-DD.".to_string())?;
    Ok(match parsed.weekday() {
        Weekday::Mon => settings.weekly_capacity_minutes.monday,
        Weekday::Tue => settings.weekly_capacity_minutes.tuesday,
        Weekday::Wed => settings.weekly_capacity_minutes.wednesday,
        Weekday::Thu => settings.weekly_capacity_minutes.thursday,
        Weekday::Fri => settings.weekly_capacity_minutes.friday,
        Weekday::Sat => settings.weekly_capacity_minutes.saturday,
        Weekday::Sun => settings.weekly_capacity_minutes.sunday,
    })
}

fn weekly_capacity_json(settings: &Settings) -> serde_json::Value {
    serde_json::json!({
        "monday": settings.weekly_capacity_minutes.monday,
        "tuesday": settings.weekly_capacity_minutes.tuesday,
        "wednesday": settings.weekly_capacity_minutes.wednesday,
        "thursday": settings.weekly_capacity_minutes.thursday,
        "friday": settings.weekly_capacity_minutes.friday,
        "saturday": settings.weekly_capacity_minutes.saturday,
        "sunday": settings.weekly_capacity_minutes.sunday,
    })
}

fn weekly_capacity_json_from_input(input: &UpdateSettingsInput) -> serde_json::Value {
    serde_json::json!({
        "monday": input.weekly_capacity_minutes.monday,
        "tuesday": input.weekly_capacity_minutes.tuesday,
        "wednesday": input.weekly_capacity_minutes.wednesday,
        "thursday": input.weekly_capacity_minutes.thursday,
        "friday": input.weekly_capacity_minutes.friday,
        "saturday": input.weekly_capacity_minutes.saturday,
        "sunday": input.weekly_capacity_minutes.sunday,
    })
}

fn local_today() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

fn utc_now() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

fn database_error(error: rusqlite::Error) -> String {
    format!("SQLite error: {error}")
}

fn json_error(error: serde_json::Error) -> String {
    format!("Could not serialize planner event: {error}")
}

fn lock_error<T>(_: std::sync::PoisonError<T>) -> String {
    "Slate's local database is unavailable after an unexpected failure.".into()
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestDatabase {
        directory: PathBuf,
        repository: Repository,
    }

    impl TestDatabase {
        fn new() -> Self {
            let directory =
                std::env::temp_dir().join(format!("slate-persistence-test-{}", Uuid::new_v4()));
            fs::create_dir_all(&directory).expect("create temporary test directory");
            let repository =
                Repository::open(directory.join(DATABASE_FILE_NAME)).expect("open test database");
            Self {
                directory,
                repository,
            }
        }
    }

    impl Drop for TestDatabase {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.directory);
        }
    }

    fn create_task(repository: &mut Repository, title: &str) -> Task {
        repository
            .create_task(TaskInput {
                title: title.into(),
                estimate_minutes: Some(30),
                scheduled_date: None,
                source: "manual".into(),
            })
            .expect("create task");
        repository
            .tasks()
            .expect("load tasks")
            .into_iter()
            .find(|task| task.title == title)
            .expect("created task")
    }

    fn test_ai_availability() -> HashMap<String, String> {
        [
            ("vercel-gateway".into(), "unconfigured".into()),
            ("openrouter".into(), "configured".into()),
        ]
        .into()
    }

    fn test_snapshot(repository: &Repository) -> PlannerSnapshot {
        repository
            .snapshot(test_ai_availability())
            .expect("snapshot")
    }

    fn expected_revisions(tasks: &[&Task]) -> Vec<TaskRevisionInput> {
        tasks
            .iter()
            .map(|task| TaskRevisionInput {
                id: task.id.clone(),
                revision: task.revision,
            })
            .collect()
    }

    fn test_weekly_capacity() -> WeeklyCapacityMinutes {
        WeeklyCapacityMinutes {
            monday: 240,
            tuesday: 240,
            wednesday: 240,
            thursday: 240,
            friday: 240,
            saturday: 240,
            sunday: 240,
        }
    }

    #[test]
    fn initializes_default_settings_and_persists_them_after_reopen() {
        let directory =
            std::env::temp_dir().join(format!("slate-persistence-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&directory).expect("create temporary test directory");
        let path = directory.join(DATABASE_FILE_NAME);

        let mut repository = Repository::open(path.clone()).expect("open database");
        assert_eq!(
            repository
                .settings()
                .expect("settings")
                .daily_capacity_minutes,
            240
        );
        repository
            .update_settings(
                UpdateSettingsInput {
                    daily_capacity_minutes: 240,
                    planning_instruction: "Protect focus time.".into(),
                    ai_provider: "openrouter".into(),
                    ai_model: "anthropic/claude-sonnet-4.5".into(),
                    theme: "light".into(),
                    onboarding_status: "not-started".into(),
                    capacity_mode: "global".into(),
                    weekly_capacity_minutes: test_weekly_capacity(),
                    quick_capture_enabled: true,
                    quick_capture_shortcut: "CommandOrControl+Shift+Space".into(),
                },
                "settings",
            )
            .expect("update settings");
        drop(repository);

        let reopened = Repository::open(path).expect("reopen database");
        let settings = reopened.settings().expect("settings");
        assert_eq!(settings.ai_provider, "openrouter");
        assert_eq!(settings.ai_model, "anthropic/claude-sonnet-4.5");
        assert_eq!(settings.planning_instruction, "Protect focus time.");
        assert_eq!(settings.onboarding_status, "not-started");
        assert!(settings.quick_capture_enabled);
        assert_eq!(
            settings.quick_capture_shortcut,
            "CommandOrControl+Shift+Space"
        );
        drop(reopened);
        fs::remove_dir_all(directory).expect("remove temporary test directory");
    }

    #[test]
    fn migrates_v1_settings_to_default_onboarding_status() {
        let directory =
            std::env::temp_dir().join(format!("slate-persistence-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&directory).expect("create temporary test directory");
        let path = directory.join(DATABASE_FILE_NAME);

        let connection = Connection::open(&path).expect("open v1 database");
        connection
            .execute_batch(&format!("{} PRAGMA user_version = 1;", migration_1()))
            .expect("create v1 database");
        drop(connection);

        let repository = Repository::open(path).expect("migrate v1 database");
        let settings = repository.settings().expect("settings");
        assert_eq!(settings.daily_capacity_minutes, 240);
        assert_eq!(settings.onboarding_status, "not-started");
        drop(repository);
        fs::remove_dir_all(directory).expect("remove temporary test directory");
    }

    #[test]
    fn persists_onboarding_status_after_reopen() {
        let directory =
            std::env::temp_dir().join(format!("slate-persistence-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&directory).expect("create temporary test directory");
        let path = directory.join(DATABASE_FILE_NAME);

        let mut repository = Repository::open(path.clone()).expect("open database");
        repository
            .update_settings(
                UpdateSettingsInput {
                    daily_capacity_minutes: 240,
                    planning_instruction: String::new(),
                    ai_provider: credentials::default_provider().into(),
                    ai_model: credentials::default_model().into(),
                    theme: "light".into(),
                    onboarding_status: "completed".into(),
                    capacity_mode: "global".into(),
                    weekly_capacity_minutes: test_weekly_capacity(),
                    quick_capture_enabled: true,
                    quick_capture_shortcut: "CommandOrControl+Shift+Space".into(),
                },
                "onboarding",
            )
            .expect("save completed status");
        drop(repository);

        let mut reopened = Repository::open(path.clone()).expect("reopen database");
        assert_eq!(
            reopened.settings().expect("settings").onboarding_status,
            "completed"
        );
        reopened
            .update_settings(
                UpdateSettingsInput {
                    daily_capacity_minutes: 240,
                    planning_instruction: String::new(),
                    ai_provider: credentials::default_provider().into(),
                    ai_model: credentials::default_model().into(),
                    theme: "light".into(),
                    onboarding_status: "skipped".into(),
                    capacity_mode: "global".into(),
                    weekly_capacity_minutes: test_weekly_capacity(),
                    quick_capture_enabled: true,
                    quick_capture_shortcut: "CommandOrControl+Shift+Space".into(),
                },
                "onboarding",
            )
            .expect("save skipped status");
        drop(reopened);

        let reopened = Repository::open(path).expect("reopen database after skipped status");
        assert_eq!(
            reopened.settings().expect("settings").onboarding_status,
            "skipped"
        );
        fs::remove_dir_all(directory).expect("remove temporary test directory");
    }

    #[test]
    fn snapshot_uses_supplied_safe_credential_status() {
        let database = TestDatabase::new();
        let availability_by_provider = [
            ("vercel-gateway".into(), "configured".into()),
            ("openrouter".into(), "unavailable".into()),
        ]
        .into();

        let snapshot = database
            .repository
            .snapshot(availability_by_provider)
            .expect("snapshot");

        assert_eq!(snapshot.ai_availability, "configured");
        assert_eq!(
            snapshot
                .ai_availability_by_provider
                .get("openrouter")
                .map(String::as_str),
            Some("unavailable")
        );
    }

    #[test]
    fn validates_the_complete_settings_save_before_writing() {
        let valid_settings = || UpdateSettingsInput {
            daily_capacity_minutes: 240,
            planning_instruction: String::new(),
            ai_provider: "openrouter".into(),
            ai_model: "openai/gpt-5-mini".into(),
            theme: "light".into(),
            onboarding_status: "not-started".into(),
            capacity_mode: "global".into(),
            weekly_capacity_minutes: test_weekly_capacity(),
            quick_capture_enabled: true,
            quick_capture_shortcut: "CommandOrControl+Shift+Space".into(),
        };

        assert!(validate_save_settings_input(&SaveSettingsInput {
            settings: valid_settings(),
            api_key_change: ApiKeyChange::Unchanged,
            source: "settings".into(),
        })
        .is_ok());
        for provider in credentials::supported_providers() {
            for model in credentials::supported_models() {
                let mut settings = valid_settings();
                settings.ai_provider = provider.into();
                settings.ai_model = model.into();
                assert!(validate_save_settings_input(&SaveSettingsInput {
                    settings,
                    api_key_change: ApiKeyChange::Unchanged,
                    source: "settings".into(),
                })
                .is_ok());
            }
        }
        assert_eq!(
            validate_save_settings_input(&SaveSettingsInput {
                settings: valid_settings(),
                api_key_change: ApiKeyChange::Replace {
                    api_key: "   ".into(),
                },
                source: "settings".into(),
            }),
            Err("API key cannot be empty.".into())
        );

        let mut invalid_provider = valid_settings();
        invalid_provider.ai_provider = "unknown".into();
        assert_eq!(
            validate_save_settings_input(&SaveSettingsInput {
                settings: invalid_provider,
                api_key_change: ApiKeyChange::Remove,
                source: "settings".into(),
            }),
            Err("AI provider is invalid.".into())
        );

        let mut invalid_model = valid_settings();
        invalid_model.ai_model = "custom/model".into();
        assert_eq!(
            validate_save_settings_input(&SaveSettingsInput {
                settings: invalid_model,
                api_key_change: ApiKeyChange::Unchanged,
                source: "settings".into(),
            }),
            Err("AI model is invalid.".into())
        );

        let mut invalid_onboarding_status = valid_settings();
        invalid_onboarding_status.onboarding_status = "in-progress".into();
        assert_eq!(
            validate_save_settings_input(&SaveSettingsInput {
                settings: invalid_onboarding_status,
                api_key_change: ApiKeyChange::Unchanged,
                source: "settings".into(),
            }),
            Err("Onboarding status is invalid.".into())
        );

        let mut long_instruction = valid_settings();
        long_instruction.planning_instruction = "a".repeat(2_001);
        assert_eq!(
            validate_save_settings_input(&SaveSettingsInput {
                settings: long_instruction,
                api_key_change: ApiKeyChange::Unchanged,
                source: "settings".into(),
            }),
            Err("Planning instruction must be 2,000 characters or fewer.".into())
        );

        let mut invalid_shortcut = valid_settings();
        invalid_shortcut.quick_capture_shortcut = "Shift+Shift+K".into();
        assert_eq!(
            validate_save_settings_input(&SaveSettingsInput {
                settings: invalid_shortcut,
                api_key_change: ApiKeyChange::Unchanged,
                source: "settings".into(),
            }),
            Err("Quick capture shortcut is invalid.".into())
        );
    }

    #[test]
    fn deserializes_a_renderer_key_replacement_request() {
        let input: SaveSettingsInput = serde_json::from_value(serde_json::json!({
            "settings": {
                "dailyCapacityMinutes": 240,
                "planningInstruction": "",
                "aiProvider": "openrouter",
                "aiModel": "openai/gpt-5-mini",
                "theme": "light",
                "onboardingStatus": "not-started",
                "capacityMode": "global",
                "weeklyCapacityMinutes": {
                    "monday": 240,
                    "tuesday": 240,
                    "wednesday": 240,
                    "thursday": 240,
                    "friday": 240,
                    "saturday": 240,
                    "sunday": 240
                },
                "quickCaptureEnabled": true,
                "quickCaptureShortcut": "CommandOrControl+Shift+Space"
            },
            "apiKeyChange": {
                "kind": "replace",
                "apiKey": "not-a-real-secret"
            },
            "source": "settings"
        }))
        .expect("deserialize settings save");

        assert!(matches!(
            input.api_key_change,
            ApiKeyChange::Replace { api_key } if api_key == "not-a-real-secret"
        ));
    }

    #[test]
    fn rejects_invalid_task_values() {
        let mut database = TestDatabase::new();

        assert!(database
            .repository
            .create_task(TaskInput {
                title: " ".into(),
                estimate_minutes: None,
                scheduled_date: None,
                source: "manual".into(),
            })
            .is_err());
        assert!(database
            .repository
            .create_task(TaskInput {
                title: "Estimate task".into(),
                estimate_minutes: Some(0),
                scheduled_date: None,
                source: "manual".into(),
            })
            .is_err());
        assert!(database
            .repository
            .create_task(TaskInput {
                title: "Date task".into(),
                estimate_minutes: None,
                scheduled_date: Some("2026-2-1".into()),
                source: "manual".into(),
            })
            .is_err());
        assert!(database
            .repository
            .create_task(TaskInput {
                title: "Scheduled quick capture".into(),
                estimate_minutes: None,
                scheduled_date: Some("2026-07-27".into()),
                source: "manual-quick-capture".into(),
            })
            .is_err());
    }

    #[test]
    fn quick_capture_returns_revision_and_undo_keeps_event_history() {
        let mut database = TestDatabase::new();
        let created = database
            .repository
            .create_task(TaskInput {
                title: "Capture this thought".into(),
                estimate_minutes: None,
                scheduled_date: None,
                source: "manual-quick-capture".into(),
            })
            .expect("create quick capture");
        assert_eq!(created.revision, 1);
        let task = database
            .repository
            .tasks()
            .expect("load quick capture")
            .into_iter()
            .find(|task| task.id == created.id)
            .expect("quick capture task");
        assert_eq!(task.estimate_minutes, None);
        assert_eq!(task.scheduled_date, None);

        database
            .repository
            .undo_quick_capture(UndoQuickCaptureInput {
                id: created.id.clone(),
                expected_revision: created.revision,
            })
            .expect("undo quick capture");

        assert!(database
            .repository
            .tasks()
            .expect("tasks after undo")
            .into_iter()
            .all(|task| task.id != created.id));
        let events: Vec<(String, String)> = database
            .repository
            .connection
            .prepare(
                "SELECT kind, source FROM planner_events
                 WHERE task_id = ?1 ORDER BY occurred_at ASC, id ASC",
            )
            .expect("prepare quick capture events")
            .query_map([&created.id], |row| Ok((row.get(0)?, row.get(1)?)))
            .expect("query quick capture events")
            .collect::<Result<Vec<_>, _>>()
            .expect("collect quick capture events");
        assert!(events.contains(&("task-created".into(), "manual-quick-capture".into())));
        assert!(events.contains(&("task-deleted".into(), "manual-quick-capture-undo".into())));
    }

    #[test]
    fn quick_capture_undo_rejects_an_edited_task_without_writing() {
        let mut database = TestDatabase::new();
        let created = database
            .repository
            .create_task(TaskInput {
                title: "Edit before undo".into(),
                estimate_minutes: None,
                scheduled_date: None,
                source: "manual-quick-capture".into(),
            })
            .expect("create quick capture");
        database
            .repository
            .update_task(UpdateTaskInput {
                id: created.id.clone(),
                title: "Edited capture".into(),
                estimate_minutes: None,
                scheduled_date: None,
                anchor_date: None,
                expected_revision: created.revision,
            })
            .expect("edit quick capture");

        assert_eq!(
            database
                .repository
                .undo_quick_capture(UndoQuickCaptureInput {
                    id: created.id.clone(),
                    expected_revision: created.revision,
                }),
            Err("stale-quick-capture".into())
        );
        assert_eq!(
            database
                .repository
                .tasks()
                .expect("tasks after stale undo")
                .into_iter()
                .find(|task| task.id == created.id)
                .expect("edited task")
                .title,
            "Edited capture"
        );
    }

    #[test]
    fn persists_completion_and_scoped_ordering() {
        let mut database = TestDatabase::new();
        let first = create_task(&mut database.repository, "First");
        let second = create_task(&mut database.repository, "Second");

        database
            .repository
            .set_task_completed(CompletionInput {
                id: first.id.clone(),
                completed: true,
                expected_revision: first.revision,
            })
            .expect("complete task");
        database
            .repository
            .reorder_tasks(ReorderTasksInput {
                scope: "log:unscheduled".into(),
                task_ids: vec![second.id.clone()],
                expected_revisions: expected_revisions(&[&second]),
            })
            .expect("reorder tasks");

        let snapshot = test_snapshot(&database.repository);
        assert!(snapshot
            .tasks
            .iter()
            .find(|task| task.id == first.id)
            .expect("first task")
            .completed_at
            .is_some());
        assert_eq!(
            snapshot.order_by_scope.get("log:unscheduled"),
            Some(&vec![second.id]),
        );
    }

    #[test]
    fn moved_tasks_enter_at_the_start_of_the_destination_scope() {
        let mut database = TestDatabase::new();
        let first = create_task(&mut database.repository, "First");
        let second = create_task(&mut database.repository, "Second");
        database
            .repository
            .create_task(TaskInput {
                title: "Needs estimate".into(),
                estimate_minutes: None,
                scheduled_date: None,
                source: "manual".into(),
            })
            .expect("create task without estimate");
        let moved = database
            .repository
            .tasks()
            .expect("load tasks")
            .into_iter()
            .find(|task| task.title == "Needs estimate")
            .expect("created task without estimate");

        database
            .repository
            .reorder_tasks(ReorderTasksInput {
                scope: "log:unscheduled".into(),
                task_ids: vec![first.id.clone(), second.id.clone()],
                expected_revisions: expected_revisions(&[&first, &second]),
            })
            .expect("order destination tasks");
        database
            .repository
            .update_task(UpdateTaskInput {
                id: moved.id.clone(),
                title: moved.title,
                estimate_minutes: Some(30),
                scheduled_date: None,
                anchor_date: None,
                expected_revision: moved.revision,
            })
            .expect("move task into destination scope");

        let snapshot = test_snapshot(&database.repository);
        assert_eq!(
            snapshot.order_by_scope.get("log:unscheduled"),
            Some(&vec![moved.id, first.id, second.id]),
        );
    }

    #[test]
    fn clearing_a_scheduled_date_returns_an_active_task_to_unscheduled() {
        let mut database = TestDatabase::new();
        let task = create_task(&mut database.repository, "Return me");
        let today = local_today();

        database
            .repository
            .update_task(UpdateTaskInput {
                id: task.id.clone(),
                title: task.title.clone(),
                estimate_minutes: task.estimate_minutes,
                scheduled_date: Some(today.clone()),
                anchor_date: None,
                expected_revision: task.revision,
            })
            .expect("schedule task for today");
        let today_snapshot = test_snapshot(&database.repository);
        assert_eq!(
            today_snapshot.order_by_scope.get(&format!("today:{today}")),
            Some(&vec![task.id.clone()]),
        );

        database
            .repository
            .update_task(UpdateTaskInput {
                id: task.id.clone(),
                title: task.title,
                estimate_minutes: task.estimate_minutes,
                scheduled_date: None,
                anchor_date: None,
                expected_revision: today_snapshot
                    .tasks
                    .iter()
                    .find(|candidate| candidate.id == task.id)
                    .expect("scheduled task")
                    .revision,
            })
            .expect("clear scheduled date");

        let stored_task = database
            .repository
            .tasks()
            .expect("load tasks")
            .into_iter()
            .find(|candidate| candidate.id == task.id)
            .expect("updated task");
        assert_eq!(stored_task.scheduled_date, None);
        let snapshot = test_snapshot(&database.repository);
        assert_eq!(
            snapshot.order_by_scope.get("log:unscheduled"),
            Some(&vec![task.id]),
        );
        assert!(!snapshot
            .order_by_scope
            .contains_key(&format!("today:{today}")));
    }

    #[test]
    fn restored_tasks_return_to_the_start_of_their_scope() {
        let mut database = TestDatabase::new();
        let first = create_task(&mut database.repository, "First");
        let restored = create_task(&mut database.repository, "Restore me");

        database
            .repository
            .reorder_tasks(ReorderTasksInput {
                scope: "log:unscheduled".into(),
                task_ids: vec![first.id.clone(), restored.id.clone()],
                expected_revisions: expected_revisions(&[&first, &restored]),
            })
            .expect("order tasks");
        database
            .repository
            .set_task_completed(CompletionInput {
                id: restored.id.clone(),
                completed: true,
                expected_revision: restored.revision + 1,
            })
            .expect("complete task");
        database
            .repository
            .set_task_completed(CompletionInput {
                id: restored.id.clone(),
                completed: false,
                expected_revision: restored.revision + 2,
            })
            .expect("restore task");

        let snapshot = test_snapshot(&database.repository);
        assert_eq!(
            snapshot.order_by_scope.get("log:unscheduled"),
            Some(&vec![restored.id, first.id]),
        );
    }

    #[test]
    fn hard_delete_cascades_to_task_orders() {
        let mut database = TestDatabase::new();
        let task = create_task(&mut database.repository, "Delete me");
        database
            .repository
            .reorder_tasks(ReorderTasksInput {
                scope: "log:unscheduled".into(),
                task_ids: vec![task.id.clone()],
                expected_revisions: expected_revisions(&[&task]),
            })
            .expect("create order");

        database
            .repository
            .delete_task(DeleteTaskInput {
                id: task.id,
                expected_revision: task.revision + 1,
            })
            .expect("delete task");
        let snapshot = test_snapshot(&database.repository);
        assert!(snapshot.tasks.is_empty());
        assert!(snapshot.order_by_scope.is_empty());
    }

    #[test]
    fn ai_assist_context_contains_only_provider_settings_and_today() {
        let database = TestDatabase::new();
        let today = local_today();
        let context = database.repository.ai_assist_context().expect("AI context");
        assert_eq!(context.today, today);
        assert_eq!(context.provider, credentials::default_provider());
        assert_eq!(context.model, credentials::default_model());
    }

    #[test]
    fn ai_plan_context_bounds_long_today_titles_without_changing_stored_data() {
        let mut database = TestDatabase::new();
        let today = local_today();
        let long_title = "a".repeat(MAX_AI_CONTEXT_TITLE_CHARS + 1);
        database
            .repository
            .create_task(TaskInput {
                title: long_title.clone(),
                estimate_minutes: Some(30),
                scheduled_date: Some(today),
                source: "manual".into(),
            })
            .expect("create today task");

        let context = database.repository.ai_plan_context().expect("plan context");
        let today_task = context
            .today_tasks
            .iter()
            .find(|task| task.title.len() == MAX_AI_CONTEXT_TITLE_CHARS)
            .expect("bounded today task");
        assert_eq!(today_task.title.chars().count(), MAX_AI_CONTEXT_TITLE_CHARS);
        assert_eq!(
            database
                .repository
                .tasks()
                .expect("load tasks")
                .into_iter()
                .find(|task| task.title == long_title)
                .expect("stored today task")
                .title
                .chars()
                .count(),
            MAX_AI_CONTEXT_TITLE_CHARS + 1
        );
    }

    #[test]
    fn ai_plan_context_bounds_long_backlog_titles_without_changing_stored_data() {
        let mut database = TestDatabase::new();
        let long_title = "🧭".repeat(MAX_AI_CONTEXT_TITLE_CHARS + 1);
        database
            .repository
            .create_task(TaskInput {
                title: long_title.clone(),
                estimate_minutes: Some(30),
                scheduled_date: None,
                source: "manual".into(),
            })
            .expect("create backlog task");

        let context = database.repository.ai_plan_context().expect("plan context");
        let candidate = context
            .candidates
            .iter()
            .find(|task| task.title == long_title)
            .expect("bounded backlog candidate");
        assert_eq!(
            candidate.context_title.chars().count(),
            MAX_AI_CONTEXT_TITLE_CHARS
        );
        assert_eq!(
            candidate.title.chars().count(),
            MAX_AI_CONTEXT_TITLE_CHARS + 1
        );
        assert_eq!(
            database
                .repository
                .tasks()
                .expect("load tasks")
                .into_iter()
                .find(|task| task.title == long_title)
                .expect("stored backlog task")
                .title
                .chars()
                .count(),
            MAX_AI_CONTEXT_TITLE_CHARS + 1
        );
    }

    #[test]
    fn daily_plan_acceptance_accepts_long_title_without_changing_it() {
        let mut database = TestDatabase::new();
        let today = local_today();
        let long_title = "🧭".repeat(MAX_AI_CONTEXT_TITLE_CHARS + 1);
        let task = create_task(&mut database.repository, &long_title);
        let context = database.repository.ai_plan_context().expect("plan context");
        let planned = context
            .candidates
            .iter()
            .find(|candidate| candidate.id == task.id)
            .expect("candidate");

        database
            .repository
            .accept_daily_plan(DailyPlanAcceptanceInput {
                items: vec![DailyPlanAcceptanceItem {
                    id: planned.id.clone(),
                    title: planned.title.clone(),
                    estimate_minutes: planned.estimate_minutes,
                    source_scheduled_date: planned.scheduled_date.clone(),
                    revision: planned.revision,
                }],
                today_task_ids: context.today_task_ids,
                today_task_revisions: context.today_task_revisions,
                expected_daily_capacity_minutes: context.daily_capacity_minutes,
                expected_remaining_minutes: context.remaining_minutes,
            })
            .expect("accept daily plan");

        let accepted = database
            .repository
            .tasks()
            .expect("tasks")
            .into_iter()
            .find(|candidate| candidate.id == task.id)
            .expect("accepted task");
        assert_eq!(accepted.title, long_title);
        assert_eq!(accepted.scheduled_date.as_deref(), Some(today.as_str()));
    }

    #[test]
    fn daily_plan_acceptance_appends_backlog_tasks_to_today() {
        let mut database = TestDatabase::new();
        let today = local_today();
        let today_task = {
            database
                .repository
                .create_task(TaskInput {
                    title: "Already committed".into(),
                    estimate_minutes: Some(30),
                    scheduled_date: Some(today.clone()),
                    source: "manual".into(),
                })
                .expect("create today task");
            database
                .repository
                .tasks()
                .expect("load today task")
                .into_iter()
                .find(|task| task.title == "Already committed")
                .expect("today task")
        };
        let candidate = create_task(&mut database.repository, "Plan this");
        let context = database.repository.ai_plan_context().expect("plan context");
        let planned = context
            .candidates
            .iter()
            .find(|task| task.id == candidate.id)
            .expect("candidate");

        database
            .repository
            .accept_daily_plan(DailyPlanAcceptanceInput {
                items: vec![DailyPlanAcceptanceItem {
                    id: planned.id.clone(),
                    title: planned.title.clone(),
                    estimate_minutes: planned.estimate_minutes,
                    source_scheduled_date: planned.scheduled_date.clone(),
                    revision: planned.revision,
                }],
                today_task_ids: context.today_task_ids,
                today_task_revisions: context.today_task_revisions,
                expected_daily_capacity_minutes: context.daily_capacity_minutes,
                expected_remaining_minutes: context.remaining_minutes,
            })
            .expect("accept daily plan");

        let snapshot = test_snapshot(&database.repository);
        assert_eq!(
            snapshot
                .tasks
                .iter()
                .find(|task| task.id == candidate.id)
                .expect("planned task")
                .scheduled_date
                .as_deref(),
            Some(today.as_str())
        );
        assert_eq!(
            snapshot.order_by_scope.get(&format!("today:{today}")),
            Some(&vec![today_task.id, candidate.id]),
        );
    }

    #[test]
    fn daily_plan_acceptance_rejects_stale_task_without_writing() {
        let mut database = TestDatabase::new();
        let candidate = create_task(&mut database.repository, "Original title");
        let context = database.repository.ai_plan_context().expect("plan context");
        let planned = context
            .candidates
            .iter()
            .find(|task| task.id == candidate.id)
            .expect("candidate");
        database
            .repository
            .update_task(UpdateTaskInput {
                id: candidate.id.clone(),
                title: "Changed title".into(),
                estimate_minutes: Some(30),
                scheduled_date: None,
                anchor_date: None,
                expected_revision: candidate.revision,
            })
            .expect("change task");

        let result = database
            .repository
            .accept_daily_plan(DailyPlanAcceptanceInput {
                items: vec![DailyPlanAcceptanceItem {
                    id: planned.id.clone(),
                    title: planned.title.clone(),
                    estimate_minutes: planned.estimate_minutes,
                    source_scheduled_date: planned.scheduled_date.clone(),
                    revision: planned.revision,
                }],
                today_task_ids: context.today_task_ids,
                today_task_revisions: context.today_task_revisions,
                expected_daily_capacity_minutes: context.daily_capacity_minutes,
                expected_remaining_minutes: context.remaining_minutes,
            });

        assert_eq!(result, Err("stale-plan".into()));
        assert_eq!(
            database
                .repository
                .tasks()
                .expect("tasks")
                .into_iter()
                .find(|task| task.id == candidate.id)
                .expect("candidate")
                .scheduled_date,
            None
        );
    }

    #[test]
    fn weekly_capacity_preserves_global_value_and_allows_zero_days() {
        let mut database = TestDatabase::new();
        let mut settings = database.repository.settings().expect("settings");
        settings.daily_capacity_minutes = 300;
        settings.capacity_mode = "weekly".into();
        settings.weekly_capacity_minutes.monday = 0;
        settings.weekly_capacity_minutes.sunday = 180;
        database
            .repository
            .update_settings(
                UpdateSettingsInput {
                    daily_capacity_minutes: settings.daily_capacity_minutes,
                    planning_instruction: settings.planning_instruction,
                    ai_provider: settings.ai_provider,
                    ai_model: settings.ai_model,
                    theme: settings.theme,
                    onboarding_status: settings.onboarding_status,
                    capacity_mode: settings.capacity_mode,
                    weekly_capacity_minutes: settings.weekly_capacity_minutes,
                    quick_capture_enabled: settings.quick_capture_enabled,
                    quick_capture_shortcut: settings.quick_capture_shortcut,
                },
                "settings",
            )
            .expect("save weekly settings");

        let saved = database.repository.settings().expect("saved settings");
        assert_eq!(saved.daily_capacity_minutes, 300);
        assert_eq!(
            effective_capacity_minutes(&saved, "2026-07-27").expect("Monday capacity"),
            0
        );
        assert_eq!(
            effective_capacity_minutes(&saved, "2026-08-02").expect("Sunday capacity"),
            180
        );
    }

    #[test]
    fn anchors_are_limited_to_two_active_today_tasks() {
        let mut database = TestDatabase::new();
        let today = local_today();
        let first = create_task(&mut database.repository, "First anchor");
        let second = create_task(&mut database.repository, "Second anchor");
        let third = create_task(&mut database.repository, "Third anchor");

        for task in [&first, &second] {
            database
                .repository
                .update_task(UpdateTaskInput {
                    id: task.id.clone(),
                    title: task.title.clone(),
                    estimate_minutes: task.estimate_minutes,
                    scheduled_date: Some(today.clone()),
                    anchor_date: Some(today.clone()),
                    expected_revision: task.revision,
                })
                .expect("anchor task");
        }

        let result = database.repository.update_task(UpdateTaskInput {
            id: third.id.clone(),
            title: third.title,
            estimate_minutes: third.estimate_minutes,
            scheduled_date: Some(today.clone()),
            anchor_date: Some(today),
            expected_revision: third.revision,
        });
        assert_eq!(result, Err("anchor-limit".into()));
        assert_eq!(
            database
                .repository
                .tasks()
                .expect("tasks")
                .into_iter()
                .find(|task| task.id == third.id)
                .expect("third task")
                .revision,
            third.revision
        );
    }

    #[test]
    fn stale_writes_do_not_create_events_or_change_state() {
        let mut database = TestDatabase::new();
        let task = create_task(&mut database.repository, "Revision check");
        database
            .repository
            .update_task(UpdateTaskInput {
                id: task.id.clone(),
                title: "Current title".into(),
                estimate_minutes: task.estimate_minutes,
                scheduled_date: None,
                anchor_date: None,
                expected_revision: task.revision,
            })
            .expect("update task");
        let event_count: i64 = database
            .repository
            .connection
            .query_row(
                "SELECT COUNT(*) FROM planner_events WHERE task_id = ?1",
                [&task.id],
                |row| row.get(0),
            )
            .expect("event count");

        let result = database.repository.update_task(UpdateTaskInput {
            id: task.id.clone(),
            title: "Stale title".into(),
            estimate_minutes: task.estimate_minutes,
            scheduled_date: None,
            anchor_date: None,
            expected_revision: task.revision,
        });
        assert_eq!(result, Err("stale-task".into()));
        assert_eq!(
            database
                .repository
                .connection
                .query_row(
                    "SELECT COUNT(*) FROM planner_events WHERE task_id = ?1",
                    [&task.id],
                    |row| row.get::<_, i64>(0),
                )
                .expect("event count after stale write"),
            event_count
        );
        assert_eq!(
            database
                .repository
                .tasks()
                .expect("tasks")
                .into_iter()
                .find(|candidate| candidate.id == task.id)
                .expect("current task")
                .title,
            "Current title"
        );
    }

    #[test]
    fn planner_events_keep_deleted_task_history_and_shared_operations() {
        let mut database = TestDatabase::new();
        let first = create_task(&mut database.repository, "First event");
        let second = create_task(&mut database.repository, "Second event");
        database
            .repository
            .reorder_tasks(ReorderTasksInput {
                scope: "log:unscheduled".into(),
                task_ids: vec![second.id.clone(), first.id.clone()],
                expected_revisions: expected_revisions(&[&first, &second]),
            })
            .expect("reorder tasks");

        let operation_ids: Vec<String> = database
            .repository
            .connection
            .prepare(
                "SELECT operation_id FROM planner_events
                 WHERE kind = 'task-reordered' ORDER BY occurred_at ASC, id ASC",
            )
            .expect("prepare event query")
            .query_map([], |row| row.get(0))
            .expect("query events")
            .collect::<Result<Vec<_>, _>>()
            .expect("collect events");
        assert_eq!(operation_ids.len(), 2);
        assert_eq!(operation_ids[0], operation_ids[1]);

        database
            .repository
            .delete_task(DeleteTaskInput {
                id: first.id.clone(),
                expected_revision: first.revision + 1,
            })
            .expect("delete task");
        let deleted_history: (String, Option<String>) = database
            .repository
            .connection
            .query_row(
                "SELECT kind, before_json FROM planner_events
                 WHERE task_id = ?1 AND kind = 'task-deleted'",
                [&first.id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("deleted event");
        assert_eq!(deleted_history.0, "task-deleted");
        assert!(deleted_history.1.is_some());
    }

    #[test]
    fn existing_tasks_receive_one_idempotent_history_boundary() {
        let mut database = TestDatabase::new();
        let task = create_task(&mut database.repository, "Legacy task");
        database
            .repository
            .connection
            .execute(
                "INSERT INTO tasks
                 (id, title, estimate_minutes, scheduled_date, created_at, completed_at, revision, anchor_date)
                 VALUES (?1, ?2, ?3, NULL, ?4, NULL, 1, NULL)",
                params![Uuid::new_v4().to_string(), "Pre-ledger task", 30, utc_now()],
            )
            .expect("insert legacy task");
        backfill_history_boundaries(&mut database.repository.connection).expect("backfill history");
        backfill_history_boundaries(&mut database.repository.connection).expect("backfill again");

        let count: i64 = database
            .repository
            .connection
            .query_row(
                "SELECT COUNT(*) FROM planner_events WHERE kind = 'history-started' AND task_id = ?1",
                [&task.id],
                |row| row.get(0),
            )
            .expect("history boundary count");
        assert_eq!(count, 1);
    }
}

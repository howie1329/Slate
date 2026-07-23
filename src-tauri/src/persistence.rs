use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
};

use chrono::{Local, NaiveDate, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

use crate::credentials;

const DATABASE_FILE_NAME: &str = "slate.sqlite";
const MAX_AI_CONTEXT_TASKS: usize = 50;
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    id: String,
    title: String,
    estimate_minutes: Option<i64>,
    scheduled_date: Option<String>,
    created_at: String,
    completed_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    daily_capacity_minutes: i64,
    planning_instruction: String,
    ai_provider: String,
    ai_model: String,
    theme: String,
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
}

#[derive(Clone)]
pub(crate) struct AiAssistTaskContext {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) estimate_minutes: Option<i64>,
    pub(crate) scheduled_date: Option<String>,
}

pub(crate) struct AiAssistContext {
    pub(crate) provider: String,
    pub(crate) model: String,
    pub(crate) today: String,
}

pub(crate) struct AiPlanTaskContext {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) estimate_minutes: i64,
    pub(crate) scheduled_date: Option<String>,
    pub(crate) source_scope: String,
    pub(crate) backlog_position: usize,
}

pub(crate) struct AiPlanContext {
    pub(crate) provider: String,
    pub(crate) model: String,
    pub(crate) today: String,
    pub(crate) daily_capacity_minutes: i64,
    pub(crate) remaining_minutes: i64,
    pub(crate) today_tasks: Vec<AiAssistTaskContext>,
    pub(crate) today_task_ids: Vec<String>,
    pub(crate) candidates: Vec<AiPlanTaskContext>,
    pub(crate) planning_instruction: String,
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
        let connection = Connection::open(path).map_err(database_error)?;
        connection
            .execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
            .map_err(database_error)?;
        apply_migrations(&connection)?;
        Ok(Self { connection })
    }

    fn snapshot(&self) -> Result<PlannerSnapshot, String> {
        let settings = self.settings()?;
        let tasks = self.tasks()?;
        let order_by_scope = self.orders()?;
        let ai_availability_by_provider = credentials::supported_providers()
            .map(|provider| {
                let availability = match credentials::credential_availability(provider) {
                    credentials::CredentialAvailability::Configured(_) => "configured",
                    credentials::CredentialAvailability::Unconfigured => "unconfigured",
                    credentials::CredentialAvailability::Unavailable => "unavailable",
                };
                (provider.to_string(), availability.to_string())
            })
            .collect::<HashMap<_, _>>();
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
            today: local_today(),
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
        let remaining_minutes = settings
            .daily_capacity_minutes
            .saturating_sub(committed_minutes)
            .max(0);
        let candidates = ["log:unscheduled", "log:overdue"]
            .into_iter()
            .flat_map(|scope| ordered_plan_context(&tasks, &order_by_scope, scope, &today))
            .take(MAX_AI_CONTEXT_TASKS)
            .collect();

        Ok(AiPlanContext {
            provider: settings.ai_provider,
            model: settings.ai_model,
            today,
            daily_capacity_minutes: settings.daily_capacity_minutes,
            remaining_minutes,
            today_tasks: all_today_tasks
                .into_iter()
                .take(MAX_AI_CONTEXT_TASKS)
                .collect(),
            today_task_ids,
            candidates,
            planning_instruction: settings.planning_instruction.chars().take(2_000).collect(),
        })
    }

    fn tasks(&self) -> Result<Vec<Task>, String> {
        let mut statement = self
            .connection
            .prepare(
                "SELECT id, title, estimate_minutes, scheduled_date, created_at, completed_at
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
        let settings = self.connection
            .query_row(
                "SELECT daily_capacity_minutes, planning_instruction, ai_provider, ai_model, theme
                 FROM settings WHERE id = 1",
                [],
                |row| {
                    Ok(Settings {
                        daily_capacity_minutes: row.get(0)?,
                        planning_instruction: row.get(1)?,
                        ai_provider: row.get(2)?,
                        ai_model: row.get(3)?,
                        theme: row.get(4)?,
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
        )?;
        Ok(settings)
    }

    fn create_task(&mut self, input: TaskInput) -> Result<(), String> {
        validate_task_input(&input)?;
        let transaction = self.connection.transaction().map_err(database_error)?;
        transaction
            .execute(
                "INSERT INTO tasks (id, title, estimate_minutes, scheduled_date, created_at, completed_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, NULL)",
                params![
                    Uuid::new_v4().to_string(),
                    input.title.trim(),
                    input.estimate_minutes,
                    input.scheduled_date,
                    utc_now(),
                ],
            )
            .map_err(database_error)?;
        transaction.commit().map_err(database_error)
    }

    fn update_task(&mut self, input: UpdateTaskInput) -> Result<(), String> {
        validate_task_input(&TaskInput {
            title: input.title.clone(),
            estimate_minutes: input.estimate_minutes,
            scheduled_date: input.scheduled_date.clone(),
        })?;
        let transaction = self.connection.transaction().map_err(database_error)?;
        ensure_task_exists(&transaction, &input.id)?;
        let (previous_estimate, previous_date, completed_at) = transaction
            .query_row(
                "SELECT estimate_minutes, scheduled_date, completed_at FROM tasks WHERE id = ?1",
                [&input.id],
                |row| {
                    Ok((
                        row.get::<_, Option<i64>>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, Option<String>>(2)?,
                    ))
                },
            )
            .map_err(database_error)?;
        let today = local_today();
        let previous_scope = active_scope(previous_estimate, previous_date.as_deref(), &today);
        let destination_scope = active_scope(
            input.estimate_minutes,
            input.scheduled_date.as_deref(),
            &today,
        );
        transaction
            .execute(
                "UPDATE tasks SET title = ?1, estimate_minutes = ?2, scheduled_date = ?3 WHERE id = ?4",
                params![
                    input.title.trim(),
                    input.estimate_minutes,
                    input.scheduled_date,
                    input.id,
                ],
            )
            .map_err(database_error)?;
        if completed_at.is_none() && previous_scope != destination_scope {
            move_task_to_scope_start(&transaction, &input.id, &destination_scope)?;
        }
        transaction.commit().map_err(database_error)
    }

    fn set_task_completed(&mut self, input: CompletionInput) -> Result<(), String> {
        let transaction = self.connection.transaction().map_err(database_error)?;
        ensure_task_exists(&transaction, &input.id)?;
        let (estimate_minutes, scheduled_date) = transaction
            .query_row(
                "SELECT estimate_minutes, scheduled_date FROM tasks WHERE id = ?1",
                [&input.id],
                |row| {
                    Ok((
                        row.get::<_, Option<i64>>(0)?,
                        row.get::<_, Option<String>>(1)?,
                    ))
                },
            )
            .map_err(database_error)?;
        transaction
            .execute(
                "UPDATE tasks SET completed_at = ?1 WHERE id = ?2",
                params![
                    if input.completed {
                        Some(utc_now())
                    } else {
                        None
                    },
                    input.id
                ],
            )
            .map_err(database_error)?;
        if !input.completed {
            let destination_scope =
                active_scope(estimate_minutes, scheduled_date.as_deref(), &local_today());
            move_task_to_scope_start(&transaction, &input.id, &destination_scope)?;
        }
        transaction.commit().map_err(database_error)
    }

    fn set_task_scheduled_date(&mut self, input: ScheduledDateInput) -> Result<(), String> {
        validate_scheduled_date(input.scheduled_date.as_deref())?;
        let transaction = self.connection.transaction().map_err(database_error)?;
        ensure_task_exists(&transaction, &input.id)?;
        let (estimate_minutes, previous_date, completed_at) = transaction
            .query_row(
                "SELECT estimate_minutes, scheduled_date, completed_at FROM tasks WHERE id = ?1",
                [&input.id],
                |row| {
                    Ok((
                        row.get::<_, Option<i64>>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, Option<String>>(2)?,
                    ))
                },
            )
            .map_err(database_error)?;
        let today = local_today();
        let previous_scope = active_scope(estimate_minutes, previous_date.as_deref(), &today);
        let destination_scope =
            active_scope(estimate_minutes, input.scheduled_date.as_deref(), &today);
        transaction
            .execute(
                "UPDATE tasks SET scheduled_date = ?1 WHERE id = ?2",
                params![input.scheduled_date, input.id],
            )
            .map_err(database_error)?;
        if completed_at.is_none() && previous_scope != destination_scope {
            move_task_to_scope_start(&transaction, &input.id, &destination_scope)?;
        }
        transaction.commit().map_err(database_error)
    }

    fn delete_task(&mut self, id: String) -> Result<(), String> {
        let transaction = self.connection.transaction().map_err(database_error)?;
        ensure_task_exists(&transaction, &id)?;
        transaction
            .execute("DELETE FROM tasks WHERE id = ?1", [id])
            .map_err(database_error)?;
        transaction.commit().map_err(database_error)
    }

    fn reorder_tasks(&mut self, input: ReorderTasksInput) -> Result<(), String> {
        validate_scope(&input.scope)?;
        ensure_unique_ids(&input.task_ids)?;
        let transaction = self.connection.transaction().map_err(database_error)?;
        for task_id in &input.task_ids {
            ensure_task_exists(&transaction, task_id)?;
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
        transaction.commit().map_err(database_error)
    }

    fn update_settings(&mut self, input: UpdateSettingsInput) -> Result<(), String> {
        validate_settings(&input)?;
        self.connection
            .execute(
                "UPDATE settings
                 SET daily_capacity_minutes = ?1, planning_instruction = ?2, ai_provider = ?3, ai_model = ?4, theme = ?5
                 WHERE id = 1",
                params![
                    input.daily_capacity_minutes,
                    input.planning_instruction.trim(),
                    input.ai_provider,
                    input.ai_model,
                    input.theme,
                ],
            )
            .map_err(database_error)?;
        Ok(())
    }

    fn apply_planner_plan(&mut self, input: ApplyPlannerPlanInput) -> Result<(), String> {
        let transaction = self.connection.transaction().map_err(database_error)?;
        for assignment in &input.assignments {
            validate_scheduled_date(Some(&assignment.scheduled_date))?;
            validate_scope(&assignment.scope)?;
            ensure_task_exists(&transaction, &assignment.task_id)?;
            transaction
                .execute(
                    "UPDATE tasks SET scheduled_date = ?1 WHERE id = ?2",
                    params![assignment.scheduled_date, assignment.task_id],
                )
                .map_err(database_error)?;
            transaction
                .execute(
                    "INSERT INTO task_orders (scope, task_id, position) VALUES (?1, ?2, ?3)
                     ON CONFLICT(scope, task_id) DO UPDATE SET position = excluded.position",
                    params![assignment.scope, assignment.task_id, assignment.position],
                )
                .map_err(database_error)?;
        }
        transaction.commit().map_err(database_error)
    }

    fn accept_daily_plan(&mut self, input: DailyPlanAcceptanceInput) -> Result<(), String> {
        if input.items.is_empty()
            || input.items.len() > MAX_AI_CONTEXT_TASKS
            || input.expected_daily_capacity_minutes <= 0
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
        let transaction = self.connection.transaction().map_err(database_error)?;
        let current_capacity = transaction
            .query_row(
                "SELECT daily_capacity_minutes FROM settings WHERE id = 1",
                [],
                |row| row.get::<_, i64>(0),
            )
            .map_err(database_error)?;
        let current_today_ids = transaction
            .prepare(
                "SELECT t.id
                 FROM tasks t
                 LEFT JOIN task_orders o ON o.task_id = t.id AND o.scope = ?1
                 WHERE t.completed_at IS NULL
                   AND t.estimate_minutes IS NOT NULL
                   AND t.scheduled_date = ?2
                 ORDER BY CASE WHEN o.position IS NULL THEN 1 ELSE 0 END,
                          o.position ASC, t.created_at ASC, t.id ASC",
            )
            .map_err(database_error)?
            .query_map(params![today_scope, today], |row| row.get::<_, String>(0))
            .map_err(database_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(database_error)?;
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

        if current_capacity != input.expected_daily_capacity_minutes
            || current_remaining != input.expected_remaining_minutes
            || current_today_ids != input.today_task_ids
        {
            return Err("stale-plan".into());
        }

        let mut total_minutes = 0_i64;
        for item in &input.items {
            let current = transaction
                .query_row(
                    "SELECT title, estimate_minutes, scheduled_date, completed_at
                     FROM tasks WHERE id = ?1",
                    [&item.id],
                    |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, Option<i64>>(1)?,
                            row.get::<_, Option<String>>(2)?,
                            row.get::<_, Option<String>>(3)?,
                        ))
                    },
                )
                .optional()
                .map_err(database_error)?
                .ok_or_else(|| "stale-plan".to_string())?;

            if current.0 != item.title
                || current.1 != Some(item.estimate_minutes)
                || current.2 != item.source_scheduled_date
                || current.3.is_some()
                || current
                    .2
                    .as_deref()
                    .is_some_and(|date| date >= today.as_str())
                || item.estimate_minutes <= 0
            {
                return Err("stale-plan".into());
            }
            total_minutes = total_minutes
                .checked_add(item.estimate_minutes)
                .ok_or_else(|| "stale-plan".to_string())?;
        }

        if total_minutes > current_remaining {
            return Err("stale-plan".into());
        }

        for item in &input.items {
            transaction
                .execute("DELETE FROM task_orders WHERE task_id = ?1", [&item.id])
                .map_err(database_error)?;
            transaction
                .execute(
                    "UPDATE tasks SET scheduled_date = ?1 WHERE id = ?2",
                    params![today, item.id],
                )
                .map_err(database_error)?;
        }
        transaction
            .execute("DELETE FROM task_orders WHERE scope = ?1", [&today_scope])
            .map_err(database_error)?;
        for (position, task_id) in current_today_ids
            .iter()
            .chain(input.items.iter().map(|item| &item.id))
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskInput {
    title: String,
    estimate_minutes: Option<i64>,
    scheduled_date: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskInput {
    id: String,
    title: String,
    estimate_minutes: Option<i64>,
    scheduled_date: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletionInput {
    id: String,
    completed: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledDateInput {
    id: String,
    scheduled_date: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderTasksInput {
    scope: String,
    task_ids: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettingsInput {
    daily_capacity_minutes: i64,
    planning_instruction: String,
    ai_provider: String,
    ai_model: String,
    theme: String,
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
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlannerPlanAssignment {
    task_id: String,
    scheduled_date: String,
    scope: String,
    position: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyPlannerPlanInput {
    assignments: Vec<PlannerPlanAssignment>,
}

pub(crate) struct DailyPlanAcceptanceItem {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) estimate_minutes: i64,
    pub(crate) source_scheduled_date: Option<String>,
}

pub(crate) struct DailyPlanAcceptanceInput {
    pub(crate) items: Vec<DailyPlanAcceptanceItem>,
    pub(crate) today_task_ids: Vec<String>,
    pub(crate) expected_daily_capacity_minutes: i64,
    pub(crate) expected_remaining_minutes: i64,
}

#[tauri::command]
pub fn get_planner_snapshot(state: State<PersistenceState>) -> Result<PlannerSnapshot, String> {
    with_repository(&state, |repository| repository.snapshot())
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
) -> Result<(), String> {
    with_repository(&state, |repository| repository.create_task(input))?;
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
    id: String,
) -> Result<(), String> {
    with_repository(&state, |repository| repository.delete_task(id))?;
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

    match &input.api_key_change {
        ApiKeyChange::Unchanged => {}
        ApiKeyChange::Replace { api_key } => {
            credentials::write_api_key(&input.settings.ai_provider, api_key)?;
        }
        ApiKeyChange::Remove => {
            credentials::remove_api_key(&input.settings.ai_provider)?;
        }
    }

    let snapshot = with_repository(&state, |repository| {
        repository.update_settings(input.settings)?;
        repository.snapshot()
    })?;
    emit_change(&app, &state)?;
    Ok(snapshot)
}

#[tauri::command]
pub fn apply_planner_plan(
    app: AppHandle,
    state: State<PersistenceState>,
    input: ApplyPlannerPlanInput,
) -> Result<(), String> {
    with_repository(&state, |repository| repository.apply_planner_plan(input))?;
    emit_change(&app, &state)
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

    Ok(())
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
    })
}

fn ensure_task_exists(connection: &rusqlite::Transaction<'_>, task_id: &str) -> Result<(), String> {
    let exists = connection
        .query_row("SELECT 1 FROM tasks WHERE id = ?1", [task_id], |_| Ok(()))
        .optional()
        .map_err(database_error)?
        .is_some();
    if exists {
        Ok(())
    } else {
        Err("Task was not found.".into())
    }
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
            title: task.title.clone(),
            estimate_minutes: task.estimate_minutes,
            scheduled_date: task.scheduled_date.clone(),
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
                estimate_minutes: task.estimate_minutes?,
                scheduled_date: task.scheduled_date.clone(),
                source_scope: scope.to_string(),
                backlog_position: position,
            })
        })
        .collect()
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
    if input.title.trim().is_empty() {
        return Err("Task title is required.".into());
    }
    if input.estimate_minutes.is_some_and(|minutes| minutes <= 0) {
        return Err("Task estimate must be a positive number of minutes.".into());
    }
    validate_scheduled_date(input.scheduled_date.as_deref())
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
    )
}

fn validate_settings_values(
    daily_capacity_minutes: i64,
    planning_instruction: &str,
    ai_provider: &str,
    ai_model: &str,
    theme: &str,
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
    Ok(())
}

fn validate_save_settings_input(input: &SaveSettingsInput) -> Result<(), String> {
    validate_settings(&input.settings)?;
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

fn local_today() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

fn utc_now() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

fn database_error(error: rusqlite::Error) -> String {
    format!("SQLite error: {error}")
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
            })
            .expect("create task");
        repository
            .tasks()
            .expect("load tasks")
            .into_iter()
            .find(|task| task.title == title)
            .expect("created task")
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
            .update_settings(UpdateSettingsInput {
                daily_capacity_minutes: 240,
                planning_instruction: "Protect focus time.".into(),
                ai_provider: "openrouter".into(),
                ai_model: "anthropic/claude-sonnet-4.5".into(),
                theme: "light".into(),
            })
            .expect("update settings");
        drop(repository);

        let reopened = Repository::open(path).expect("reopen database");
        let settings = reopened.settings().expect("settings");
        assert_eq!(settings.ai_provider, "openrouter");
        assert_eq!(settings.ai_model, "anthropic/claude-sonnet-4.5");
        assert_eq!(settings.planning_instruction, "Protect focus time.");
        drop(reopened);
        fs::remove_dir_all(directory).expect("remove temporary test directory");
    }

    #[test]
    fn validates_the_complete_settings_save_before_writing() {
        let valid_settings = || UpdateSettingsInput {
            daily_capacity_minutes: 240,
            planning_instruction: String::new(),
            ai_provider: "openrouter".into(),
            ai_model: "openai/gpt-5-mini".into(),
            theme: "light".into(),
        };

        assert!(validate_save_settings_input(&SaveSettingsInput {
            settings: valid_settings(),
            api_key_change: ApiKeyChange::Unchanged,
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
            }),
            Err("API key cannot be empty.".into())
        );

        let mut invalid_provider = valid_settings();
        invalid_provider.ai_provider = "unknown".into();
        assert_eq!(
            validate_save_settings_input(&SaveSettingsInput {
                settings: invalid_provider,
                api_key_change: ApiKeyChange::Remove,
            }),
            Err("AI provider is invalid.".into())
        );

        let mut invalid_model = valid_settings();
        invalid_model.ai_model = "custom/model".into();
        assert_eq!(
            validate_save_settings_input(&SaveSettingsInput {
                settings: invalid_model,
                api_key_change: ApiKeyChange::Unchanged,
            }),
            Err("AI model is invalid.".into())
        );

        let mut long_instruction = valid_settings();
        long_instruction.planning_instruction = "a".repeat(2_001);
        assert_eq!(
            validate_save_settings_input(&SaveSettingsInput {
                settings: long_instruction,
                api_key_change: ApiKeyChange::Unchanged,
            }),
            Err("Planning instruction must be 2,000 characters or fewer.".into())
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
                "theme": "light"
            },
            "apiKeyChange": {
                "kind": "replace",
                "apiKey": "not-a-real-secret"
            }
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
            })
            .is_err());
        assert!(database
            .repository
            .create_task(TaskInput {
                title: "Estimate task".into(),
                estimate_minutes: Some(0),
                scheduled_date: None,
            })
            .is_err());
        assert!(database
            .repository
            .create_task(TaskInput {
                title: "Date task".into(),
                estimate_minutes: None,
                scheduled_date: Some("2026-2-1".into()),
            })
            .is_err());
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
            })
            .expect("complete task");
        database
            .repository
            .reorder_tasks(ReorderTasksInput {
                scope: "log:unscheduled".into(),
                task_ids: vec![second.id.clone(), first.id.clone()],
            })
            .expect("reorder tasks");

        let snapshot = database.repository.snapshot().expect("snapshot");
        assert!(snapshot
            .tasks
            .iter()
            .find(|task| task.id == first.id)
            .expect("first task")
            .completed_at
            .is_some());
        assert_eq!(
            snapshot.order_by_scope.get("log:unscheduled"),
            Some(&vec![second.id, first.id]),
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
            })
            .expect("order destination tasks");
        database
            .repository
            .update_task(UpdateTaskInput {
                id: moved.id.clone(),
                title: moved.title,
                estimate_minutes: Some(30),
                scheduled_date: None,
            })
            .expect("move task into destination scope");

        let snapshot = database.repository.snapshot().expect("snapshot");
        assert_eq!(
            snapshot.order_by_scope.get("log:unscheduled"),
            Some(&vec![moved.id, first.id, second.id]),
        );
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
            })
            .expect("order tasks");
        database
            .repository
            .set_task_completed(CompletionInput {
                id: restored.id.clone(),
                completed: true,
            })
            .expect("complete task");
        database
            .repository
            .set_task_completed(CompletionInput {
                id: restored.id.clone(),
                completed: false,
            })
            .expect("restore task");

        let snapshot = database.repository.snapshot().expect("snapshot");
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
            })
            .expect("create order");

        database
            .repository
            .delete_task(task.id)
            .expect("delete task");
        let snapshot = database.repository.snapshot().expect("snapshot");
        assert!(snapshot.tasks.is_empty());
        assert!(snapshot.order_by_scope.is_empty());
    }

    #[test]
    fn planner_plan_rolls_back_when_any_assignment_is_invalid() {
        let mut database = TestDatabase::new();
        let task = create_task(&mut database.repository, "Plan me");

        assert!(database
            .repository
            .apply_planner_plan(ApplyPlannerPlanInput {
                assignments: vec![
                    PlannerPlanAssignment {
                        task_id: task.id.clone(),
                        scheduled_date: "2026-07-21".into(),
                        scope: "today:2026-07-21".into(),
                        position: 0,
                    },
                    PlannerPlanAssignment {
                        task_id: "missing-task".into(),
                        scheduled_date: "2026-07-21".into(),
                        scope: "today:2026-07-21".into(),
                        position: 1,
                    },
                ],
            })
            .is_err());

        let stored_task = database
            .repository
            .tasks()
            .expect("tasks")
            .into_iter()
            .find(|candidate| candidate.id == task.id)
            .expect("task");
        assert_eq!(stored_task.scheduled_date, None);
        assert!(database.repository.orders().expect("orders").is_empty());
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
                }],
                today_task_ids: context.today_task_ids,
                expected_daily_capacity_minutes: context.daily_capacity_minutes,
                expected_remaining_minutes: context.remaining_minutes,
            })
            .expect("accept daily plan");

        let snapshot = database.repository.snapshot().expect("snapshot");
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
                }],
                today_task_ids: context.today_task_ids,
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
}

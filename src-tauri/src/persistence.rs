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
const MIGRATION_1: &str = r#"
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
) VALUES (1, 240, '', 'vercel-gateway', 'openai/gpt-5-mini', 'light');
"#;

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
    today: String,
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
        let ai_availability = if credentials::has_api_key(&settings.ai_provider) {
            "configured"
        } else {
            "unconfigured"
        };

        Ok(PlannerSnapshot {
            tasks,
            order_by_scope,
            settings,
            ai_availability: ai_availability.into(),
            today: local_today(),
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
        self.connection
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
            .map_err(database_error)
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

#[tauri::command]
pub fn get_planner_snapshot(state: State<PersistenceState>) -> Result<PlannerSnapshot, String> {
    with_repository(&state, |repository| repository.snapshot())
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
pub fn update_settings(
    app: AppHandle,
    state: State<PersistenceState>,
    input: UpdateSettingsInput,
) -> Result<(), String> {
    with_repository(&state, |repository| repository.update_settings(input))?;
    emit_change(&app, &state)
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
                "BEGIN IMMEDIATE; {MIGRATION_1} PRAGMA user_version = 1; COMMIT;"
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
    if input.daily_capacity_minutes <= 0 {
        return Err("Daily capacity must be a positive number of minutes.".into());
    }
    if !matches!(input.ai_provider.as_str(), "vercel-gateway" | "openrouter") {
        return Err("AI provider is invalid.".into());
    }
    if input.ai_model.trim().is_empty() {
        return Err("AI model is required.".into());
    }
    if !matches!(input.theme.as_str(), "light" | "dark") {
        return Err("Theme is invalid.".into());
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

        let repository = Repository::open(path.clone()).expect("open database");
        assert_eq!(
            repository
                .settings()
                .expect("settings")
                .daily_capacity_minutes,
            240
        );
        drop(repository);

        let reopened = Repository::open(path).expect("reopen database");
        assert_eq!(reopened.settings().expect("settings").theme, "light");
        drop(reopened);
        fs::remove_dir_all(directory).expect("remove temporary test directory");
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
}

mod ai;
mod credentials;
mod persistence;
mod quick_capture;
mod shortcut_controller;
mod sidecar;
mod window_controller;

use tauri::Manager;

#[tauri::command]
fn open_full_app(app: tauri::AppHandle) -> Result<(), String> {
    window_controller::open_full_app(&app).map_err(|error| error.to_string())
}

#[tauri::command]
fn hide_popover(app: tauri::AppHandle) -> Result<(), String> {
    window_controller::hide_popover(&app).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_shell::init());

    #[cfg(target_os = "macos")]
    let builder = builder.plugin(tauri_nspanel::init());

    builder
        .setup(|app| {
            persistence::setup(app.handle())?;
            quick_capture::setup(app.handle());
            window_controller::setup(app.handle())?;
            let state = app.state::<persistence::PersistenceState>();
            let (enabled, shortcut) = persistence::read_quick_capture_settings(&state)?;
            shortcut_controller::setup(app.handle(), enabled, &shortcut)?;
            Ok(())
        })
        .on_window_event(window_controller::handle_window_event)
        .invoke_handler(tauri::generate_handler![
            open_full_app,
            hide_popover,
            persistence::get_planner_snapshot,
            persistence::create_task,
            persistence::undo_quick_capture,
            quick_capture::get_quick_capture_draft,
            quick_capture::set_quick_capture_draft,
            quick_capture::clear_quick_capture_draft,
            persistence::update_task,
            persistence::set_task_completed,
            persistence::set_task_scheduled_date,
            persistence::delete_task,
            persistence::reorder_tasks,
            persistence::save_settings,
            persistence::retry_persistence,
            ai::generate_ai_assist,
            ai::generate_daily_plan,
            ai::accept_daily_plan,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

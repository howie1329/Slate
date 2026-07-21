mod window_controller;

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
    let builder = tauri::Builder::default();

    #[cfg(target_os = "macos")]
    let builder = builder.plugin(tauri_nspanel::init());

    builder
        .setup(|app| Ok(window_controller::setup(&app.handle())?))
        .on_window_event(window_controller::handle_window_event)
        .invoke_handler(tauri::generate_handler![open_full_app, hide_popover])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

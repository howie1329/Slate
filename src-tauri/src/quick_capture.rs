use std::sync::Mutex;

use chrono::Utc;
use serde::Serialize;
use tauri::{Manager, State};

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct QuickCaptureDraft {
    pub title: String,
    pub updated_at: String,
}

pub struct QuickCaptureState {
    draft: Mutex<Option<QuickCaptureDraft>>,
}

pub fn setup<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    app.manage(QuickCaptureState {
        draft: Mutex::new(None),
    });
}

#[tauri::command]
pub fn get_quick_capture_draft(
    state: State<QuickCaptureState>,
) -> Result<Option<QuickCaptureDraft>, String> {
    state
        .draft
        .lock()
        .map_err(|_| "Quick capture draft is unavailable.".to_string())
        .map(|draft| draft.clone())
}

#[tauri::command]
pub fn set_quick_capture_draft(
    state: State<QuickCaptureState>,
    title: String,
) -> Result<(), String> {
    let mut draft = state
        .draft
        .lock()
        .map_err(|_| "Quick capture draft is unavailable.".to_string())?;
    *draft = Some(QuickCaptureDraft {
        title,
        updated_at: Utc::now().to_rfc3339(),
    });
    Ok(())
}

#[tauri::command]
pub fn clear_quick_capture_draft(state: State<QuickCaptureState>) -> Result<(), String> {
    let mut draft = state
        .draft
        .lock()
        .map_err(|_| "Quick capture draft is unavailable.".to_string())?;
    *draft = None;
    Ok(())
}

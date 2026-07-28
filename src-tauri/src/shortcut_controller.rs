use std::str::FromStr;

use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};

use crate::window_controller;

const REGISTRATION_ERROR_EVENT: &str = "quick-capture://registration-error";

pub fn setup<R: Runtime>(app: &AppHandle<R>, enabled: bool, shortcut: &str) -> tauri::Result<()> {
    let handler = move |app: &AppHandle<R>, _shortcut: &Shortcut, event: ShortcutEvent| {
        if event.state() != ShortcutState::Pressed {
            return;
        }
        if let Err(error) = window_controller::open_quick_capture(app) {
            eprintln!("failed to open Slate's quick capture surface: {error}");
        }
    };
    app.plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(handler)
            .build(),
    )?;

    if let Err(error) = rebind(app, false, "", enabled, shortcut) {
        emit_registration_error(app, &error);
    }
    Ok(())
}

pub fn rebind<R: Runtime>(
    app: &AppHandle<R>,
    previous_enabled: bool,
    previous_shortcut: &str,
    next_enabled: bool,
    next_shortcut: &str,
) -> Result<(), String> {
    let previous = if previous_enabled {
        Some(parse_shortcut(previous_shortcut)?)
    } else {
        None
    };
    let next = if next_enabled {
        Some(parse_shortcut(next_shortcut)?)
    } else {
        None
    };

    let previous_was_registered = previous
        .as_ref()
        .is_some_and(|shortcut| app.global_shortcut().is_registered(shortcut.clone()));
    if previous_was_registered {
        let previous = previous.as_ref().expect("registered previous shortcut");
        app.global_shortcut()
            .unregister(previous.clone())
            .map_err(|error| format!("Could not update the quick capture shortcut: {error}"))?;
    }

    let Some(next) = next else {
        return Ok(());
    };

    if let Err(error) = app.global_shortcut().register(next) {
        if previous_was_registered {
            let previous = previous.expect("registered previous shortcut");
            if let Err(restore_error) = app.global_shortcut().register(previous) {
                eprintln!(
                    "failed to restore Slate's previous quick capture shortcut: {restore_error}"
                );
            }
        }
        return Err(format!("quick-capture-shortcut-conflict: {error}"));
    }

    Ok(())
}

pub fn report_registration_error<R: Runtime>(app: &AppHandle<R>, error: &str) {
    emit_registration_error(app, error);
}

fn parse_shortcut(value: &str) -> Result<Shortcut, String> {
    Shortcut::from_str(value).map_err(|_| "quick-capture-shortcut-invalid".into())
}

fn emit_registration_error<R: Runtime>(app: &AppHandle<R>, error: &str) {
    let _ = app.emit(REGISTRATION_ERROR_EVENT, error.to_string());
}

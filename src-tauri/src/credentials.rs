use keyring::Entry;
use serde::Deserialize;
use tauri::{AppHandle, State};

use crate::persistence::{emit_change, PersistenceState};

const SERVICE_NAME: &str = "com.howardthomas.slate";

fn validate_provider(provider: &str) -> Result<(), String> {
    match provider {
        "vercel-gateway" | "openrouter" => Ok(()),
        _ => Err("Unsupported AI provider.".into()),
    }
}

fn entry(provider: &str) -> Result<Entry, String> {
    validate_provider(provider)?;
    Entry::new(SERVICE_NAME, &format!("ai-api-key:{provider}"))
        .map_err(|error| format!("Could not access the macOS Keychain: {error}"))
}

pub fn has_api_key(provider: &str) -> bool {
    entry(provider)
        .and_then(|entry| {
            entry
                .get_password()
                .map_err(|error| format!("Could not read the macOS Keychain: {error}"))
        })
        .map(|key| !key.trim().is_empty())
        .unwrap_or(false)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyInput {
    provider: String,
    api_key: String,
}

#[tauri::command]
pub fn set_api_key(
    app: AppHandle,
    state: State<PersistenceState>,
    input: ApiKeyInput,
) -> Result<(), String> {
    if input.api_key.trim().is_empty() {
        return Err("API key cannot be empty.".into());
    }

    entry(&input.provider)?
        .set_password(&input.api_key)
        .map_err(|error| format!("Could not save the API key in the macOS Keychain: {error}"))?;
    emit_change(&app, &state)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderInput {
    provider: String,
}

#[tauri::command]
pub fn delete_api_key(
    app: AppHandle,
    state: State<PersistenceState>,
    input: ProviderInput,
) -> Result<(), String> {
    entry(&input.provider)?
        .delete_credential()
        .map_err(|error| {
            format!("Could not remove the API key from the macOS Keychain: {error}")
        })?;
    emit_change(&app, &state)
}

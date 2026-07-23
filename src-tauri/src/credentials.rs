use std::sync::OnceLock;

use keyring::{Entry, Error};
use serde::Deserialize;

const SERVICE_NAME: &str = "com.howardthomas.slate";

#[derive(Debug, Deserialize)]
struct AiCatalog {
    providers: Vec<AiCatalogProvider>,
    models: Vec<AiCatalogModel>,
    default: AiCatalogDefault,
}

#[derive(Debug, Deserialize)]
struct AiCatalogProvider {
    id: String,
}

#[derive(Debug, Deserialize)]
struct AiCatalogModel {
    id: String,
}

#[derive(Debug, Deserialize)]
struct AiCatalogDefault {
    provider: String,
    model: String,
}

static AI_CATALOG: OnceLock<AiCatalog> = OnceLock::new();

fn catalog() -> &'static AiCatalog {
    AI_CATALOG.get_or_init(|| {
        serde_json::from_str(include_str!("../../shared/ai-catalog.json"))
            .expect("shared AI catalog must be valid")
    })
}

pub(crate) fn supported_providers() -> impl Iterator<Item = &'static str> {
    catalog().providers.iter().map(|provider| provider.id.as_str())
}

pub(crate) fn supported_models() -> impl Iterator<Item = &'static str> {
    catalog().models.iter().map(|model| model.id.as_str())
}

pub(crate) fn is_supported_provider(provider: &str) -> bool {
    catalog().providers.iter().any(|item| item.id == provider)
}

pub(crate) fn is_supported_model(model: &str) -> bool {
    supported_models().any(|item| item == model)
}

pub(crate) fn default_provider() -> &'static str {
    catalog().default.provider.as_str()
}

pub(crate) fn default_model() -> &'static str {
    catalog().default.model.as_str()
}

#[derive(Debug, PartialEq)]
pub(crate) enum CredentialAvailability {
    Configured(String),
    Unconfigured,
    Unavailable,
}

#[derive(Debug, PartialEq)]
pub(crate) enum ReadApiKeyError {
    Missing,
    Unavailable,
}

fn validate_provider(provider: &str) -> Result<(), String> {
    if is_supported_provider(provider) {
        Ok(())
    } else {
        Err("Unsupported AI provider.".into())
    }
}

fn entry(provider: &str) -> Result<Entry, String> {
    validate_provider(provider)?;
    Entry::new(SERVICE_NAME, &format!("ai-api-key:{provider}"))
        .map_err(|error| format!("Could not access the macOS Keychain: {error}"))
}

pub(crate) fn credential_availability(provider: &str) -> CredentialAvailability {
    let entry = match entry(provider) {
        Ok(entry) => entry,
        Err(_) => return CredentialAvailability::Unavailable,
    };

    availability_from_password_result(entry.get_password())
}

pub(crate) fn read_api_key(provider: &str) -> Result<String, ReadApiKeyError> {
    match credential_availability(provider) {
        CredentialAvailability::Configured(key) => Ok(key),
        CredentialAvailability::Unconfigured => Err(ReadApiKeyError::Missing),
        CredentialAvailability::Unavailable => Err(ReadApiKeyError::Unavailable),
    }
}

fn availability_from_password_result(result: Result<String, Error>) -> CredentialAvailability {
    match result {
        Ok(key) if !key.trim().is_empty() => CredentialAvailability::Configured(key),
        Ok(_) => CredentialAvailability::Unavailable,
        Err(Error::NoEntry) => CredentialAvailability::Unconfigured,
        Err(_) => CredentialAvailability::Unavailable,
    }
}

pub(crate) fn write_api_key(provider: &str, api_key: &str) -> Result<(), String> {
    if api_key.trim().is_empty() {
        return Err("API key cannot be empty.".into());
    }

    entry(provider)?
        .set_password(api_key.trim())
        .map_err(|error| format!("Could not save the API key in the macOS Keychain: {error}"))
}

pub(crate) fn remove_api_key(provider: &str) -> Result<(), String> {
    match entry(provider)?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(error) => Err(format!(
            "Could not remove the API key from the macOS Keychain: {error}"
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::{availability_from_password_result, CredentialAvailability, Entry, SERVICE_NAME};
    use keyring::{credential::CredentialPersistence, default};

    #[cfg(target_os = "macos")]
    #[test]
    fn uses_a_persistent_macos_credential_store() {
        assert!(matches!(
            default::default_credential_builder().persistence(),
            CredentialPersistence::UntilDelete
        ));
    }

    #[test]
    #[ignore = "accesses the developer macOS Keychain"]
    fn keyring_round_trip_works_for_slate_service() {
        let entry =
            Entry::new(SERVICE_NAME, "codex-keychain-probe").expect("create diagnostic entry");
        let _ = entry.delete_credential();

        entry
            .set_password("not-a-real-secret")
            .expect("write diagnostic credential");
        assert_eq!(
            entry.get_password().expect("read diagnostic credential"),
            "not-a-real-secret"
        );
        entry
            .delete_credential()
            .expect("remove diagnostic credential");
    }

    #[test]
    fn maps_a_missing_key_to_unconfigured() {
        assert_eq!(
            availability_from_password_result(Err(keyring::Error::NoEntry)),
            CredentialAvailability::Unconfigured
        );
    }

    #[test]
    fn maps_keychain_access_failures_to_unavailable() {
        let error = keyring::Error::NoStorageAccess(Box::new(std::io::Error::other("locked")));
        assert_eq!(
            availability_from_password_result(Err(error)),
            CredentialAvailability::Unavailable
        );
    }

    #[test]
    fn maps_a_non_empty_key_to_configured() {
        assert_eq!(
            availability_from_password_result(Ok("not-a-real-secret".into())),
            CredentialAvailability::Configured("not-a-real-secret".into())
        );
    }

    #[test]
    fn maps_an_empty_saved_value_to_unavailable() {
        assert_eq!(
            availability_from_password_result(Ok("   ".into())),
            CredentialAvailability::Unavailable
        );
    }

    #[test]
    fn exposes_every_catalog_provider() {
        assert_eq!(super::supported_providers().collect::<Vec<_>>(), vec!["vercel-gateway", "openrouter"]);
        assert_eq!(
            super::supported_models().collect::<Vec<_>>(),
            vec![
                "openai/gpt-5-mini",
                "anthropic/claude-sonnet-4.5",
                "google/gemini-2.5-flash"
            ]
        );
    }
}

use std::sync::OnceLock;

use keyring::{Entry, Error};
#[cfg(target_os = "macos")]
use security_framework::item::{ItemClass, ItemSearchOptions};
use serde::Deserialize;

const SERVICE_NAME: &str = "com.howardthomas.slate";
const ERR_SEC_ITEM_NOT_FOUND: i32 = -25300;

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
    catalog()
        .providers
        .iter()
        .map(|provider| provider.id.as_str())
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
    Configured,
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
    if validate_provider(provider).is_err() {
        return CredentialAvailability::Unavailable;
    }

    availability_from_item_search(keychain_item_exists(provider))
}

#[cfg(target_os = "macos")]
fn keychain_item_exists(provider: &str) -> Result<bool, i32> {
    ItemSearchOptions::new()
        .class(ItemClass::generic_password())
        .service(SERVICE_NAME)
        .account(&format!("ai-api-key:{provider}"))
        .load_attributes(true)
        .limit(1)
        .skip_authenticated_items(true)
        .search()
        .map(|items| !items.is_empty())
        .map_err(|error| error.code())
}

#[cfg(not(target_os = "macos"))]
fn keychain_item_exists(_: &str) -> Result<bool, i32> {
    Err(-25291)
}

fn availability_from_item_search(result: Result<bool, i32>) -> CredentialAvailability {
    match result {
        Ok(true) => CredentialAvailability::Configured,
        Err(ERR_SEC_ITEM_NOT_FOUND) => CredentialAvailability::Unconfigured,
        Ok(false) | Err(_) => CredentialAvailability::Unavailable,
    }
}

pub(crate) fn read_api_key(provider: &str) -> Result<String, ReadApiKeyError> {
    let entry = match entry(provider) {
        Ok(entry) => entry,
        Err(_) => return Err(ReadApiKeyError::Unavailable),
    };

    api_key_from_password_result(entry.get_password())
}

fn api_key_from_password_result(result: Result<String, Error>) -> Result<String, ReadApiKeyError> {
    match result {
        Ok(key) if !key.trim().is_empty() => Ok(key),
        Ok(_) => Err(ReadApiKeyError::Unavailable),
        Err(Error::NoEntry) => Err(ReadApiKeyError::Missing),
        Err(_) => Err(ReadApiKeyError::Unavailable),
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
    use super::{
        api_key_from_password_result, availability_from_item_search, CredentialAvailability, Entry,
        ReadApiKeyError, ERR_SEC_ITEM_NOT_FOUND, SERVICE_NAME,
    };
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
    fn maps_an_existing_keychain_item_to_configured() {
        assert_eq!(
            availability_from_item_search(Ok(true)),
            CredentialAvailability::Configured
        );
    }

    #[test]
    fn maps_a_missing_keychain_item_to_unconfigured() {
        assert_eq!(
            availability_from_item_search(Err(ERR_SEC_ITEM_NOT_FOUND)),
            CredentialAvailability::Unconfigured
        );
    }

    #[test]
    fn maps_keychain_search_failures_to_unavailable() {
        assert_eq!(
            availability_from_item_search(Err(-25291)),
            CredentialAvailability::Unavailable
        );
        assert_eq!(
            availability_from_item_search(Ok(false)),
            CredentialAvailability::Unavailable
        );
    }

    #[test]
    fn reads_a_non_empty_api_key() {
        assert_eq!(
            api_key_from_password_result(Ok("not-a-real-secret".into())),
            Ok("not-a-real-secret".into())
        );
    }

    #[test]
    fn maps_a_missing_api_key_to_missing() {
        assert_eq!(
            api_key_from_password_result(Err(keyring::Error::NoEntry)),
            Err(ReadApiKeyError::Missing)
        );
    }

    #[test]
    fn maps_keychain_read_failures_to_unavailable() {
        let error = keyring::Error::NoStorageAccess(Box::new(std::io::Error::other("locked")));
        assert_eq!(
            api_key_from_password_result(Err(error)),
            Err(ReadApiKeyError::Unavailable)
        );
    }

    #[test]
    fn maps_an_empty_saved_value_to_unavailable() {
        assert_eq!(
            api_key_from_password_result(Ok("   ".into())),
            Err(ReadApiKeyError::Unavailable)
        );
    }

    #[test]
    fn exposes_every_catalog_provider() {
        assert_eq!(
            super::supported_providers().collect::<Vec<_>>(),
            vec!["vercel-gateway", "openrouter"]
        );
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

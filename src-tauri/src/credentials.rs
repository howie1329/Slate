use keyring::{Entry, Error};

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
    read_api_key(provider).is_ok()
}

pub(crate) fn read_api_key(provider: &str) -> Result<String, String> {
    let key = entry(provider).and_then(|entry| {
        entry
            .get_password()
            .map_err(|_| "AI provider key is unavailable.".into())
    })?;

    if key.trim().is_empty() {
        return Err("AI provider key is unavailable.".into());
    }

    Ok(key)
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
    use super::{Entry, SERVICE_NAME};

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
}

use std::time::Duration;

use serde::Deserialize;
use tauri::AppHandle;
use tauri_plugin_shell::{
    process::{CommandEvent, TerminatedPayload},
    ShellExt,
};

const SIDECAR_NAME: &str = "slate-ai-sidecar";
const PROBE_ENVIRONMENT_VARIABLE: &str = "SLATE_SIDECAR_PROBE";
const MAX_STDOUT_BYTES: usize = 64 * 1024;
const MAX_STDERR_BYTES: usize = 64 * 1024;
const PROBE_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct SidecarResponse {
    ok: bool,
    result: Option<SidecarResult>,
    error: Option<SidecarError>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct SidecarResult {
    operation: String,
    status: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct SidecarError {
    category: String,
}

pub fn start_probe_if_requested(app: &AppHandle) {
    if std::env::var(PROBE_ENVIRONMENT_VARIABLE).as_deref() != Ok("1") {
        return;
    }

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        for operation in ["health", "sdk-load"] {
            match run_probe(&app, operation).await {
                Ok(()) => println!("Slate sidecar probe {operation}: ready"),
                Err(error) => eprintln!("Slate sidecar probe {operation}: {error}"),
            }
        }
    });
}

async fn run_probe(app: &AppHandle, operation: &str) -> Result<(), String> {
    let command = app
        .shell()
        .sidecar(SIDECAR_NAME)
        .map_err(|error| format!("Could not resolve the bundled sidecar: {error}"))?
        .set_raw_out(true);
    let (mut events, mut child) = command
        .spawn()
        .map_err(|error| format!("Could not start the bundled sidecar: {error}"))?;

    let request = format!("{{\"version\":1,\"operation\":\"{operation}\"}}\n");
    if let Err(error) = child.write(request.as_bytes()) {
        let _ = child.kill();
        return Err(format!("Could not write to the bundled sidecar: {error}"));
    }

    let collected = tokio::time::timeout(PROBE_TIMEOUT, async {
        let mut stdout = Vec::new();
        let mut stderr_bytes = 0_usize;

        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    if stdout.len().saturating_add(bytes.len()) > MAX_STDOUT_BYTES {
                        return Err("Sidecar stdout exceeded its limit.".to_string());
                    }
                    stdout.extend(bytes);
                }
                CommandEvent::Stderr(bytes) => {
                    if stderr_bytes.saturating_add(bytes.len()) > MAX_STDERR_BYTES {
                        return Err("Sidecar stderr exceeded its limit.".to_string());
                    }
                    stderr_bytes += bytes.len();
                }
                CommandEvent::Error(error) => return Err(error),
                CommandEvent::Terminated(payload) => {
                    return validate_response(operation, stdout, payload);
                }
                _ => {}
            }
        }

        Err("Sidecar exited without a termination event.".to_string())
    })
    .await;

    match collected {
        Ok(result) => {
            if result.is_err() {
                let _ = child.kill();
            }
            result
        }
        Err(_) => {
            let _ = child.kill();
            Err("Sidecar probe timed out.".into())
        }
    }
}

fn validate_response(
    operation: &str,
    stdout: Vec<u8>,
    termination: TerminatedPayload,
) -> Result<(), String> {
    if termination.code != Some(0) {
        return Err(format!("Sidecar exited with code {:?}.", termination.code));
    }

    let response_text =
        String::from_utf8(stdout).map_err(|_| "Sidecar returned non-UTF-8 output.".to_string())?;
    let lines = response_text.lines().collect::<Vec<_>>();
    if lines.len() != 1 {
        return Err("Sidecar returned an invalid number of response lines.".into());
    }

    let response: SidecarResponse = serde_json::from_str(lines[0])
        .map_err(|_| "Sidecar returned malformed JSON.".to_string())?;
    if !response.ok {
        if response.result.is_some() {
            return Err("Sidecar returned an invalid error response.".into());
        }
        let category = response
            .error
            .map(|error| error.category)
            .unwrap_or_else(|| "internal".into());
        return Err(format!("Sidecar returned {category}."));
    }
    if response.error.is_some() {
        return Err("Sidecar returned an invalid success response.".into());
    }

    let result = response
        .result
        .ok_or_else(|| "Sidecar response omitted its result.".to_string())?;
    if result.operation != operation || result.status != "ready" {
        return Err("Sidecar response did not match the requested probe.".into());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn terminated(code: Option<i32>) -> TerminatedPayload {
        TerminatedPayload { code, signal: None }
    }

    #[test]
    fn validates_a_ready_response() {
        let output = br#"{"ok":true,"result":{"operation":"health","status":"ready"}}
"#;
        assert!(validate_response("health", output.to_vec(), terminated(Some(0))).is_ok());
    }

    #[test]
    fn rejects_a_non_zero_exit() {
        let result = validate_response("health", Vec::new(), terminated(Some(1)));
        assert!(result.is_err());
    }

    #[test]
    fn rejects_trailing_response_lines() {
        let output = br#"{"ok":true,"result":{"operation":"health","status":"ready"}}
extra
"#;
        let result = validate_response("health", output.to_vec(), terminated(Some(0)));
        assert!(result.is_err());
    }

    #[test]
    fn rejects_malformed_json() {
        let result = validate_response("health", b"not-json\n".to_vec(), terminated(Some(0)));
        assert!(result.is_err());
    }

    #[test]
    fn rejects_a_mismatched_response() {
        let output = br#"{"ok":true,"result":{"operation":"sdk-load","status":"ready"}}
"#;
        let result = validate_response("health", output.to_vec(), terminated(Some(0)));
        assert!(result.is_err());
    }

    #[test]
    fn rejects_an_ambiguous_response() {
        let output = br#"{"ok":true,"result":{"operation":"health","status":"ready"},"error":{"category":"internal"}}
"#;
        let result = validate_response("health", output.to_vec(), terminated(Some(0)));
        assert!(result.is_err());
    }
}

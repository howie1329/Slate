use std::time::Duration;

use serde::Deserialize;
use tauri::AppHandle;
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

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
    let request = format!("{{\"version\":1,\"operation\":\"{operation}\"}}");
    let response = run_sidecar_request(app, &request).await?;
    validate_response(operation, &response)
}

pub(crate) async fn run_sidecar_request(app: &AppHandle, request: &str) -> Result<String, String> {
    let command = app
        .shell()
        .sidecar(SIDECAR_NAME)
        .map_err(|error| format!("Could not resolve the bundled sidecar: {error}"))?
        .set_raw_out(true);
    let (mut events, mut child) = command
        .spawn()
        .map_err(|error| format!("Could not start the bundled sidecar: {error}"))?;

    let request = format!("{}\n", request.trim_end_matches('\n'));
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
                    validate_exit_code(payload.code)?;
                    return response_line(stdout);
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
            Err("Sidecar request timed out.".into())
        }
    }
}

fn validate_exit_code(code: Option<i32>) -> Result<(), String> {
    if code == Some(0) {
        Ok(())
    } else {
        Err(format!("Sidecar exited with code {:?}.", code))
    }
}

fn response_line(stdout: Vec<u8>) -> Result<String, String> {
    let response_text =
        String::from_utf8(stdout).map_err(|_| "Sidecar returned non-UTF-8 output.".to_string())?;
    let lines = response_text.lines().collect::<Vec<_>>();
    if lines.len() != 1 {
        return Err("Sidecar returned an invalid number of response lines.".into());
    }

    Ok(lines[0].to_string())
}

fn validate_response(operation: &str, response_line: &str) -> Result<(), String> {
    let response: SidecarResponse = serde_json::from_str(response_line)
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

    #[test]
    fn validates_a_ready_response() {
        let output = br#"{"ok":true,"result":{"operation":"health","status":"ready"}}
"#;
        assert!(validate_response("health", std::str::from_utf8(output).unwrap()).is_ok());
    }

    #[test]
    fn rejects_a_non_zero_exit() {
        assert!(validate_exit_code(Some(1)).is_err());
        assert!(validate_exit_code(None).is_err());
    }

    #[test]
    fn rejects_trailing_response_lines() {
        let output = br#"{"ok":true,"result":{"operation":"health","status":"ready"}}
extra
"#;
        let result =
            response_line(output.to_vec()).and_then(|line| validate_response("health", &line));
        assert!(result.is_err());
    }

    #[test]
    fn rejects_malformed_json() {
        let result = validate_response("health", "not-json");
        assert!(result.is_err());
    }

    #[test]
    fn rejects_a_mismatched_response() {
        let output = br#"{"ok":true,"result":{"operation":"sdk-load","status":"ready"}}
"#;
        let result = validate_response("health", std::str::from_utf8(output).unwrap());
        assert!(result.is_err());
    }

    #[test]
    fn rejects_an_ambiguous_response() {
        let output = br#"{"ok":true,"result":{"operation":"health","status":"ready"},"error":{"category":"internal"}}
"#;
        let result = validate_response("health", std::str::from_utf8(output).unwrap());
        assert!(result.is_err());
    }
}

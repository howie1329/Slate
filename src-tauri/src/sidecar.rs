use std::time::Duration;

use tauri::AppHandle;
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

const SIDECAR_NAME: &str = "slate-ai-sidecar";
const MAX_STDOUT_BYTES: usize = 64 * 1024;
const MAX_STDERR_BYTES: usize = 64 * 1024;
pub(crate) const AI_REQUEST_TIMEOUT: Duration = Duration::from_secs(16);

#[derive(Debug, PartialEq)]
pub(crate) enum SidecarFailure {
    Resolve,
    Spawn,
    Write,
    Timeout,
    StdoutLimit,
    StderrLimit,
    Process,
    NonZeroExit,
    MalformedOutput,
}

pub(crate) async fn run_sidecar_request(
    app: &AppHandle,
    request: &str,
    timeout: Duration,
) -> Result<String, SidecarFailure> {
    let command = app
        .shell()
        .sidecar(SIDECAR_NAME)
        .map_err(|_| SidecarFailure::Resolve)?
        .set_raw_out(true);
    let (mut events, mut child) = command.spawn().map_err(|_| SidecarFailure::Spawn)?;

    let request = format!("{}\n", request.trim_end_matches('\n'));
    if child.write(request.as_bytes()).is_err() {
        let _ = child.kill();
        return Err(SidecarFailure::Write);
    }

    let collected = tokio::time::timeout(timeout, async {
        let mut stdout = Vec::new();
        let mut stderr_bytes = 0_usize;

        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    append_stdout(&mut stdout, &bytes)?;
                }
                CommandEvent::Stderr(bytes) => {
                    if stderr_bytes.saturating_add(bytes.len()) > MAX_STDERR_BYTES {
                        return Err(SidecarFailure::StderrLimit);
                    }
                    stderr_bytes += bytes.len();
                }
                CommandEvent::Error(_) => return Err(SidecarFailure::Process),
                CommandEvent::Terminated(payload) => {
                    if payload.code != Some(0) {
                        return Err(SidecarFailure::NonZeroExit);
                    }
                    return response_line(stdout);
                }
                _ => {}
            }
        }

        Err(SidecarFailure::Process)
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
            Err(SidecarFailure::Timeout)
        }
    }
}

fn response_line(stdout: Vec<u8>) -> Result<String, SidecarFailure> {
    let response_text = String::from_utf8(stdout).map_err(|_| SidecarFailure::MalformedOutput)?;
    let mut lines = response_text.lines();
    let Some(line) = lines.next() else {
        return Err(SidecarFailure::MalformedOutput);
    };
    if lines.next().is_some() || line.trim().is_empty() {
        return Err(SidecarFailure::MalformedOutput);
    }

    Ok(line.to_string())
}

fn append_stdout(stdout: &mut Vec<u8>, bytes: &[u8]) -> Result<(), SidecarFailure> {
    if stdout.len().saturating_add(bytes.len()) > MAX_STDOUT_BYTES {
        return Err(SidecarFailure::StdoutLimit);
    }
    stdout.extend(bytes);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uses_a_deadline_longer_than_the_provider_budget() {
        assert!(AI_REQUEST_TIMEOUT > Duration::from_secs(12));
    }

    #[test]
    fn keeps_process_failures_typed() {
        assert_ne!(SidecarFailure::NonZeroExit, SidecarFailure::Timeout);
        assert_ne!(SidecarFailure::Process, SidecarFailure::MalformedOutput);
    }

    #[test]
    fn rejects_malformed_and_oversized_output() {
        assert_eq!(response_line(Vec::new()), Err(SidecarFailure::MalformedOutput));
        assert_eq!(append_stdout(&mut Vec::new(), &vec![b'x'; MAX_STDOUT_BYTES + 1]), Err(SidecarFailure::StdoutLimit));
    }

    #[test]
    fn rejects_multiple_response_lines() {
        assert_eq!(
            response_line(b"{}\nextra\n".to_vec()),
            Err(SidecarFailure::MalformedOutput)
        );
    }
}

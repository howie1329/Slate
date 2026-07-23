use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::{
    credentials,
    persistence::{self, AiAssistTaskContext, PersistenceState},
    sidecar,
};

const MAX_CAPTURE_CHARS: usize = 2_000;
const MAX_TITLE_CHARS: usize = 240;
const MAX_ESTIMATE_MINUTES: i64 = 1_440;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiAssistInput {
    capture: String,
    scheduled_date: Option<String>,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiAssistProposal {
    pub title: String,
    pub estimate_minutes: i64,
    pub scheduled_date: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AssistRequest {
    version: u8,
    operation: &'static str,
    provider: String,
    model: String,
    api_key: String,
    input: AssistRequestInput,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AssistRequestInput {
    capture: String,
    today: String,
    scheduled_date: Option<String>,
    today_tasks: Vec<AssistTaskContext>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AssistTaskContext {
    id: String,
    title: String,
    estimate_minutes: Option<i64>,
    scheduled_date: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct SidecarResponse {
    ok: bool,
    result: Option<SidecarAssistResult>,
    error: Option<SidecarError>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct SidecarAssistResult {
    operation: String,
    proposal: SidecarProposal,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct SidecarProposal {
    title: String,
    #[serde(rename = "estimateMinutes")]
    estimate_minutes: i64,
    #[serde(rename = "scheduledDate")]
    scheduled_date: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct SidecarError {
    category: String,
}

#[tauri::command]
pub async fn generate_ai_assist(
    app: AppHandle,
    state: State<'_, PersistenceState>,
    input: AiAssistInput,
) -> Result<AiAssistProposal, String> {
    validate_input(&input)?;

    let context =
        persistence::read_ai_assist_context(&state).map_err(|_| "internal".to_string())?;
    let api_key =
        credentials::read_api_key(&context.provider).map_err(|_| "unavailable-key".to_string())?;
    let request = AssistRequest {
        version: 1,
        operation: "assist",
        provider: context.provider,
        model: context.model,
        api_key,
        input: AssistRequestInput {
            capture: input.capture.trim().to_string(),
            today: context.today,
            scheduled_date: input.scheduled_date.clone(),
            today_tasks: context
                .today_tasks
                .into_iter()
                .map(AssistTaskContext::from)
                .collect(),
        },
    };
    let serialized = serde_json::to_string(&request).map_err(|_| "internal".to_string())?;
    let response = sidecar::run_sidecar_request(&app, &serialized)
        .await
        .map_err(|error| {
            if error.contains("timed out") {
                "timeout".to_string()
            } else {
                "internal".to_string()
            }
        })?;

    parse_response(&response, input.scheduled_date.as_deref())
}

impl From<AiAssistTaskContext> for AssistTaskContext {
    fn from(context: AiAssistTaskContext) -> Self {
        Self {
            id: context.id,
            title: context.title,
            estimate_minutes: context.estimate_minutes,
            scheduled_date: context.scheduled_date,
        }
    }
}

fn validate_input(input: &AiAssistInput) -> Result<(), String> {
    let capture = input.capture.trim();
    if capture.is_empty() || capture.chars().count() > MAX_CAPTURE_CHARS {
        return Err("invalid-request".into());
    }
    validate_date(input.scheduled_date.as_deref())
}

fn parse_response(response: &str, explicit_date: Option<&str>) -> Result<AiAssistProposal, String> {
    let response: SidecarResponse =
        serde_json::from_str(response).map_err(|_| "malformed-output")?;
    if !response.ok {
        if response.result.is_some() {
            return Err("malformed-output".into());
        }
        return Err(response
            .error
            .map(|error| normalize_error_category(&error.category))
            .unwrap_or("internal")
            .into());
    }
    if response.error.is_some() {
        return Err("malformed-output".into());
    }

    let result = response.result.ok_or("malformed-output")?;
    if result.operation != "assist" {
        return Err("malformed-output".into());
    }
    validate_proposal(result.proposal, explicit_date)
}

fn validate_proposal(
    proposal: SidecarProposal,
    explicit_date: Option<&str>,
) -> Result<AiAssistProposal, String> {
    let title = proposal.title.trim();
    if title.is_empty() || title.chars().count() > MAX_TITLE_CHARS {
        return Err("malformed-output".into());
    }
    if !(1..=MAX_ESTIMATE_MINUTES).contains(&proposal.estimate_minutes) {
        return Err("no-proposal".into());
    }
    validate_date(proposal.scheduled_date.as_deref())
        .map_err(|_| "malformed-output".to_string())?;

    Ok(AiAssistProposal {
        title: title.to_string(),
        estimate_minutes: proposal.estimate_minutes,
        scheduled_date: explicit_date
            .map(str::to_string)
            .or(proposal.scheduled_date),
    })
}

fn validate_date(date: Option<&str>) -> Result<(), String> {
    let Some(date) = date else {
        return Ok(());
    };
    match NaiveDate::parse_from_str(date, "%Y-%m-%d") {
        Ok(parsed) if parsed.format("%Y-%m-%d").to_string() == date => Ok(()),
        _ => Err("invalid-request".into()),
    }
}

fn normalize_error_category(category: &str) -> &'static str {
    match category {
        "unavailable-key" => "unavailable-key",
        "timeout" => "timeout",
        "network" => "network",
        "provider-rejected" => "provider-rejected",
        "malformed-output" => "malformed-output",
        "no-proposal" => "no-proposal",
        "internal" => "internal",
        _ => "internal",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn response(proposal: &str) -> String {
        format!(r#"{{"ok":true,"result":{{"operation":"assist","proposal":{proposal}}}}}"#)
    }

    #[test]
    fn preserves_an_explicit_date() {
        let result = parse_response(
            &response(r#"{"title":"Prepare notes","estimateMinutes":30,"scheduledDate":null}"#),
            Some("2026-07-23"),
        )
        .unwrap();

        assert_eq!(result.scheduled_date.as_deref(), Some("2026-07-23"));
    }

    #[test]
    fn rejects_an_invalid_proposal_date() {
        let result = parse_response(
            &response(
                r#"{"title":"Prepare notes","estimateMinutes":30,"scheduledDate":"tomorrow"}"#,
            ),
            None,
        );

        assert_eq!(result, Err("malformed-output".into()));
    }

    #[test]
    fn maps_unknown_sidecar_errors_to_internal() {
        assert_eq!(normalize_error_category("provider-secret"), "internal");
    }
}

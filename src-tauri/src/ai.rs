use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::{
    credentials,
    persistence::{
        self, AiAssistTaskContext, AiPlanContext, DailyPlanAcceptanceInput,
        DailyPlanAcceptanceItem, PersistenceState,
    },
    sidecar,
};

const MAX_CAPTURE_CHARS: usize = 2_000;
const MAX_TITLE_CHARS: usize = 240;
const MAX_ESTIMATE_MINUTES: i64 = 1_440;
const MAX_PLAN_ITEMS: usize = 50;

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

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiPlanItem {
    pub id: String,
    pub title: String,
    pub estimate_minutes: i64,
    pub source_scheduled_date: Option<String>,
    pub scheduled_date: String,
    pub position: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiPlanProposal {
    pub items: Vec<AiPlanItem>,
    pub total_minutes: i64,
    pub remaining_minutes: i64,
    pub rationale: Option<String>,
    pub empty_reason: Option<String>,
    pub today_task_ids: Vec<String>,
    pub expected_daily_capacity_minutes: i64,
    pub expected_remaining_minutes: i64,
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PlanRequest {
    version: u8,
    operation: &'static str,
    provider: String,
    model: String,
    api_key: String,
    input: PlanRequestInput,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PlanRequestInput {
    today: String,
    daily_capacity_minutes: i64,
    remaining_minutes: i64,
    today_tasks: Vec<AssistTaskContext>,
    candidates: Vec<PlanCandidate>,
    planning_instruction: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PlanCandidate {
    id: String,
    title: String,
    estimate_minutes: i64,
    scheduled_date: Option<String>,
    source_scope: String,
    backlog_position: usize,
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
struct SidecarPlanResponse {
    ok: bool,
    result: Option<SidecarPlanResult>,
    error: Option<SidecarError>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct SidecarPlanResult {
    operation: String,
    proposal: SidecarPlanProposal,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SidecarPlanProposal {
    task_ids: Vec<String>,
    rationale: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiPlanAcceptanceInput {
    items: Vec<AiPlanAcceptanceItem>,
    today_task_ids: Vec<String>,
    expected_daily_capacity_minutes: i64,
    expected_remaining_minutes: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiPlanAcceptanceItem {
    id: String,
    title: String,
    estimate_minutes: i64,
    source_scheduled_date: Option<String>,
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

#[tauri::command]
pub async fn generate_daily_plan(
    app: AppHandle,
    state: State<'_, PersistenceState>,
) -> Result<AiPlanProposal, String> {
    let context = persistence::read_ai_plan_context(&state).map_err(|_| "internal".to_string())?;
    if context.remaining_minutes == 0 {
        return Ok(empty_plan_proposal(&context, "no-capacity"));
    }
    if context.candidates.is_empty() {
        return Ok(empty_plan_proposal(&context, "no-eligible-tasks"));
    }

    let api_key =
        credentials::read_api_key(&context.provider).map_err(|_| "unavailable-key".to_string())?;
    let request = PlanRequest {
        version: 1,
        operation: "plan",
        provider: context.provider.clone(),
        model: context.model.clone(),
        api_key,
        input: PlanRequestInput {
            today: context.today.clone(),
            daily_capacity_minutes: context.daily_capacity_minutes,
            remaining_minutes: context.remaining_minutes,
            today_tasks: context
                .today_tasks
                .iter()
                .cloned()
                .map(AssistTaskContext::from)
                .collect(),
            candidates: context
                .candidates
                .iter()
                .map(|candidate| PlanCandidate {
                    id: candidate.id.clone(),
                    title: candidate.title.clone(),
                    estimate_minutes: candidate.estimate_minutes,
                    scheduled_date: candidate.scheduled_date.clone(),
                    source_scope: candidate.source_scope.clone(),
                    backlog_position: candidate.backlog_position,
                })
                .collect(),
            planning_instruction: context.planning_instruction.clone(),
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

    parse_plan_response(&response, &context)
}

#[tauri::command]
pub fn accept_daily_plan(
    app: AppHandle,
    state: State<'_, PersistenceState>,
    input: AiPlanAcceptanceInput,
) -> Result<(), String> {
    let persistence_input = DailyPlanAcceptanceInput {
        items: input
            .items
            .into_iter()
            .map(|item| DailyPlanAcceptanceItem {
                id: item.id,
                title: item.title,
                estimate_minutes: item.estimate_minutes,
                source_scheduled_date: item.source_scheduled_date,
            })
            .collect(),
        today_task_ids: input.today_task_ids,
        expected_daily_capacity_minutes: input.expected_daily_capacity_minutes,
        expected_remaining_minutes: input.expected_remaining_minutes,
    };
    persistence::accept_daily_plan(&state, persistence_input)?;
    persistence::emit_change(&app, &state)
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

fn empty_plan_proposal(context: &AiPlanContext, reason: &str) -> AiPlanProposal {
    AiPlanProposal {
        items: Vec::new(),
        total_minutes: 0,
        remaining_minutes: context.remaining_minutes,
        rationale: None,
        empty_reason: Some(reason.to_string()),
        today_task_ids: context.today_task_ids.clone(),
        expected_daily_capacity_minutes: context.daily_capacity_minutes,
        expected_remaining_minutes: context.remaining_minutes,
    }
}

fn parse_plan_response(response: &str, context: &AiPlanContext) -> Result<AiPlanProposal, String> {
    let response: SidecarPlanResponse =
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
    if result.operation != "plan" {
        return Err("malformed-output".into());
    }
    if result.proposal.task_ids.len() > MAX_PLAN_ITEMS {
        return Err("malformed-output".into());
    }

    let mut selected_ids = std::collections::HashSet::new();
    let mut items = Vec::new();
    let mut total_minutes = 0_i64;
    for task_id in result.proposal.task_ids {
        if !selected_ids.insert(task_id.clone()) {
            return Err("malformed-output".into());
        }
        let candidate = context
            .candidates
            .iter()
            .find(|candidate| candidate.id == task_id)
            .ok_or("malformed-output")?;
        total_minutes = total_minutes
            .checked_add(candidate.estimate_minutes)
            .ok_or("malformed-output")?;
        if total_minutes > context.remaining_minutes {
            return Err("no-proposal".into());
        }
        items.push(AiPlanItem {
            id: candidate.id.clone(),
            title: candidate.title.clone(),
            estimate_minutes: candidate.estimate_minutes,
            source_scheduled_date: candidate.scheduled_date.clone(),
            scheduled_date: context.today.clone(),
            position: context.today_task_ids.len() as i64 + items.len() as i64,
        });
    }

    Ok(AiPlanProposal {
        items,
        total_minutes,
        remaining_minutes: context.remaining_minutes.saturating_sub(total_minutes),
        rationale: result
            .proposal
            .rationale
            .map(|rationale| rationale.trim().to_string())
            .filter(|rationale| !rationale.is_empty()),
        empty_reason: if selected_ids.is_empty() {
            Some("no-fitting-plan".into())
        } else {
            None
        },
        today_task_ids: context.today_task_ids.clone(),
        expected_daily_capacity_minutes: context.daily_capacity_minutes,
        expected_remaining_minutes: context.remaining_minutes,
    })
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
    use crate::persistence::AiPlanTaskContext;

    fn plan_context() -> AiPlanContext {
        AiPlanContext {
            provider: "openrouter".into(),
            model: "test-model".into(),
            today: "2026-07-23".into(),
            daily_capacity_minutes: 240,
            remaining_minutes: 120,
            today_tasks: Vec::new(),
            today_task_ids: vec!["today-task".into()],
            candidates: vec![AiPlanTaskContext {
                id: "backlog-task".into(),
                title: "Backlog task".into(),
                estimate_minutes: 30,
                scheduled_date: None,
                source_scope: "log:unscheduled".into(),
                backlog_position: 0,
            }],
            planning_instruction: String::new(),
        }
    }

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

    #[test]
    fn maps_plan_ids_to_native_today_assignments() {
        let result = parse_plan_response(
            r#"{"ok":true,"result":{"operation":"plan","proposal":{"taskIds":["backlog-task"],"rationale":"Fits."}}}"#,
            &plan_context(),
        )
        .expect("plan proposal");

        assert_eq!(result.items[0].id, "backlog-task");
        assert_eq!(result.items[0].scheduled_date, "2026-07-23");
        assert_eq!(result.items[0].position, 1);
        assert_eq!(result.remaining_minutes, 90);
    }

    #[test]
    fn rejects_plan_ids_outside_native_candidates() {
        let result = parse_plan_response(
            r#"{"ok":true,"result":{"operation":"plan","proposal":{"taskIds":["unknown"],"rationale":null}}}"#,
            &plan_context(),
        );

        assert_eq!(result, Err("malformed-output".into()));
    }
}

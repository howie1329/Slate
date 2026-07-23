import { z } from "zod";
import catalog from "../../shared/ai-catalog.json" with { type: "json" };

const providerSchema = z.enum(
  catalog.providers.map((provider) => provider.id) as [string, ...string[]],
);
const modelSchema = z.enum(
  catalog.models.map((model) => model.id) as [string, ...string[]],
);
const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const assistRequestSchema = z.object({
  version: z.literal(1),
  operation: z.literal("assist"),
  provider: providerSchema,
  model: modelSchema,
  apiKey: z.string().min(1).max(512),
  input: z.object({
    capture: z.string().trim().min(1).max(2000),
    today: localDateSchema,
    scheduledDate: localDateSchema.nullable(),
  }).strict(),
}).strict();

const planTaskContextSchema = z.object({
  id: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(240),
  estimateMinutes: z.number().int().positive().max(1440).nullable(),
  scheduledDate: localDateSchema.nullable(),
}).strict();

const planCandidateSchema = z.object({
  id: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(240),
  estimateMinutes: z.number().int().positive().max(1440),
  scheduledDate: localDateSchema.nullable(),
  sourceScope: z.enum(["log:unscheduled", "log:overdue"]),
  backlogPosition: z.number().int().nonnegative().max(50),
}).strict();

const planRequestSchema = z.object({
  version: z.literal(1),
  operation: z.literal("plan"),
  provider: providerSchema,
  model: modelSchema,
  apiKey: z.string().min(1).max(512),
  input: z.object({
    today: localDateSchema,
    dailyCapacityMinutes: z.number().int().positive().max(10080),
    remainingMinutes: z.number().int().nonnegative().max(10080),
    todayTasks: z.array(planTaskContextSchema).max(50),
    candidates: z.array(planCandidateSchema).max(50),
    planningInstruction: z.string().trim().max(2000),
  }).strict(),
}).strict();

export const sidecarRequestSchema = z.discriminatedUnion("operation", [
  assistRequestSchema,
  planRequestSchema,
]);

export type SidecarRequest = z.infer<typeof sidecarRequestSchema>;
export type AssistRequest = z.infer<typeof assistRequestSchema>;
export type PlanRequest = z.infer<typeof planRequestSchema>;

export const assistProposalSchema = z.object({
  title: z.string().trim().min(1).max(240),
  estimateMinutes: z.number().int().positive().max(1440),
  scheduledDate: localDateSchema.nullable(),
}).strict();

export type AssistProposal = z.infer<typeof assistProposalSchema>;

export const planProposalSchema = z.object({
  taskIds: z.array(z.string().trim().min(1).max(100)).max(50),
  rationale: z.string().trim().max(500).nullable(),
}).strict().superRefine((proposal, context) => {
  if (new Set(proposal.taskIds).size !== proposal.taskIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Plan task IDs must be unique.",
      path: ["taskIds"],
    });
  }
});

export type PlanProposal = z.infer<typeof planProposalSchema>;

export type SidecarErrorCategory =
  | "invalid-request"
  | "unavailable-key"
  | "credentials-unavailable"
  | "timeout"
  | "network"
  | "provider-rejected"
  | "malformed-output"
  | "no-proposal"
  | "internal";

export type SidecarResponse =
  | {
      ok: true;
      result: {
        operation: "assist";
        proposal: AssistProposal;
      };
    }
  | {
      ok: true;
      result: {
        operation: "plan";
        proposal: PlanProposal;
      };
    }
  | {
      ok: false;
      error: {
        category: SidecarErrorCategory;
      };
    };

export const MAX_REQUEST_BYTES = 64 * 1024;

export function parseRequest(line: string): SidecarRequest {
  if (Buffer.byteLength(line, "utf8") > MAX_REQUEST_BYTES) {
    throw new Error("Request is too large.");
  }

  return sidecarRequestSchema.parse(JSON.parse(line));
}

export function assistResponse(proposal: AssistProposal): SidecarResponse {
  return {
    ok: true,
    result: { operation: "assist", proposal },
  };
}

export function planResponse(proposal: PlanProposal): SidecarResponse {
  return {
    ok: true,
    result: { operation: "plan", proposal },
  };
}

export function errorResponse(category: SidecarErrorCategory): SidecarResponse {
  return { ok: false, error: { category } };
}

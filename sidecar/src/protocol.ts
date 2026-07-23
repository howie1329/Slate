import { z } from "zod";

const providerSchema = z.enum(["vercel-gateway", "openrouter"]);
const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const healthRequestSchema = z.object({
  version: z.literal(1),
  operation: z.literal("health"),
}).strict();

const sdkLoadRequestSchema = z.object({
  version: z.literal(1),
  operation: z.literal("sdk-load"),
}).strict();

const assistTaskContextSchema = z.object({
  id: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(240),
  estimateMinutes: z.number().int().positive().max(1440).nullable(),
  scheduledDate: localDateSchema.nullable(),
}).strict();

const assistRequestSchema = z.object({
  version: z.literal(1),
  operation: z.literal("assist"),
  provider: providerSchema,
  model: z.string().trim().min(1).max(240),
  apiKey: z.string().min(1).max(512),
  input: z.object({
    capture: z.string().trim().min(1).max(2000),
    today: z.string(),
    scheduledDate: localDateSchema.nullable(),
    todayTasks: z.array(assistTaskContextSchema).max(50),
  }).strict(),
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
  model: z.string().trim().min(1).max(240),
  apiKey: z.string().min(1).max(512),
  input: z.object({
    today: localDateSchema,
    dailyCapacityMinutes: z.number().int().positive().max(10080),
    remainingMinutes: z.number().int().nonnegative().max(10080),
    todayTasks: z.array(assistTaskContextSchema).max(50),
    candidates: z.array(planCandidateSchema).max(50),
    planningInstruction: z.string().trim().max(2000),
  }).strict(),
}).strict();

export const spikeRequestSchema = z.discriminatedUnion("operation", [
  healthRequestSchema,
  sdkLoadRequestSchema,
  assistRequestSchema,
  planRequestSchema,
]);

export type SpikeRequest = z.infer<typeof spikeRequestSchema>;
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
  | "timeout"
  | "network"
  | "provider-rejected"
  | "malformed-output"
  | "no-proposal"
  | "internal";

export type SpikeResponse =
  | {
      ok: true;
      result: {
        operation: "health" | "sdk-load";
        status: "ready";
      };
    }
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

export function parseRequest(line: string): SpikeRequest {
  if (Buffer.byteLength(line, "utf8") > MAX_REQUEST_BYTES) {
    throw new Error("Request is too large.");
  }

  return spikeRequestSchema.parse(JSON.parse(line));
}

export function readyResponse(operation: SpikeRequest["operation"]): SpikeResponse {
  if (operation === "assist" || operation === "plan") {
    throw new Error("AI operation responses require a proposal.");
  }

  return {
    ok: true,
    result: { operation, status: "ready" },
  };
}

export function assistResponse(proposal: AssistProposal): SpikeResponse {
  return {
    ok: true,
    result: { operation: "assist", proposal },
  };
}

export function planResponse(proposal: PlanProposal): SpikeResponse {
  return {
    ok: true,
    result: { operation: "plan", proposal },
  };
}

export function errorResponse(category: SidecarErrorCategory): SpikeResponse {
  return { ok: false, error: { category } };
}

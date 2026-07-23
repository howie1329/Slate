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

export const spikeRequestSchema = z.discriminatedUnion("operation", [
  healthRequestSchema,
  sdkLoadRequestSchema,
  assistRequestSchema,
]);

export type SpikeRequest = z.infer<typeof spikeRequestSchema>;
export type AssistRequest = z.infer<typeof assistRequestSchema>;

export const assistProposalSchema = z.object({
  title: z.string().trim().min(1).max(240),
  estimateMinutes: z.number().int().positive().max(1440),
  scheduledDate: localDateSchema.nullable(),
}).strict();

export type AssistProposal = z.infer<typeof assistProposalSchema>;

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
  if (operation === "assist") {
    throw new Error("Assist responses require a proposal.");
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

export function errorResponse(category: SidecarErrorCategory): SpikeResponse {
  return { ok: false, error: { category } };
}

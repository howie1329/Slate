import { z } from "zod";

const healthRequestSchema = z.object({
  version: z.literal(1),
  operation: z.literal("health"),
}).strict();

const sdkLoadRequestSchema = z.object({
  version: z.literal(1),
  operation: z.literal("sdk-load"),
}).strict();

export const spikeRequestSchema = z.discriminatedUnion("operation", [
  healthRequestSchema,
  sdkLoadRequestSchema,
]);

export type SpikeRequest = z.infer<typeof spikeRequestSchema>;

export type SpikeResponse =
  | {
      ok: true;
      result: {
        operation: SpikeRequest["operation"];
        status: "ready";
      };
    }
  | {
      ok: false;
      error: {
        category: "invalid-request" | "internal";
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
  return {
    ok: true,
    result: { operation, status: "ready" },
  };
}

export function errorResponse(category: "invalid-request" | "internal"): SpikeResponse {
  return { ok: false, error: { category } };
}

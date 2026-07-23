import { createGateway } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import catalog from "../../shared/ai-catalog.json" with { type: "json" };
import type { AssistRequest, PlanRequest, SidecarErrorCategory } from "./protocol.ts";

type ProviderRequest = AssistRequest | PlanRequest;

export function createModel(request: ProviderRequest) {
  if (!catalog.providers.some((provider) => provider.id === request.provider)) {
    throw new Error("Unsupported AI provider.");
  }
  if (!catalog.models.some((model) => model.id === request.model)) {
    throw new Error("Unsupported AI model.");
  }

  switch (request.provider) {
    case "openrouter":
      return createOpenRouter({ apiKey: request.apiKey })(request.model);
    case "vercel-gateway":
      return createGateway({ apiKey: request.apiKey })(request.model);
    default:
      throw new Error("Unsupported AI provider.");
  }
}

export function normalizeProviderError(error: unknown): SidecarErrorCategory {
  if (error instanceof Error && /timeout|timed out|abort/i.test(error.message)) {
    return "timeout";
  }

  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = error.statusCode;
    if (typeof statusCode === "number" && [401, 403, 429].includes(statusCode)) {
      return "provider-rejected";
    }
  }

  if (error instanceof Error && /network|socket|fetch|connect|dns/i.test(error.message)) {
    return "network";
  }

  if (error instanceof Error && /no structured proposal|no output/i.test(error.message)) {
    return "no-proposal";
  }

  return "internal";
}

import rawCatalog from "../../shared/ai-catalog.json";

export const AI_CATALOG = rawCatalog;

export const AI_PROVIDERS = AI_CATALOG.providers;
export const AI_MODELS = AI_CATALOG.models;

export type AiProvider = (typeof AI_PROVIDERS)[number]["id"];
export type AiModel = (typeof AI_MODELS)[number]["id"];

export function isAiProvider(value: string): value is AiProvider {
  return AI_PROVIDERS.some((provider) => provider.id === value);
}

export function isAiModel(value: string): value is AiModel {
  return AI_MODELS.some((model) => model.id === value);
}

export function isAiAvailability(value: string): value is "configured" | "unconfigured" | "unavailable" {
  return value === "configured" || value === "unconfigured" || value === "unavailable";
}

import { createGateway } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";

const probeSchema = z.object({
  ready: z.literal(true),
});

export function runSdkLoadProbe() {
  const gateway = createGateway({ apiKey: "slate-packaging-probe" });
  const openrouter = createOpenRouter({ apiKey: "slate-packaging-probe" });

  gateway("openai/gpt-5-mini");
  openrouter("openai/gpt-5-mini");
  probeSchema.parse({ ready: true });
}

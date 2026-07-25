import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assistProposalSchema } from "./protocol.ts";
import { buildPrompt, normalizeAssistError } from "./assist.ts";

describe("AI Assist", () => {
  it("accepts a valid structured proposal", () => {
    assert.deepEqual(assistProposalSchema.parse({
      title: "Prepare launch notes",
      estimateMinutes: 45,
      scheduledDate: null,
    }), {
      title: "Prepare launch notes",
      estimateMinutes: 45,
      scheduledDate: null,
    });
  });

  it("rejects an unsized proposal", () => {
    assert.throws(() => assistProposalSchema.parse({
      title: "Prepare launch notes",
      estimateMinutes: null,
      scheduledDate: null,
    }));
  });

  it("rejects invalid dates and non-whole estimates", () => {
    assert.throws(() => assistProposalSchema.parse({
      title: "Prepare launch notes",
      estimateMinutes: 30.5,
      scheduledDate: "tomorrow",
    }));
  });

  it("normalizes provider failures without exposing details", () => {
    assert.equal(normalizeAssistError(new Error("Request timed out")), "timeout");
    assert.equal(normalizeAssistError({ statusCode: 401 }), "provider-rejected");
    assert.equal(normalizeAssistError(new Error("socket disconnected")), "network");
    assert.equal(normalizeAssistError(new Error("unexpected provider body")), "internal");
  });

  it("builds a capture-first prompt without planner context", () => {
    const prompt = buildPrompt({
      version: 1,
      operation: "assist",
      provider: "openrouter",
      model: "openai/gpt-5-mini",
      apiKey: "test-key",
      input: {
        capture: "Prepare the launch notes",
        today: "2026-07-23",
        scheduledDate: null,
      },
    });

    assert.match(prompt, /Prepare the launch notes/);
    assert.match(prompt, /2026-07-23/);
    assert.doesNotMatch(prompt, /Today commitments|planning instruction|estimateMinutes|task title/i);
  });
});

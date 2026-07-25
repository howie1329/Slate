import assert from "node:assert/strict";
import { describe, it } from "node:test";
import catalog from "../../shared/ai-catalog.json" with { type: "json" };
import { MAX_REQUEST_BYTES, parseRequest } from "./protocol.ts";

const baseAssist = {
  version: 1,
  operation: "assist" as const,
  provider: "openrouter" as const,
  model: "openai/gpt-5-mini" as const,
  apiKey: "test-key",
  input: {
    capture: "Prepare the launch notes",
    today: "2026-07-23",
    scheduledDate: null,
  },
};

describe("sidecar protocol", () => {
  it("accepts a bounded capture-first Assist request", () => {
    assert.deepEqual(parseRequest(JSON.stringify(baseAssist)), baseAssist);
  });

  it("rejects planner context in Assist requests", () => {
    assert.throws(() => parseRequest(JSON.stringify({
      ...baseAssist,
      input: { ...baseAssist.input, todayTasks: [] },
    })));
  });

  it("accepts every catalog provider/model pair", () => {
    for (const provider of catalog.providers) {
      for (const model of catalog.models) {
        assert.doesNotThrow(() => parseRequest(JSON.stringify({
          ...baseAssist,
          provider: provider.id,
          model: model.id,
        })));
      }
    }
  });

  it("rejects unknown providers and models", () => {
    assert.throws(() => parseRequest(JSON.stringify({ ...baseAssist, provider: "unknown" })));
    assert.throws(() => parseRequest(JSON.stringify({ ...baseAssist, model: "custom/model" })));
  });

  it("accepts a Plan request with fixed Today context", () => {
    assert.deepEqual(parseRequest(JSON.stringify({
      version: 1,
      operation: "plan",
      provider: "openrouter",
      model: "openai/gpt-5-mini",
      apiKey: "test-key",
      input: {
        today: "2026-07-23",
        dailyCapacityMinutes: 240,
        remainingMinutes: 120,
        todayTasks: [{
          id: "today-1",
          title: "Existing commitment",
          estimateMinutes: 60,
          scheduledDate: "2026-07-23",
        }],
        candidates: [{
          id: "backlog-1",
          title: "Prepare launch notes",
          estimateMinutes: 45,
          scheduledDate: null,
          sourceScope: "log:unscheduled",
          backlogPosition: 0,
        }],
        planningInstruction: "Prefer a focused, realistic plan.",
      },
    })), {
      version: 1,
      operation: "plan",
      provider: "openrouter",
      model: "openai/gpt-5-mini",
      apiKey: "test-key",
      input: {
        today: "2026-07-23",
        dailyCapacityMinutes: 240,
        remainingMinutes: 120,
        todayTasks: [{
          id: "today-1",
          title: "Existing commitment",
          estimateMinutes: 60,
          scheduledDate: "2026-07-23",
        }],
        candidates: [{
          id: "backlog-1",
          title: "Prepare launch notes",
          estimateMinutes: 45,
          scheduledDate: null,
          sourceScope: "log:unscheduled",
          backlogPosition: 0,
        }],
        planningInstruction: "Prefer a focused, realistic plan.",
      },
    });
  });

  it("rejects unknown operations, extra fields, and oversized requests", () => {
    assert.throws(() => parseRequest(JSON.stringify({ version: 1, operation: "health" })));
    assert.throws(() => parseRequest(JSON.stringify({ ...baseAssist, extra: true })));
    assert.throws(() => parseRequest("x".repeat(MAX_REQUEST_BYTES + 1)));
  });
});

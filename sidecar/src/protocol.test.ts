import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_REQUEST_BYTES, parseRequest } from "./protocol.ts";

describe("sidecar protocol", () => {
  it("accepts the versioned health request", () => {
    assert.deepEqual(parseRequest('{"version":1,"operation":"health"}'), {
      version: 1,
      operation: "health",
    });
  });

  it("rejects unknown operations", () => {
    assert.throws(() => parseRequest('{"version":1,"operation":"run-command"}'));
  });

  it("rejects unknown protocol versions", () => {
    assert.throws(() => parseRequest('{"version":2,"operation":"health"}'));
  });

  it("rejects extra fields", () => {
    assert.throws(() => parseRequest('{"version":1,"operation":"health","command":"sh"}'));
  });

  it("rejects oversized requests", () => {
    assert.throws(() => parseRequest("x".repeat(MAX_REQUEST_BYTES + 1)));
  });

  it("accepts a bounded Assist request", () => {
    assert.deepEqual(parseRequest(JSON.stringify({
      version: 1,
      operation: "assist",
      provider: "openrouter",
      model: "openai/gpt-5-mini",
      apiKey: "test-key",
      input: {
        capture: "Prepare the launch notes",
        today: "2026-07-23",
        scheduledDate: null,
        todayTasks: [],
      },
    })), {
      version: 1,
      operation: "assist",
      provider: "openrouter",
      model: "openai/gpt-5-mini",
      apiKey: "test-key",
      input: {
        capture: "Prepare the launch notes",
        today: "2026-07-23",
        scheduledDate: null,
        todayTasks: [],
      },
    });
  });

  it("rejects Assist requests with extra fields", () => {
    assert.throws(() => parseRequest(JSON.stringify({
      version: 1,
      operation: "assist",
      provider: "openrouter",
      model: "openai/gpt-5-mini",
      apiKey: "test-key",
      input: {
        capture: "Prepare the launch notes",
        today: "2026-07-23",
        scheduledDate: null,
        todayTasks: [],
        secret: "not-allowed",
      },
    })));
  });

  it("rejects an unknown Assist provider", () => {
    assert.throws(() => parseRequest(JSON.stringify({
      version: 1,
      operation: "assist",
      provider: "unknown",
      model: "openai/gpt-5-mini",
      apiKey: "test-key",
      input: {
        capture: "Prepare the launch notes",
        today: "2026-07-23",
        scheduledDate: null,
        todayTasks: [],
      },
    })));
  });
});

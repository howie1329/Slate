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
});

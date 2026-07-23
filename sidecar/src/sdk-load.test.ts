import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runSdkLoadProbe } from "./sdk-load.ts";

describe("SDK load probe", () => {
  it("loads providers and validates the offline schema path", () => {
    assert.doesNotThrow(() => runSdkLoadProbe());
  });
});

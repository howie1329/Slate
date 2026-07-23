import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planProposalSchema } from "./protocol.ts";

describe("Plan My Day", () => {
  it("accepts an ordered candidate selection with rationale", () => {
    assert.deepEqual(planProposalSchema.parse({
      taskIds: ["backlog-2", "backlog-1"],
      rationale: "These tasks fit the remaining capacity.",
    }), {
      taskIds: ["backlog-2", "backlog-1"],
      rationale: "These tasks fit the remaining capacity.",
    });
  });

  it("rejects duplicate or oversized selections", () => {
    assert.throws(() => planProposalSchema.parse({
      taskIds: ["backlog-1", "backlog-1"],
      rationale: null,
    }));
    assert.throws(() => planProposalSchema.parse({
      taskIds: Array.from({ length: 51 }, (_, index) => "task-" + index),
      rationale: null,
    }));
  });
});

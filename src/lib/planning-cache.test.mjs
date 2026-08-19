import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reorderPlanningLane } from "./planning-cache.ts";

function task(id) {
  return { id };
}

function snapshot() {
  return {
    planning: {
      lanes: {
        capture: { tasks: [task("capture-a"), task("capture-b")], reorder: null },
        ready: { tasks: [task("ready-a"), task("ready-b")], reorder: null },
        today: { tasks: [task("today-a"), task("today-b")], reorder: null },
        done: { tasks: [task("done")], reorder: null },
        counts: { capture: 2, ready: 2, today: 2, done: 1 },
      },
      capacity: {},
    },
  };
}

describe("Planning lane cache reconciliation", () => {
  for (const lane of ["capture", "ready", "today"]) {
    it(`reorders ${lane} without changing other lanes`, () => {
      const original = snapshot();
      const originalIds = original.planning.lanes[lane].tasks.map(({ id }) => id);
      const next = reorderPlanningLane(original, lane, [...originalIds].reverse());

      assert.deepEqual(next.planning.lanes[lane].tasks.map(({ id }) => id), [...originalIds].reverse());
      for (const otherLane of ["capture", "ready", "today", "done"].filter((id) => id !== lane)) {
        assert.equal(next.planning.lanes[otherLane], original.planning.lanes[otherLane]);
      }
    });
  }
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planningBoardLanes } from "./planning-board.ts";

const today = "2026-08-10";

function task(id, overrides = {}) {
  return {
    id,
    title: id,
    estimateMinutes: null,
    scheduledDate: null,
    createdAt: `2026-08-0${id.length}T12:00:00Z`,
    completedAt: null,
    revision: 1,
    anchorDate: null,
    badges: [],
    ...overrides,
  };
}

function snapshot() {
  return {
    today,
    planning: {
      lanes: {
        capture: { tasks: [task("capture", { scheduledDate: "2026-08-12", badges: ["upcoming"] })], reorder: null },
        ready: { tasks: [task("ready", { estimateMinutes: 45 })], reorder: null },
        today: { tasks: [task("today", { scheduledDate: today })], reorder: null },
        done: {
          tasks: [
            task("done-today", { completedAt: "2026-08-10T14:00:00Z" }),
            task("done-backlog", { completedAt: "2026-08-09T14:00:00Z" }),
          ],
          reorder: null,
        },
        counts: { capture: 1, ready: 1, today: 1, done: 2 },
      },
      capacity: { limitMinutes: 360, committedMinutes: 0, remainingMinutes: 360, overageMinutes: 0, isOverCapacity: false, overflowTaskId: null },
    },
    settings: {},
    aiAvailability: "unavailable",
    aiAvailabilityByProvider: {},
  };
}

describe("planning board projection", () => {
  it("presents the four authoritative lanes without reclassifying tasks", () => {
    const lanes = planningBoardLanes(snapshot(), "all", "planning");

    assert.deepEqual(lanes.map((lane) => [lane.id, lane.tasks.map((item) => item.id)]), [
      ["capture", ["capture"]],
      ["ready", ["ready"]],
      ["today", ["today"]],
      ["done", ["done-today", "done-backlog"]],
    ]);
  });

  it("applies attention filters within every lane", () => {
    const attention = planningBoardLanes(snapshot(), "attention", "planning");
    assert.deepEqual(attention.map((lane) => lane.tasks.map((item) => item.id)), [
      ["capture"],
      [],
      ["today"],
      [],
    ]);
  });
});

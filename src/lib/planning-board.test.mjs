import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planningBoardLanes, taskPlanningLane } from "./planning-board.ts";

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
      today: {
        active: { tasks: [task("today", { scheduledDate: today })], reorder: null },
        completed: { tasks: [task("done-today", { completedAt: "2026-08-10T14:00:00Z" })], reorder: null },
        capacity: { limitMinutes: 360, committedMinutes: 0, remainingMinutes: 360, overageMinutes: 0, isOverCapacity: false, overflowTaskId: null },
        totalTaskCount: 2,
        unsizedTaskCount: 1,
      },
      backlog: {
        active: {
          tasks: [
            task("capture", { scheduledDate: "2026-08-12", badges: ["upcoming"] }),
            task("ready", { estimateMinutes: 45 }),
          ],
          reorder: null,
        },
        completed: { tasks: [task("done-backlog", { completedAt: "2026-08-09T14:00:00Z" })], reorder: null },
        totalTaskCount: 4,
        activeTaskCount: 2,
      },
    },
    settings: {},
    aiAvailability: "unavailable",
    aiAvailabilityByProvider: {},
  };
}

describe("planning board projection", () => {
  it("derives the four lanes from task facts without a stored status", () => {
    const lanes = planningBoardLanes(snapshot(), "", "all", "planning");

    assert.deepEqual(lanes.map((lane) => [lane.id, lane.tasks.map((item) => item.id)]), [
      ["capture", ["capture"]],
      ["ready", ["ready"]],
      ["today", ["today"]],
      ["done", ["done-today", "done-backlog"]],
    ]);
  });

  it("prioritizes completion and today before estimate state", () => {
    assert.equal(taskPlanningLane(task("complete", { completedAt: "2026-08-10T12:00:00Z", scheduledDate: today }), today), "done");
    assert.equal(taskPlanningLane(task("unsized-today", { scheduledDate: today }), today), "today");
  });

  it("keeps dated unestimated backlog work in Capture", () => {
    assert.equal(taskPlanningLane(task("future-capture", { scheduledDate: "2026-08-12" }), today), "capture");
  });

  it("applies search and attention filters within every lane", () => {
    const searched = planningBoardLanes(snapshot(), "ready", "all", "planning");
    assert.deepEqual(searched.map((lane) => lane.tasks.length), [0, 1, 0, 0]);

    const attention = planningBoardLanes(snapshot(), "", "attention", "planning");
    assert.deepEqual(attention.map((lane) => lane.tasks.map((item) => item.id)), [
      ["capture"],
      [],
      ["today"],
      [],
    ]);
  });
});

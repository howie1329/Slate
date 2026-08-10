import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterDailyWorkspace } from "./daily-workspace.ts";

function task(id, title, badges = []) {
  return {
    id,
    title,
    estimateMinutes: 30,
    scheduledDate: null,
    createdAt: `2026-08-09T00:00:0${id}Z`,
    completedAt: null,
    revision: 1,
    anchorDate: null,
    badges,
  };
}

function section(tasks, reorder = null) {
  return { tasks, reorder };
}

function planning() {
  return {
    today: {
      active: section([
        task("1", "Write proposal", ["needs-estimate"]),
        task("2", "Review notes"),
      ], {
        scope: "today:2026-08-09",
        expectedRevisions: [
          { id: "1", revision: 1 },
          { id: "2", revision: 1 },
        ],
      }),
      completed: section([task("3", "Send update")]),
      capacity: {
        limitMinutes: 120,
        committedMinutes: 60,
        remainingMinutes: 60,
        overageMinutes: 0,
        isOverCapacity: false,
        overflowTaskId: null,
      },
      totalTaskCount: 3,
      unsizedTaskCount: 1,
    },
    backlog: {
      active: section([
        task("4", "Draft outline", ["unscheduled"]),
        task("5", "Old follow-up", ["overdue"]),
        task("6", "Future review", ["upcoming"]),
      ]),
      completed: section([]),
      totalTaskCount: 3,
      activeTaskCount: 3,
    },
  };
}

describe("Daily workspace presentation adapter", () => {
  it("filters authoritative sections without changing their order", () => {
    const model = filterDailyWorkspace(planning(), "review");

    assert.deepEqual(model.today.active.tasks.map(({ id }) => id), ["2"]);
    assert.deepEqual(model.backlog.active.tasks.map(({ id }) => id), ["6"]);
    assert.equal(model.hasQuery, true);
    assert.equal(model.hasMatches, true);
  });

  it("maps native semantic badges to renderer copy and tone", () => {
    const model = filterDailyWorkspace(planning());

    assert.deepEqual(model.today.active.metadataByTaskId["1"], [
      { label: "Needs estimate", tone: "caution" },
    ]);
    assert.deepEqual(model.backlog.active.metadataByTaskId["4"], [
      { label: "Unscheduled" },
    ]);
    assert.deepEqual(model.backlog.active.metadataByTaskId["5"], [
      { label: "Overdue", tone: "destructive" },
    ]);
  });

  it("preserves authoritative capacity and totals while filtering", () => {
    const model = filterDailyWorkspace(planning(), "missing");

    assert.equal(model.hasMatches, false);
    assert.equal(model.today.capacity.remainingMinutes, 60);
    assert.equal(model.today.totalTaskCount, 3);
    assert.equal(model.today.unsizedTaskCount, 1);
    assert.equal(model.backlog.totalTaskCount, 3);
  });
});

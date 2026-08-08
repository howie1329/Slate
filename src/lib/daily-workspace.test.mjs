import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectDailyWorkspace } from "./daily-workspace.ts";

const today = "2026-08-08";

function task(id, overrides = {}) {
  return {
    id,
    title: id,
    estimateMinutes: 30,
    scheduledDate: null,
    createdAt: `${id}-created`,
    completedAt: null,
    revision: 1,
    anchorDate: null,
    ...overrides,
  };
}

function planner(tasks, orderByScope = {}) {
  return {
    tasks,
    orderByScope,
    settings: {},
    aiAvailability: "unconfigured",
    aiAvailabilityByProvider: {},
    today,
    effectiveCapacityMinutes: 120,
  };
}

describe("Daily workspace selector", () => {
  it("keeps scheduled Today work together, including unsized commitments", () => {
    const model = selectDailyWorkspace(
      planner([
        task("sized", { title: "Sized", estimateMinutes: 60, scheduledDate: today }),
        task("unsized", { title: "Unsized", estimateMinutes: null, scheduledDate: today }),
        task("backlog", { title: "Backlog" }),
      ]),
    );

    assert.deepEqual(model.today.active.tasks.map(({ id }) => id), ["sized", "unsized"]);
    assert.equal(model.today.capacity.committedMinutes, 60);
    assert.equal(model.today.capacity.remainingMinutes, 60);
    assert.equal(model.today.unsizedTaskCount, 1);
    assert.deepEqual(model.today.active.metadataByTaskId.unsized, [
      { label: "Needs estimate", tone: "caution" },
    ]);
  });

  it("flattens backlog metadata while keeping completed Today work at the bottom of Today", () => {
    const model = selectDailyWorkspace(
      planner([
        task("today-active", { scheduledDate: today }),
        task("today-complete", { scheduledDate: today, completedAt: "2026-08-08T12:00:00Z" }),
        task("overdue", { scheduledDate: "2026-08-07" }),
        task("future", { scheduledDate: "2026-08-09" }),
        task("unscheduled", { scheduledDate: null, estimateMinutes: null }),
        task("backlog-complete", { scheduledDate: null, completedAt: "2026-08-08T13:00:00Z" }),
      ]),
    );

    assert.deepEqual(model.today.active.tasks.map(({ id }) => id), ["today-active"]);
    assert.deepEqual(model.today.completed.tasks.map(({ id }) => id), ["today-complete"]);
    assert.deepEqual(model.backlog.active.tasks.map(({ id }) => id), ["unscheduled", "overdue", "future"]);
    assert.deepEqual(model.backlog.completed.tasks.map(({ id }) => id), ["backlog-complete"]);
    assert.deepEqual(model.backlog.active.metadataByTaskId.unscheduled.map(({ label }) => label), [
      "Needs estimate",
      "Unscheduled",
    ]);
    assert.deepEqual(model.backlog.active.metadataByTaskId.overdue.map(({ label }) => label), ["Overdue"]);
  });

  it("uses persisted scope order and filters rows without changing capacity", () => {
    const model = selectDailyWorkspace(
      planner(
        [
          task("first", { title: "First", scheduledDate: today, estimateMinutes: 90 }),
          task("second", { title: "Second", scheduledDate: today, estimateMinutes: 60 }),
          task("third", { title: "Third", scheduledDate: today, estimateMinutes: 30 }),
        ],
        { [`today:${today}`]: ["third", "first", "second"] },
      ),
      "second",
    );

    assert.deepEqual(model.today.active.tasks.map(({ id }) => id), ["second"]);
    assert.equal(model.today.capacity.isOverCapacity, true);
    assert.equal(model.hasMatches, true);
    assert.equal(model.hasQuery, true);

    const noMatch = selectDailyWorkspace(planner([task("one", { title: "One", scheduledDate: today })]), "missing");
    assert.equal(noMatch.hasMatches, false);
    assert.equal(noMatch.today.capacity.committedMinutes, 30);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { taskFinderResults, taskFinderTitleParts } from "./task-finder.ts";

const today = "2026-08-12";

function task(id, title, overrides = {}) {
  return {
    id,
    title,
    estimateMinutes: null,
    scheduledDate: null,
    createdAt: "2026-08-12T12:00:00Z",
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
        capture: {
          tasks: [task("capture", "Prepare launch meeting notes", { badges: ["needs-estimate"] })],
          reorder: null,
        },
        ready: {
          tasks: [
            task("ready-a", "Launch notes review", { estimateMinutes: 30 }),
            task("ready-b", "Write release notes", { estimateMinutes: 45 }),
            task("ready-c", "Write release notes", {
              estimateMinutes: 20,
              scheduledDate: "2026-08-14",
              badges: ["upcoming"],
            }),
          ],
          reorder: null,
        },
        today: {
          tasks: [task("today", "Share launch notes", { estimateMinutes: 15, scheduledDate: today })],
          reorder: null,
        },
        done: {
          tasks: [task("done", "Archive launch notes", { completedAt: "2026-08-12T14:00:00Z" })],
          reorder: null,
        },
        counts: { capture: 1, ready: 3, today: 1, done: 1 },
      },
      capacity: {
        limitMinutes: 240,
        committedMinutes: 15,
        remainingMinutes: 225,
        overageMinutes: 0,
        isOverCapacity: false,
        overflowTaskId: null,
      },
    },
    settings: {},
    aiAvailability: "unavailable",
    aiAvailabilityByProvider: {},
  };
}

describe("task finder projection", () => {
  it("matches every query word across all lanes in canonical order", () => {
    const results = taskFinderResults(snapshot(), "  LAUNCH   notes ");

    assert.deepEqual(results.map((result) => [result.lane, result.id]), [
      ["capture", "capture"],
      ["ready", "ready-a"],
      ["today", "today"],
      ["done", "done"],
    ]);
  });

  it("requires every word and preserves task metadata", () => {
    const results = taskFinderResults(snapshot(), "release notes");

    assert.deepEqual(results, [
      {
        id: "ready-b",
        title: "Write release notes",
        lane: "ready",
        estimateMinutes: 45,
        scheduledDate: null,
        completedAt: null,
        badges: [],
      },
      {
        id: "ready-c",
        title: "Write release notes",
        lane: "ready",
        estimateMinutes: 20,
        scheduledDate: "2026-08-14",
        completedAt: null,
        badges: ["upcoming"],
      },
    ]);
    assert.deepEqual(taskFinderResults(snapshot(), "release launch"), []);
  });

  it("returns exception and completion facts from the authoritative snapshot", () => {
    assert.deepEqual(
      taskFinderResults(snapshot(), "prepare").map(({ id, badges }) => ({ id, badges })),
      [{ id: "capture", badges: ["needs-estimate"] }],
    );
    assert.equal(taskFinderResults(snapshot(), "archive")[0].completedAt, "2026-08-12T14:00:00Z");
  });

  it("returns no suggestions for an empty query", () => {
    assert.deepEqual(taskFinderResults(snapshot(), "  "), []);
  });

  it("marks every matching title segment without changing its text", () => {
    assert.deepEqual(taskFinderTitleParts("Prepare launch meeting notes", "notes launch"), [
      { text: "Prepare ", matched: false },
      { text: "launch", matched: true },
      { text: " meeting ", matched: false },
      { text: "notes", matched: true },
    ]);
  });
});

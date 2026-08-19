import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyTaskFinderCreationDraft,
  emptyTaskFinderFilters,
  filterTaskFinderResults,
  moveTaskFinderIndex,
  taskFinderActionEffect,
  taskFinderActions,
  taskFinderCreateInput,
  taskFinderEmptyState,
  taskFinderOptions,
} from "./task-finder-interaction.ts";

const today = "2026-08-12";

function result(id, title, overrides = {}) {
  return {
    id,
    title,
    lane: "capture",
    estimateMinutes: null,
    scheduledDate: null,
    completedAt: null,
    revision: 3,
    anchorDate: null,
    badges: ["needs-estimate"],
    ...overrides,
  };
}

describe("task finder interaction", () => {
  it("filters title results with one lane and independent attention facts", () => {
    const results = [
      result("capture", "Draft launch", { badges: ["needs-estimate", "overdue"] }),
      result("ready", "Launch review", { lane: "ready", estimateMinutes: 30, badges: ["overdue"] }),
      result("today", "Launch meeting", { lane: "today", scheduledDate: today, badges: ["needs-estimate"] }),
    ];

    assert.deepEqual(
      filterTaskFinderResults(results, { lane: null, overdue: true, needsEstimate: false }).map(({ id }) => id),
      ["capture", "ready"],
    );
    assert.deepEqual(
      filterTaskFinderResults(results, { lane: "capture", overdue: true, needsEstimate: true }).map(({ id }) => id),
      ["capture"],
    );
  });

  it("distinguishes instructions, title misses, and filtered misses", () => {
    const filters = emptyTaskFinderFilters();
    assert.equal(taskFinderEmptyState("", 0, 0, filters), "instructions");
    assert.equal(taskFinderEmptyState("launch", 0, 0, filters), "no-match");
    assert.equal(
      taskFinderEmptyState("launch", 2, 0, { ...filters, lane: "today" }),
      "filtered-no-match",
    );
    assert.equal(taskFinderEmptyState("launch", 2, 1, filters), null);
    assert.equal(taskFinderEmptyState("", 2, 1, { ...filters, lane: "today" }), null);
    assert.equal(taskFinderEmptyState("", 2, 0, { ...filters, lane: "today" }), "filtered-no-match");
  });

  it("keeps task matches first and appends an explicit create option", () => {
    const options = taskFinderOptions(
      [result("one", "Release notes"), result("two", "Release notes")],
      "  Release notes follow-up  ",
    );

    assert.deepEqual(options.map((option) => [option.kind, option.key]), [
      ["task", "task:one"],
      ["task", "task:two"],
      ["create", "create"],
    ]);
    assert.equal(options[2].title, "Release notes follow-up");
  });

  it("makes create the first option when there are no matches", () => {
    assert.deepEqual(taskFinderOptions([], "New task"), [
      { key: "create", kind: "create", title: "New task" },
    ]);
    assert.deepEqual(taskFinderOptions([], "   "), []);
  });

  it("shows filtered results without requiring a title", () => {
    assert.deepEqual(
      taskFinderOptions([result("one", "Release notes")], "", true).map((option) => [option.kind, option.key]),
      [["task", "task:one"]],
    );
  });

  it("clamps keyboard navigation across task and create options", () => {
    assert.equal(moveTaskFinderIndex(0, -1, 3), 0);
    assert.equal(moveTaskFinderIndex(0, 1, 3), 1);
    assert.equal(moveTaskFinderIndex(2, 1, 3), 2);
    assert.equal(moveTaskFinderIndex(0, 1, 0), -1);
  });

  it("builds enriched ordinary manual creation payloads", () => {
    assert.deepEqual(
      taskFinderCreateInput(
        "  Prepare launch notes  ",
        { estimate: "30", scheduledDate: "2026-08-14", addToToday: false },
        today,
      ),
      {
        ok: true,
        input: {
          title: "Prepare launch notes",
          estimateMinutes: 30,
          scheduledDate: "2026-08-14",
          source: "manual",
        },
      },
    );
    assert.deepEqual(
      taskFinderCreateInput(
        "Commit launch notes",
        { estimate: "", scheduledDate: "2026-08-14", addToToday: true },
        today,
      ),
      {
        ok: true,
        input: {
          title: "Commit launch notes",
          estimateMinutes: null,
          scheduledDate: today,
          source: "manual",
        },
      },
    );
    assert.deepEqual(taskFinderCreateInput("Task", { ...emptyTaskFinderCreationDraft(), estimate: "1.5" }, today), {
      ok: false,
      error: "invalid-estimate",
    });
  });

  it("derives valid quick actions and exact revision-safe effects", () => {
    const ready = result("ready", "Launch", {
      lane: "ready",
      estimateMinutes: 45,
      scheduledDate: "2026-08-14",
      badges: ["upcoming"],
    });
    assert.deepEqual(taskFinderActions(ready).map(({ id }) => id), [
      "open",
      "move-today",
      "complete",
      "return-capture",
    ]);
    assert.deepEqual(taskFinderActionEffect(ready, "move-today", today), {
      type: "set-scheduled-date",
      input: { id: "ready", scheduledDate: today, expectedRevision: 3 },
    });
    assert.deepEqual(taskFinderActionEffect(ready, "return-capture", today), {
      type: "update-task",
      input: {
        id: "ready",
        title: "Launch",
        estimateMinutes: null,
        scheduledDate: null,
        anchorDate: null,
        expectedRevision: 3,
      },
    });

    const done = result("done", "Launch", { lane: "done", completedAt: "2026-08-12T14:00:00Z", badges: [] });
    assert.deepEqual(taskFinderActions(done).map(({ id }) => id), ["open", "reopen"]);
    assert.deepEqual(taskFinderActionEffect(done, "reopen", today), {
      type: "set-completed",
      input: { id: "done", completed: false, expectedRevision: 3 },
    });
  });
});

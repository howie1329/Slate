import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  moveTaskFinderIndex,
  taskFinderCreateInput,
  taskFinderOptions,
} from "./task-finder-interaction.ts";

function result(id, title) {
  return {
    id,
    title,
    lane: "capture",
    estimateMinutes: null,
    scheduledDate: null,
    completedAt: null,
    badges: ["needs-estimate"],
  };
}

describe("task finder interaction", () => {
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

  it("clamps keyboard navigation across task and create options", () => {
    assert.equal(moveTaskFinderIndex(0, -1, 3), 0);
    assert.equal(moveTaskFinderIndex(0, 1, 3), 1);
    assert.equal(moveTaskFinderIndex(2, 1, 3), 2);
    assert.equal(moveTaskFinderIndex(0, 1, 0), -1);
  });

  it("builds the ordinary manual Capture payload from the trimmed query", () => {
    assert.deepEqual(taskFinderCreateInput("  Prepare launch notes  "), {
      title: "Prepare launch notes",
      estimateMinutes: null,
      scheduledDate: null,
      source: "manual",
    });
    assert.equal(taskFinderCreateInput("   "), null);
  });
});

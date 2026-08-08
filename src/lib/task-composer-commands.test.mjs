import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTaskComposerInput,
  parseTaskComposerCommands,
} from "./task-composer-commands.ts";

const defaults = {
  scheduledDate: null,
  today: "2026-08-07",
};

describe("Task composer commands", () => {
  it("parses a Today capture and removes recognized command text from its title", () => {
    const parsed = parseTaskComposerCommands("  Draft release notes /today /30m  ");

    assert.deepEqual(parsed, {
      commands: [
        { kind: "today", label: "Today" },
        { kind: "estimate", label: "30m" },
      ],
      error: null,
      estimateMinutes: 30,
      schedule: "today",
      title: "Draft release notes",
    });
    assert.deepEqual(buildTaskComposerInput(parsed, defaults), {
      title: "Draft release notes",
      estimateMinutes: 30,
      scheduledDate: "2026-08-07",
    });
  });

  it("preserves unknown slash text literally", () => {
    const parsed = parseTaskComposerCommands("Review /later notes /15m");

    assert.equal(parsed.title, "Review /later notes");
    assert.equal(parsed.estimateMinutes, 15);
    assert.equal(parsed.error, null);
  });

  it("schedules Tomorrow without making a Today commitment", () => {
    const parsed = parseTaskComposerCommands("Prepare agenda /tomorrow /45m");

    assert.deepEqual(buildTaskComposerInput(parsed, defaults), {
      title: "Prepare agenda",
      estimateMinutes: 45,
      scheduledDate: "2026-08-08",
    });
  });

  it("keeps Backlog captures uncommitted and unscheduled", () => {
    const parsed = parseTaskComposerCommands("Read proposal /backlog /20m");

    assert.deepEqual(buildTaskComposerInput(parsed, {
      scheduledDate: "2026-08-09",
      today: "2026-08-07",
    }), {
      title: "Read proposal",
      estimateMinutes: 20,
      scheduledDate: null,
    });
  });

  it("requires an estimate for Today", () => {
    const parsed = parseTaskComposerCommands("Send update /today");

    assert.equal(parsed.error, "Add an estimate like /30m before committing this to Today.");
    assert.equal(buildTaskComposerInput(parsed, defaults), null);
  });

  it("rejects duplicate and conflicting commands", () => {
    assert.equal(
      parseTaskComposerCommands("Draft /today /tomorrow /30m").error,
      "Choose only one schedule command: /today, /tomorrow, or /backlog.",
    );
    assert.equal(
      parseTaskComposerCommands("Draft /20m /30m").error,
      "Use only one estimate command.",
    );
  });

  it("rejects malformed estimates while keeping their text literal", () => {
    const parsed = parseTaskComposerCommands("Draft /0m");

    assert.equal(parsed.title, "Draft /0m");
    assert.equal(parsed.error, "Use a positive whole-minute estimate, like /30m.");
  });

  it("requires a title when input contains only recognized commands", () => {
    const parsed = parseTaskComposerCommands(" /backlog /30m ");

    assert.equal(parsed.title, "");
    assert.equal(parsed.error, "Add a task title before saving.");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { idlePlanningInteraction, planningInteraction } from "./planning-interaction.ts";

const today = "2026-08-10";

function task(id, overrides = {}) {
  return {
    id,
    title: id,
    estimateMinutes: 30,
    scheduledDate: null,
    createdAt: "2026-08-10T12:00:00Z",
    completedAt: null,
    revision: 1,
    anchorDate: null,
    badges: [],
    ...overrides,
  };
}

function context(overrides = {}) {
  const capture = task("capture", { estimateMinutes: null });
  const readyA = task("ready-a");
  const readyB = task("ready-b");
  const todayTask = task("today", { estimateMinutes: 45, scheduledDate: today });
  return {
    today,
    canReorder: true,
    capacity: {
      limitMinutes: 120,
      committedMinutes: 45,
      remainingMinutes: 75,
      overageMinutes: 0,
      isOverCapacity: false,
      overflowTaskId: null,
    },
    lanes: [
      { id: "capture", label: "Capture", tasks: [capture], reorder: guard("capture", [capture]) },
      { id: "ready", label: "Ready", tasks: [readyA, readyB], reorder: guard("ready", [readyA, readyB]) },
      { id: "today", label: "Today", tasks: [todayTask], reorder: guard("today", [todayTask]) },
      { id: "done", label: "Done", tasks: [task("done", { completedAt: today })], reorder: null },
    ],
    ...overrides,
  };
}

function guard(scope, tasks) {
  return {
    scope: `planning:${scope}`,
    expectedRevisions: tasks.map(({ id, revision }) => ({ id, revision })),
  };
}

function transition(boardContext, state, event) {
  return planningInteraction({ kind: "board", context: boardContext, state, event });
}

function start(boardContext, taskId) {
  return transition(boardContext, idlePlanningInteraction(), { type: "drag-start", taskId });
}

describe("Planning interaction", () => {
  it("tracks a drag sequence and clears all state on cancel", () => {
    const boardContext = context();
    const started = start(boardContext, "ready-a");
    const hovered = transition(boardContext, started.state, {
      type: "drag-over",
      lane: "today",
      taskId: "today",
    });
    const cancelled = transition(boardContext, hovered.state, { type: "drag-cancel" });

    assert.equal(started.state.sourceLane, "ready");
    assert.equal(hovered.state.overLane, "today");
    assert.equal(hovered.state.validOverTarget, true);
    assert.deepEqual(hovered.state.capacityPreview, {
      committedMinutes: 75,
      message: "1h 15m remaining → 45m remaining",
    });
    assert.deepEqual(cancelled.state, idlePlanningInteraction());
    assert.equal(cancelled.effect, null);
  });

  it("returns an exact same-Lane reorder effect", () => {
    const boardContext = context();
    const started = start(boardContext, "ready-a");
    const dropped = transition(boardContext, started.state, {
      type: "drop",
      lane: "ready",
      taskId: "ready-b",
    });

    assert.equal(dropped.effect.type, "reorder");
    assert.equal(dropped.effect.lane, "ready");
    assert.deepEqual(dropped.effect.taskIds, ["ready-b", "ready-a"]);
    assert.deepEqual(dropped.state, idlePlanningInteraction());
  });

  it("reorders Capture, Ready, and Today using each Lane's authoritative guard", () => {
    for (const laneId of ["capture", "ready", "today"]) {
      const items = [
        task(`${laneId}-a`, laneId === "capture" ? { estimateMinutes: null } : {}),
        task(`${laneId}-b`, laneId === "capture" ? { estimateMinutes: null } : {}),
        task(`${laneId}-c`, laneId === "capture" ? { estimateMinutes: null } : {}),
      ];
      const boardContext = context({
        lanes: context().lanes.map((lane) => lane.id === laneId
          ? { ...lane, tasks: items, reorder: guard(laneId, items) }
          : lane),
      });
      const started = start(boardContext, `${laneId}-c`);
      const dropped = transition(boardContext, started.state, {
        type: "drop",
        lane: laneId,
        taskId: `${laneId}-a`,
      });

      assert.equal(dropped.effect.type, "reorder");
      assert.equal(dropped.effect.guard.scope, `planning:${laneId}`);
      assert.deepEqual(dropped.effect.taskIds, [`${laneId}-c`, `${laneId}-a`, `${laneId}-b`]);
    }
  });

  it("does not reorder without an authoritative guard", () => {
    const original = context();
    const boardContext = context({
      lanes: original.lanes.map((lane) => lane.id === "ready" ? { ...lane, reorder: null } : lane),
    });
    const started = start(boardContext, "ready-a");
    const dropped = transition(boardContext, started.state, {
      type: "drop",
      lane: "ready",
      taskId: "ready-b",
    });

    assert.equal(dropped.effect, null);
  });

  it("rejects reordering when canonical Planning order is not visible", () => {
    const boardContext = context({ canReorder: false });
    const started = start(boardContext, "ready-a");
    const dropped = transition(boardContext, started.state, {
      type: "drop",
      lane: "ready",
      taskId: "ready-b",
    });

    assert.equal(dropped.effect, null);
  });

  it("opens an unsized task for inspection instead of moving it to Ready", () => {
    const boardContext = context();
    const started = start(boardContext, "capture");
    const dropped = transition(boardContext, started.state, {
      type: "drop",
      lane: "ready",
      taskId: "ready-a",
    });

    assert.deepEqual(dropped.effect, {
      type: "inspect",
      taskId: "capture",
      feedback: { lane: "ready", message: "Add an estimate to make this task Ready." },
    });
  });

  it("preserves an unsized commitment and known capacity when moving to Today", () => {
    const boardContext = context();
    const started = start(boardContext, "capture");
    const hovered = transition(boardContext, started.state, {
      type: "drag-over",
      lane: "today",
      taskId: "today",
    });
    const dropped = transition(boardContext, hovered.state, {
      type: "drop",
      lane: "today",
      taskId: "today",
    });

    assert.deepEqual(hovered.state.capacityPreview, {
      committedMinutes: 45,
      message: "No estimate · known capacity unchanged",
    });
    assert.deepEqual(dropped.effect, {
      type: "set-scheduled-date",
      input: { id: "capture", scheduledDate: today, expectedRevision: 1 },
    });
  });

  it("returns the current task facts required to move Today work to Capture", () => {
    const boardContext = context();
    const started = start(boardContext, "today");
    const dropped = transition(boardContext, started.state, {
      type: "drop",
      lane: "capture",
      taskId: "capture",
    });

    assert.deepEqual(dropped.effect, {
      type: "update-task",
      input: {
        id: "today",
        title: "today",
        estimateMinutes: null,
        scheduledDate: null,
        anchorDate: null,
        expectedRevision: 1,
      },
    });
  });

  it("preserves unrelated task facts when moving between active Lanes", () => {
    const future = "2026-08-12";
    const readyTask = task("ready-future", {
      title: "Preserve me",
      estimateMinutes: 50,
      scheduledDate: future,
      anchorDate: "2026-08-01",
      revision: 7,
    });
    const original = context();
    const boardContext = context({
      lanes: original.lanes.map((lane) => lane.id === "ready"
        ? { ...lane, tasks: [readyTask], reorder: guard("ready", [readyTask]) }
        : lane),
    });
    const started = start(boardContext, readyTask.id);
    const dropped = transition(boardContext, started.state, {
      type: "drop",
      lane: "capture",
      taskId: "capture",
    });

    assert.deepEqual(dropped.effect, {
      type: "update-task",
      input: {
        id: readyTask.id,
        title: "Preserve me",
        estimateMinutes: null,
        scheduledDate: future,
        anchorDate: "2026-08-01",
        expectedRevision: 7,
      },
    });
  });

  it("keeps the estimate and clears only today's date when moving Today work to Ready", () => {
    const boardContext = context();
    const started = start(boardContext, "today");
    const dropped = transition(boardContext, started.state, {
      type: "drop",
      lane: "ready",
      taskId: "ready-a",
    });

    assert.equal(dropped.effect.type, "update-task");
    assert.equal(dropped.effect.input.estimateMinutes, 45);
    assert.equal(dropped.effect.input.scheduledDate, null);
  });

  it("returns completion intent for an active task dropped into Done", () => {
    const boardContext = context();
    const started = start(boardContext, "ready-a");
    const dropped = transition(boardContext, started.state, {
      type: "drop",
      lane: "done",
      taskId: "done",
    });

    assert.deepEqual(dropped.effect, {
      type: "set-completed",
      input: { id: "ready-a", completed: true, expectedRevision: 1 },
    });
  });

  it("makes missing targets, self-drops, and Done drag starts safe no-ops", () => {
    const boardContext = context();
    const started = start(boardContext, "ready-a");
    assert.equal(
      transition(boardContext, started.state, { type: "drop", lane: null, taskId: null }).effect,
      null,
    );
    assert.equal(
      transition(boardContext, started.state, { type: "drop", lane: "ready", taskId: "ready-a" }).effect,
      null,
    );
    assert.deepEqual(start(boardContext, "done").state, idlePlanningInteraction());
  });

  it("updates hover validity and clears capacity when the target changes", () => {
    const boardContext = context();
    const started = start(boardContext, "capture");
    const invalidReady = transition(boardContext, started.state, {
      type: "drag-over",
      lane: "ready",
      taskId: "ready-a",
    });
    const validToday = transition(boardContext, invalidReady.state, {
      type: "drag-over",
      lane: "today",
      taskId: "today",
    });
    const outside = transition(boardContext, validToday.state, {
      type: "drag-over",
      lane: null,
      taskId: null,
    });

    assert.equal(invalidReady.state.validOverTarget, false);
    assert.equal(validToday.state.validOverTarget, true);
    assert.equal(outside.state.validOverTarget, false);
    assert.equal(outside.state.capacityPreview, null);
  });

  it("previews exact capacity, overage, and recovered capacity", () => {
    const base = context();
    const exactTask = task("exact", { estimateMinutes: 75 });
    const overTask = task("over", { estimateMinutes: 90 });
    const exactContext = context({
      lanes: base.lanes.map((lane) => lane.id === "ready"
        ? { ...lane, tasks: [exactTask, overTask], reorder: guard("ready", [exactTask, overTask]) }
        : lane),
    });
    const exact = transition(exactContext, start(exactContext, "exact").state, {
      type: "drag-over", lane: "today", taskId: "today",
    });
    const over = transition(exactContext, start(exactContext, "over").state, {
      type: "drag-over", lane: "today", taskId: "today",
    });
    const recovered = transition(exactContext, start(exactContext, "today").state, {
      type: "drag-over", lane: "ready", taskId: "exact",
    });

    assert.deepEqual(exact.state.capacityPreview, {
      committedMinutes: 120,
      message: "1h 15m remaining → 0m remaining",
    });
    assert.deepEqual(over.state.capacityPreview, {
      committedMinutes: 135,
      message: "1h 15m remaining → 15m over",
    });
    assert.deepEqual(recovered.state.capacityPreview, {
      committedMinutes: 0,
      message: "1h 15m remaining → 2h remaining",
    });
  });

  it("transforms Task inspector Lane drafts through the same interface", () => {
    const baseTask = task("task", { scheduledDate: today });
    const capture = planningInteraction({
      kind: "lane-draft",
      task: baseTask,
      destination: "capture",
      today,
      draft: { estimate: "30", scheduledDate: today },
    });
    const ready = planningInteraction({
      kind: "lane-draft",
      task: baseTask,
      destination: "ready",
      today,
      draft: { estimate: "30", scheduledDate: today },
    });
    const planned = planningInteraction({
      kind: "lane-draft",
      task: baseTask,
      destination: "today",
      today,
      draft: { estimate: "30", scheduledDate: null },
    });

    assert.deepEqual(capture.draft, { estimate: "", scheduledDate: null });
    assert.deepEqual(ready.draft, { estimate: "30", scheduledDate: null });
    assert.deepEqual(planned.draft, { estimate: "30", scheduledDate: today });
  });

  it("preserves unrelated dates and completed-task drafts", () => {
    const future = "2026-08-12";
    const active = planningInteraction({
      kind: "lane-draft",
      task: task("active", { scheduledDate: future }),
      destination: "capture",
      today,
      draft: { estimate: "30", scheduledDate: future },
    });
    const completedDraft = { estimate: "30", scheduledDate: future };
    const completed = planningInteraction({
      kind: "lane-draft",
      task: task("done", { completedAt: today }),
      destination: "today",
      today,
      draft: completedDraft,
    });

    assert.deepEqual(active.draft, { estimate: "", scheduledDate: future });
    assert.equal(completed.draft, completedDraft);
  });
});

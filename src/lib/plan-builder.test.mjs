import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("./plan-builder.ts", import.meta.url), "utf8")
  .replace('import type { AiPlanItem, AiPlanProposal, PlannerSnapshot } from "@/lib/planner";\n', "");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
const { buildReviewedPlan, planBuilderItems, saferPlanItemIds } = await import(moduleUrl);

const proposal = {
  items: [item("recommended", 60)],
  totalMinutes: 60,
  remainingMinutes: 60,
  rationale: null,
  emptyReason: null,
  todayTaskIds: ["today"],
  todayTaskRevisions: [{ id: "today", revision: 1 }],
  expectedDailyCapacityMinutes: 180,
  expectedRemainingMinutes: 120,
};

describe("Plan builder", () => {
  it("offers only native-eligible Ready tasks after the generated proposal", () => {
    const snapshot = {
      today: "2026-08-19",
      planning: {
        lanes: {
          ready: {
            tasks: [
              task("recommended", 60, null),
              task("overdue", 25, "2026-08-18"),
              task("future", 30, "2026-08-20"),
              task("unsized", null, null),
            ],
          },
        },
      },
    };

    assert.deepEqual(
      planBuilderItems(snapshot, proposal).map(({ id }) => id),
      ["recommended", "overdue"],
    );
  });

  it("recalculates the reviewed plan for a selected subset", () => {
    const reviewed = buildReviewedPlan(proposal, [item("short", 25)]);
    assert.equal(reviewed.totalMinutes, 25);
    assert.equal(reviewed.remainingMinutes, 95);
  });

  it("builds a deterministic safer mix that preserves a forty-minute buffer", () => {
    const selected = saferPlanItemIds(
      [item("first", 50), item("second", 40), item("third", 30)],
      120,
    );
    assert.deepEqual([...selected], ["first", "third"]);
  });
});

function item(id, estimateMinutes) {
  return {
    id,
    title: id,
    estimateMinutes,
    sourceScheduledDate: null,
    scheduledDate: "2026-08-19",
    position: 0,
    revision: 1,
  };
}

function task(id, estimateMinutes, scheduledDate) {
  return {
    id,
    title: id,
    estimateMinutes,
    scheduledDate,
    revision: 1,
  };
}

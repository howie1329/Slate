import type { AiPlanItem, AiPlanProposal, PlannerSnapshot } from "@/lib/planner";

export function planBuilderItems(snapshot: PlannerSnapshot, proposal: AiPlanProposal) {
  const items = [...proposal.items];
  const knownIds = new Set(items.map((item) => item.id));

  for (const task of snapshot.planning.lanes.ready.tasks) {
    if (
      knownIds.has(task.id)
      || task.estimateMinutes === null
      || task.estimateMinutes <= 0
      || (task.scheduledDate !== null && task.scheduledDate >= snapshot.today)
    ) {
      continue;
    }

    items.push({
      id: task.id,
      title: task.title,
      estimateMinutes: task.estimateMinutes,
      sourceScheduledDate: task.scheduledDate,
      scheduledDate: snapshot.today,
      position: proposal.todayTaskIds.length + items.length,
      revision: task.revision,
    });
    knownIds.add(task.id);
  }

  return items;
}

export function buildReviewedPlan(proposal: AiPlanProposal, items: AiPlanItem[]) {
  const totalMinutes = items.reduce((total, item) => total + item.estimateMinutes, 0);

  return {
    ...proposal,
    items,
    totalMinutes,
    remainingMinutes: proposal.expectedRemainingMinutes - totalMinutes,
  };
}

export function saferPlanItemIds(
  items: AiPlanItem[],
  availableMinutes: number,
  targetBufferMinutes = 40,
) {
  const budget = Math.max(0, availableMinutes - targetBufferMinutes);
  const selectedIds = new Set<string>();
  let selectedMinutes = 0;

  for (const item of items) {
    if (selectedMinutes + item.estimateMinutes <= budget) {
      selectedIds.add(item.id);
      selectedMinutes += item.estimateMinutes;
    }
  }

  return selectedIds;
}

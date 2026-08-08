import { Button } from "@/components/ui/button";
import type { TaskMovePreview } from "@/lib/task-move";
import { formatMinutes } from "@/lib/task-groups";

export function TaskMoveConfirmation({
  onCancel,
  onConfirm,
  pending,
  preview,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
  preview: TaskMovePreview;
}) {
  const isOverCapacity = preview.destination === "today" && preview.resultingCapacity.isOverCapacity;
  const capacity = isOverCapacity
    ? `${formatMinutes(preview.resultingCapacity.overageMinutes)} over capacity`
    : `${formatMinutes(preview.resultingCapacity.remainingMinutes)} remaining`;

  return (
    <section
      aria-label="Confirm task move"
      className={`mt-3 border px-3 py-2.5 ${isOverCapacity ? "border-destructive/30 bg-destructive/5" : "border-[var(--task-detail-border)] bg-[var(--task-detail-field)]"}`}
      role={isOverCapacity ? "alert" : undefined}
    >
      <p className={`m-0 text-xs leading-4 ${isOverCapacity ? "text-destructive" : "text-[var(--task-detail-foreground)]"}`}>
        {preview.destination === "today" ? "Move to Today" : "Return to Backlog"} · {formatMoveDelta(preview.deltaMinutes)} · {capacity}
        {isOverCapacity ? ". Existing commitments will stay in place." : "."}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Button disabled={pending} onClick={onConfirm} size="sm" type="button" variant={isOverCapacity ? "destructive" : "default"}>
          {isOverCapacity ? "Commit over capacity" : preview.destination === "today" ? "Commit to Today" : "Return to Backlog"}
        </Button>
        <Button disabled={pending} onClick={onCancel} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
      </div>
    </section>
  );
}

function formatMoveDelta(minutes: number) {
  return `${minutes > 0 ? "+" : "−"}${formatMinutes(Math.abs(minutes))}`;
}

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

type PlannerEmptyStateProps = {
  actionLabel: string;
  children: ReactNode;
  description: string;
  onAction: () => void;
  title: string;
};

export function PlannerEmptyState({ actionLabel, children, description, onAction, title }: PlannerEmptyStateProps) {
  return (
    <Empty className="mt-6 min-h-48 justify-center gap-4 px-4 py-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-reduce:animate-none sm:min-h-64">
      <EmptyHeader>
        <EmptyMedia variant="icon">{children}</EmptyMedia>
        <EmptyTitle className="font-heading text-2xl font-semibold leading-tight tracking-tight text-foreground">{title}</EmptyTitle>
        <EmptyDescription className="max-w-[32ch] text-pretty">{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onAction} type="button">
          {actionLabel}
        </Button>
      </EmptyContent>
    </Empty>
  );
}

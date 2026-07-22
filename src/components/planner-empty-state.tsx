import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import type { TaskMotionTransition } from "@/components/task-motion";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

type PlannerEmptyStateProps = {
  actionLabel: string;
  children: ReactNode;
  description: string;
  onAction: () => void;
  title: string;
  transition?: TaskMotionTransition;
};

const emptyStateEase = [0.23, 1, 0.32, 1] as const;

export function PlannerEmptyState({ actionLabel, children, description, onAction, title, transition = "instant" }: PlannerEmptyStateProps) {
  return (
    <motion.div
      animate={{ opacity: 1 }}
      initial={transition === "animate" ? { opacity: 0 } : false}
      transition={{ duration: 0.14, ease: emptyStateEase }}
    >
      <Empty className="mt-6 min-h-48 justify-center gap-4 px-4 py-6 sm:min-h-64">
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
    </motion.div>
  );
}

import type { MouseEvent, ReactNode } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import type { TaskMotionTransition } from "@/components/task-motion";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

type PlannerEmptyStateProps = {
  actionLabel: string;
  children: ReactNode;
  compact?: boolean;
  description: string;
  onAction: (event: MouseEvent<HTMLButtonElement>) => void;
  title: string;
  transition?: TaskMotionTransition;
};

const emptyStateEase = [0.23, 1, 0.32, 1] as const;

export function PlannerEmptyState({ actionLabel, children, compact = false, description, onAction, title, transition = "instant" }: PlannerEmptyStateProps) {
  return (
    <motion.div
      animate={{ opacity: 1, transform: "translateY(0)" }}
      initial={transition === "animate" ? { opacity: 0, transform: "translateY(6px)" } : false}
      transition={{ duration: 0.18, ease: emptyStateEase }}
    >
      <Empty className={compact ? "gap-3 px-4 py-7" : "mt-6 min-h-48 justify-center gap-4 px-4 py-6 sm:min-h-64"}>
        <EmptyHeader>
          <EmptyMedia variant="icon">{children}</EmptyMedia>
          <EmptyTitle className={compact ? "text-sm font-medium tracking-tight text-foreground" : "font-heading text-2xl font-semibold leading-tight tracking-tight text-foreground"}>{title}</EmptyTitle>
          <EmptyDescription className={compact ? "max-w-[30ch] text-xs leading-4 text-pretty" : "max-w-[32ch] text-pretty"}>{description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button className={compact ? "h-7 rounded-md px-2.5 text-xs" : undefined} onClick={onAction} size={compact ? "sm" : undefined} type="button" variant={compact ? "outline" : "default"}>
            {actionLabel}
          </Button>
        </EmptyContent>
      </Empty>
    </motion.div>
  );
}

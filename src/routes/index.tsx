import { createFileRoute } from "@tanstack/react-router";
import { DailyWorkspace } from "@/components/daily-workspace";

export const Route = createFileRoute("/")({
  component: DailyWorkspace,
});

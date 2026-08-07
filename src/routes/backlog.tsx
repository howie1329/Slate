import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/backlog")({
  beforeLoad: () => {
    throw redirect({ to: "/workspace" });
  },
});

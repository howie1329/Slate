export function plannerMutationErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";

  switch (message) {
    case "stale-task":
      return "This task changed elsewhere. Slate refreshed the workspace; review the latest task and try again.";
    case "stale-task-order":
      return "Task order changed elsewhere. Slate refreshed the workspace; try reordering again.";
    default:
      return message || fallback;
  }
}

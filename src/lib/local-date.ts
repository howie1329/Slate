import type { LocalDate } from "@/lib/planner";

export function dateFromLocalDate(value: LocalDate) {
  return new Date(`${value}T00:00:00`);
}

export function localDateFromDate(value: Date): LocalDate {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}` as LocalDate;
}

export function formatDueDate(value: LocalDate | null) {
  if (!value) {
    return "Set date";
  }

  return dateFromLocalDate(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

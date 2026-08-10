export function formatMinutes(minutes: number | null) {
  return minutes === null ? "—" : `${minutes} min`;
}

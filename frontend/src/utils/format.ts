export function formatMetric(value: string | number | null | undefined, suffix = ""): string {
  if (value === null || value === undefined || value === "") {
    return `0${suffix}`;
  }
  return `${value}${suffix}`;
}

export function formatMetric(value: string | number | null | undefined, suffix = ""): string {
  if (value === null || value === undefined || value === "") {
    return `0${suffix}`;
  }
  return `${value}${suffix}`;
}

export function formatDecimal(
  value: string | number | null | undefined,
  options?: { minFractionDigits?: number; maxFractionDigits?: number },
): string {
  if (value === null || value === undefined || value === "") {
    return "0";
  }

  const raw = String(value).trim();
  if (!raw) {
    return "0";
  }

  const normalized = raw.replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return raw;
  }

  const minFractionDigits = options?.minFractionDigits ?? 0;
  const maxFractionDigits = options?.maxFractionDigits ?? 8;
  return parsed.toLocaleString("en-US", {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
    useGrouping: false,
  });
}

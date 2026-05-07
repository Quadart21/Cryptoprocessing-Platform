/**
 * Money / accounting amounts must never render as scientific notation (e.g. 8e-8).
 */

export function formatMetric(value: string | number | null | undefined, suffix = ""): string {
  if (value === null || value === undefined || value === "") {
    return `0${suffix}`;
  }
  return `${formatDecimal(value)}${suffix}`;
}

export function formatDecimal(
  value: string | number | null | undefined,
  options?: { minFractionDigits?: number; maxFractionDigits?: number },
): string {
  if (value === null || value === undefined || value === "") {
    return minFractionZeroPad(0, options?.minFractionDigits ?? 0);
  }

  const minFd = options?.minFractionDigits ?? 0;
  const maxFd = options?.maxFractionDigits ?? 8;

  const raw = typeof value === "number" ? String(value) : String(value).trim();
  if (!raw) {
    return minFractionZeroPad(0, minFd);
  }

  const normalized = raw.replace(/\s/g, "").replace(",", ".");

  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized) && /[eE]/.test(normalized)) {
    return formatFiniteNumberNoExponent(Number(normalized), minFd, maxFd);
  }

  if (/^[+-]?\d*\.?\d+$/.test(normalized) && !/[eE]/.test(normalized)) {
    return formatPlainDecimalString(normalized, minFd, maxFd);
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) {
    return raw;
  }
  return formatFiniteNumberNoExponent(n, minFd, maxFd);
}

/** Table / card: locale + standard notation, with currency suffix. */
export function formatMoneyAmount(
  value: string | number | null | undefined,
  currency: string,
  options?: { minFractionDigits?: number; maxFractionDigits?: number },
): string {
  const minFd = options?.minFractionDigits ?? 2;
  const maxFd = options?.maxFractionDigits ?? 8;
  const raw = typeof value === "number" ? String(value) : String(value ?? "").trim();
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n)) {
    return `${formatDecimal(value, { minFractionDigits: minFd, maxFractionDigits: maxFd })} ${currency}`;
  }
  return `${n.toLocaleString("ru-RU", {
    minimumFractionDigits: minFd,
    maximumFractionDigits: maxFd,
    notation: "standard",
  })} ${currency}`;
}

function minFractionZeroPad(n: number, minFd: number): string {
  if (minFd <= 0) {
    return String(n);
  }
  return n.toFixed(minFd);
}

function formatPlainDecimalString(input: string, minFd: number, maxFd: number): string {
  const neg = input.startsWith("-");
  const body = neg ? input.slice(1) : input;
  const dot = body.indexOf(".");
  const intPart = (dot === -1 ? body : body.slice(0, dot)) || "0";
  let frac = dot === -1 ? "" : body.slice(dot + 1, dot + 1 + maxFd);
  if (minFd > 0 && frac.length < minFd) {
    frac = frac.padEnd(minFd, "0");
  }
  if (minFd === 0) {
    frac = frac.replace(/0+$/, "");
  }
  const sign = neg ? "-" : "";
  if (!frac) {
    return sign + intPart;
  }
  return sign + intPart + "." + frac;
}

function formatFiniteNumberNoExponent(n: number, minFd: number, maxFd: number): string {
  try {
    const formatted = new Intl.NumberFormat("en-US", {
      notation: "standard",
      minimumFractionDigits: minFd,
      maximumFractionDigits: maxFd,
      useGrouping: false,
    }).format(n);
    if (!/[eE]/.test(formatted)) {
      return formatted;
    }
  } catch {
    // optional notation
  }
  if (n === 0) {
    return minFd > 0 ? `0.${"0".repeat(minFd)}` : "0";
  }
  return formatPlainDecimalString(n.toFixed(Math.min(20, maxFd + 4)), minFd, maxFd);
}

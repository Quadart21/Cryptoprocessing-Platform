export function formatNetworkConfirmations(
  actual: number | null | undefined,
  required: number | null | undefined,
): string | null {
  const hasActual = actual != null && actual >= 0;
  const hasRequired = required != null && required > 0;

  if (!hasActual && !hasRequired) {
    return null;
  }
  if (hasRequired) {
    return `${hasActual ? actual : 0}/${required}`;
  }
  return `${actual}`;
}

export type NetworkConfirmationProgress = {
  actual: number;
  required: number | null;
  ratio: number;
  hasRequired: boolean;
  hasProgress: boolean;
  percentLabel: string | null;
};

export function resolveNetworkConfirmationProgress(
  actual: number | null | undefined,
  required: number | null | undefined,
): NetworkConfirmationProgress {
  const hasRequired = required != null && required > 0;
  const actualValue = actual != null && actual >= 0 ? actual : 0;
  const hasProgress = hasRequired || (actual != null && actual >= 0);

  let ratio = 0;
  if (hasRequired) {
    ratio = Math.min(1, actualValue / required);
  } else if (actualValue > 0) {
    ratio = 0.35;
  }

  const percentLabel = hasRequired ? `${Math.round(ratio * 100)}%` : null;

  return {
    actual: actualValue,
    required: hasRequired ? required : null,
    ratio,
    hasRequired,
    hasProgress,
    percentLabel,
  };
}

export function shouldShowConfirmationSegments(required: number | null): boolean {
  return required != null && required > 0 && required <= 20;
}

export function hasNetworkConfirmationProgress(
  actual: number | null | undefined,
  required: number | null | undefined,
): boolean {
  return formatNetworkConfirmations(actual, required) !== null;
}

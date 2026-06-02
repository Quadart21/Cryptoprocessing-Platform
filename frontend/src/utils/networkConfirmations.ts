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

export function hasNetworkConfirmationProgress(
  actual: number | null | undefined,
  required: number | null | undefined,
): boolean {
  return formatNetworkConfirmations(actual, required) !== null;
}

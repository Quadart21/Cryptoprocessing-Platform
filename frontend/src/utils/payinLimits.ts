import type { RateNetworkItem } from "../api";

function parsePositiveNumber(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function resolvePayinMinFiatAmount(
  network: RateNetworkItem | null,
  fiatCurrency: string,
): number | null {
  if (!network) {
    return null;
  }

  const normalizedFiat = fiatCurrency.trim().toUpperCase();
  const minFiat = parsePositiveNumber(network.min_deposit_fiat);
  if (minFiat !== null && (normalizedFiat === "USD" || normalizedFiat === "USDT" || normalizedFiat === "USDC")) {
    return minFiat;
  }

  const minDeposit = parsePositiveNumber(network.min_deposit);
  if (minDeposit === null) {
    return null;
  }

  if (normalizedFiat === "USD" || normalizedFiat === "USDT" || normalizedFiat === "USDC") {
    return minDeposit;
  }

  return minFiat;
}

export function resolvePayinMaxFiatAmount(
  network: RateNetworkItem | null,
  fiatCurrency: string,
): number | null {
  if (!network) {
    return null;
  }

  const normalizedFiat = fiatCurrency.trim().toUpperCase();
  const maxFiat = parsePositiveNumber(network.max_deposit_fiat);
  if (maxFiat !== null && (normalizedFiat === "USD" || normalizedFiat === "USDT" || normalizedFiat === "USDC")) {
    return maxFiat;
  }

  const maxDeposit = parsePositiveNumber(network.max_deposit);
  if (maxDeposit === null) {
    return null;
  }

  if (normalizedFiat === "USD" || normalizedFiat === "USDT" || normalizedFiat === "USDC") {
    return maxDeposit;
  }

  return maxFiat;
}

export function isPayinAmountWithinLimits(
  amountFiat: number,
  network: RateNetworkItem | null,
  fiatCurrency: string,
): boolean {
  if (!Number.isFinite(amountFiat) || amountFiat <= 0) {
    return false;
  }

  const minAmount = resolvePayinMinFiatAmount(network, fiatCurrency);
  if (minAmount !== null && amountFiat + 1e-12 < minAmount) {
    return false;
  }

  const maxAmount = resolvePayinMaxFiatAmount(network, fiatCurrency);
  if (maxAmount !== null && amountFiat - 1e-12 > maxAmount) {
    return false;
  }

  return true;
}

export function formatPayinLimitHint(
  network: RateNetworkItem | null,
  cryptoCurrency: string,
  fiatCurrency: string,
  formatApprox?: (params: { cryptoPart: string; minFiat: string; fiatCurrency: string }) => string,
): string | null {
  if (!network?.min_deposit) {
    return null;
  }

  const minFiat = resolvePayinMinFiatAmount(network, fiatCurrency);
  const cryptoPart = `${network.min_deposit} ${cryptoCurrency}`;
  if (minFiat === null) {
    return cryptoPart;
  }

  if (formatApprox) {
    return formatApprox({ cryptoPart, minFiat: String(minFiat), fiatCurrency });
  }

  return `${cryptoPart} (≈ ${minFiat} ${fiatCurrency})`;
}

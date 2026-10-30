import type { RateNetworkItem } from "../api";

function parsePositiveNumber(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isStableFiat(currency: string): boolean {
  return currency === "USD" || currency === "USDT" || currency === "USDC";
}

/** Min amount in the invoice's amount units (token when fiat_currency === crypto, else fiat). */
export function resolvePayinMinFiatAmount(
  network: RateNetworkItem | null,
  fiatCurrency: string,
  cryptoCurrency?: string,
): number | null {
  if (!network) {
    return null;
  }

  const normalizedFiat = fiatCurrency.trim().toUpperCase();
  const normalizedCrypto = (cryptoCurrency ?? "").trim().toUpperCase();

  if (normalizedCrypto && normalizedCrypto === normalizedFiat) {
    return parsePositiveNumber(network.min_deposit);
  }

  const minFiat = parsePositiveNumber(network.min_deposit_fiat);
  if (minFiat !== null && isStableFiat(normalizedFiat)) {
    return minFiat;
  }

  const minDeposit = parsePositiveNumber(network.min_deposit);
  if (minDeposit === null) {
    return null;
  }

  if (isStableFiat(normalizedFiat)) {
    return minDeposit;
  }

  return minFiat;
}

export function resolvePayinMaxFiatAmount(
  network: RateNetworkItem | null,
  fiatCurrency: string,
  cryptoCurrency?: string,
): number | null {
  if (!network) {
    return null;
  }

  const normalizedFiat = fiatCurrency.trim().toUpperCase();
  const normalizedCrypto = (cryptoCurrency ?? "").trim().toUpperCase();

  if (normalizedCrypto && normalizedCrypto === normalizedFiat) {
    return parsePositiveNumber(network.max_deposit);
  }

  const maxFiat = parsePositiveNumber(network.max_deposit_fiat);
  if (maxFiat !== null && isStableFiat(normalizedFiat)) {
    return maxFiat;
  }

  const maxDeposit = parsePositiveNumber(network.max_deposit);
  if (maxDeposit === null) {
    return null;
  }

  if (isStableFiat(normalizedFiat)) {
    return maxDeposit;
  }

  return maxFiat;
}

export function isPayinAmountWithinLimits(
  amountFiat: number,
  network: RateNetworkItem | null,
  fiatCurrency: string,
  cryptoCurrency?: string,
): boolean {
  if (!Number.isFinite(amountFiat) || amountFiat <= 0) {
    return false;
  }

  const minAmount = resolvePayinMinFiatAmount(network, fiatCurrency, cryptoCurrency);
  if (minAmount !== null && amountFiat + 1e-12 < minAmount) {
    return false;
  }

  const maxAmount = resolvePayinMaxFiatAmount(network, fiatCurrency, cryptoCurrency);
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

  const cryptoPart = `${network.min_deposit} ${cryptoCurrency}`;
  const normalizedFiat = fiatCurrency.trim().toUpperCase();
  const normalizedCrypto = cryptoCurrency.trim().toUpperCase();
  if (normalizedCrypto && normalizedCrypto === normalizedFiat) {
    return cryptoPart;
  }

  const minFiat = resolvePayinMinFiatAmount(network, fiatCurrency, cryptoCurrency);
  if (minFiat === null) {
    return cryptoPart;
  }

  if (formatApprox) {
    return formatApprox({ cryptoPart, minFiat: String(minFiat), fiatCurrency });
  }

  return `${cryptoPart} (≈ ${minFiat} ${fiatCurrency})`;
}

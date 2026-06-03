const KNOWN_SYMBOLS: Record<string, string> = {
  BTC: "WHITEBIT:BTCUSDT.P",
  DOGE: "WHITEBIT:DOGEUSDT.P",
  ETH: "WHITEBIT:ETHUSDT.P",
  TON: "WHITEBIT:TONUSDT.P",
  LTC: "WHITEBIT:LTCUSDT.P",
  TRX: "WHITEBIT:TRXUSDT.P",
  SOL: "WHITEBIT:SOLUSDT.P",
  XRP: "WHITEBIT:XRPUSDT.P",
  BNB: "WHITEBIT:BNBUSDT.P",
};

const STABLECOIN_QUOTES = new Set(["USDT", "USDC", "USD", "BUSD", "DAI", "TUSD"]);

export function resolveTradingViewSymbol(currency: string, quote = "USDT"): string {
  const normalized = currency.trim().toUpperCase();
  if (!normalized) {
    return "";
  }
  if (KNOWN_SYMBOLS[normalized]) {
    return KNOWN_SYMBOLS[normalized];
  }
  if (STABLECOIN_QUOTES.has(normalized)) {
    return "";
  }
  return `WHITEBIT:${normalized}${quote}.P`;
}

export function buildTradingViewCompareSymbols(
  primaryCurrency: string,
  availableCurrencies: string[],
): Array<{
  symbol: string;
  position: "SameScale";
}> {
  const primary = primaryCurrency.trim().toUpperCase();
  return availableCurrencies
    .filter((currency) => currency !== primary)
    .slice(0, 2)
    .map((currency) => resolveTradingViewSymbol(currency))
    .filter(Boolean)
    .map((symbol) => ({
      symbol,
      position: "SameScale" as const,
    }));
}

export function buildTradingViewSymbolOptions(
  rates: Array<{ currency: string }> | undefined,
): string[] {
  return [...new Set(
    (rates ?? [])
      .map((rate) => rate.currency.trim().toUpperCase())
      .filter((currency) => Boolean(currency) && !STABLECOIN_QUOTES.has(currency)),
  )].sort((left, right) => left.localeCompare(right, "ru"));
}

export function tradingViewSymbolLabel(currency: string): string {
  return `${currency.trim().toUpperCase()}/USDT`;
}

export function pickTradingViewCurrency(
  options: string[],
  preferred?: string,
): string {
  const normalizedPreferred = preferred?.trim().toUpperCase() ?? "";
  if (normalizedPreferred && options.includes(normalizedPreferred)) {
    return normalizedPreferred;
  }
  return options[0] ?? "";
}

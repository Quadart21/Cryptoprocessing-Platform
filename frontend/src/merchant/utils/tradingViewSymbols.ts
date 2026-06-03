const STABLECOIN_QUOTES = new Set(["USDT", "USDC", "USD", "BUSD", "DAI", "TUSD"]);

export function resolveTradingViewSymbol(currency: string, quote = "USDT"): string {
  const normalized = currency.trim().toUpperCase();
  if (!normalized || STABLECOIN_QUOTES.has(normalized)) {
    return "";
  }
  return `BINANCE:${normalized}${quote}`;
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

export function tradingViewChartUrl(symbol: string): string {
  const normalized = symbol.trim();
  if (!normalized.includes(":")) {
    return "https://www.tradingview.com/";
  }
  const [exchange, pair] = normalized.split(":", 2);
  return `https://www.tradingview.com/symbols/${pair}/?exchange=${exchange}`;
}

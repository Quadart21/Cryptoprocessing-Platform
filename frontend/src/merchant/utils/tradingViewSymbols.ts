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
  USDT: "WHITEBIT:USDTUSD",
};

const QUICK_PICKS = ["DOGE", "BTC", "ETH", "TON", "TRX", "SOL"] as const;

export function resolveTradingViewSymbol(currency: string, quote = "USDT"): string {
  const normalized = currency.trim().toUpperCase();
  if (!normalized) {
    return KNOWN_SYMBOLS.DOGE;
  }
  if (KNOWN_SYMBOLS[normalized]) {
    return KNOWN_SYMBOLS[normalized];
  }
  if (normalized === quote) {
    return KNOWN_SYMBOLS.USDT;
  }
  return `WHITEBIT:${normalized}${quote}.P`;
}

export function buildTradingViewCompareSymbols(primaryCurrency: string): Array<{
  symbol: string;
  position: "SameScale";
}> {
  const primary = primaryCurrency.trim().toUpperCase();
  const candidates = QUICK_PICKS.filter((item) => item !== primary).slice(0, 2);
  return candidates.map((currency) => ({
    symbol: resolveTradingViewSymbol(currency),
    position: "SameScale",
  }));
}

export function buildTradingViewSymbolOptions(
  rates: Array<{ currency: string }> | undefined,
): string[] {
  const fromRates = (rates ?? [])
    .map((rate) => rate.currency.trim().toUpperCase())
    .filter(Boolean);
  const merged = [...QUICK_PICKS, ...fromRates];
  return [...new Set(merged)].filter((currency) => currency !== "USDT");
}

export function tradingViewSymbolLabel(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  if (normalized === "USDT") {
    return "USDT/USD";
  }
  return `${normalized}/USDT`;
}

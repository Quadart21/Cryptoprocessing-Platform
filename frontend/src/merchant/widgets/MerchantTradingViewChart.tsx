import { memo, useEffect, useMemo, useRef, useState } from "react";

import {
  buildTradingViewCompareSymbols,
  buildTradingViewSymbolOptions,
  resolveTradingViewSymbol,
  tradingViewSymbolLabel,
} from "../utils/tradingViewSymbols";

type MerchantTradingViewChartProps = {
  rates?: Array<{ currency: string }>;
  defaultCurrency?: string;
  compact?: boolean;
  className?: string;
};

const INTERVAL_OPTIONS = [
  { value: "1", label: "1м" },
  { value: "15", label: "15м" },
  { value: "60", label: "1ч" },
  { value: "240", label: "4ч" },
  { value: "D", label: "1д" },
] as const;

function MerchantTradingViewChart({
  rates,
  defaultCurrency = "DOGE",
  compact = false,
  className = "",
}: MerchantTradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedCurrency, setSelectedCurrency] = useState(defaultCurrency.trim().toUpperCase() || "DOGE");
  const [chartInterval, setChartInterval] = useState<(typeof INTERVAL_OPTIONS)[number]["value"]>("15");

  const symbolOptions = useMemo(() => buildTradingViewSymbolOptions(rates), [rates]);
  const tradingViewSymbol = useMemo(
    () => resolveTradingViewSymbol(selectedCurrency),
    [selectedCurrency],
  );

  useEffect(() => {
    const normalized = defaultCurrency.trim().toUpperCase();
    if (normalized && symbolOptions.includes(normalized)) {
      setSelectedCurrency(normalized);
    }
  }, [defaultCurrency, symbolOptions]);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) {
      return;
    }

    host.replaceChildren();

    const widget = document.createElement("div");
    widget.className = "mc-tv-widget__canvas";
    host.appendChild(widget);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      allow_symbol_change: false,
      calendar: false,
      details: false,
      hide_side_toolbar: true,
      hide_top_toolbar: !compact,
      hide_legend: false,
      hide_volume: compact,
      hotlist: false,
      interval: chartInterval,
      locale: "ru",
      save_image: false,
      style: "1",
      symbol: tradingViewSymbol,
      theme: "dark",
      timezone: "Etc/UTC",
      backgroundColor: "#080e1c",
      gridColor: "rgba(117, 158, 255, 0.08)",
      watchlist: [],
      withdateranges: false,
      compareSymbols: buildTradingViewCompareSymbols(selectedCurrency),
      studies: [],
      autosize: true,
    });
    host.appendChild(script);

    return () => {
      host.replaceChildren();
    };
  }, [chartInterval, compact, selectedCurrency, tradingViewSymbol]);

  return (
    <article className={`mc-surface mc-tv-widget${compact ? " mc-tv-widget--compact" : ""} ${className}`.trim()}>
      <header className="mc-surface-header mc-surface-header--row mc-tv-widget__header">
        <div>
          <p className="mc-surface-eyebrow">Рынок</p>
          <h2 className="mc-surface-title">{compact ? "Курс токена" : "График котировок"}</h2>
          <p className="mc-surface-desc" style={{ marginBottom: 0 }}>
            {compact
              ? "Актуальная цена перед выставлением счёта — данные TradingView."
              : "Следите за курсами принимаемых монет в реальном времени."}
          </p>
        </div>
        <div className="mc-tv-widget__controls">
          <label className="mc-tv-widget__control">
            <span>Пара</span>
            <select
              onChange={(event) => setSelectedCurrency(event.target.value)}
              value={selectedCurrency}
            >
              {symbolOptions.map((currency) => (
                <option key={currency} value={currency}>
                  {tradingViewSymbolLabel(currency)}
                </option>
              ))}
            </select>
          </label>
          <label className="mc-tv-widget__control">
            <span>Интервал</span>
            <select onChange={(event) => setChartInterval(event.target.value as typeof chartInterval)} value={chartInterval}>
              {INTERVAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="mc-tv-widget__stage" ref={containerRef} />

      <p className="mc-tv-widget__credit">
        График{" "}
        <a href={`https://ru.tradingview.com/chart/?symbol=${encodeURIComponent(tradingViewSymbol)}`} rel="noopener noreferrer" target="_blank">
          TradingView
        </a>
        · биржа WhiteBIT
      </p>
    </article>
  );
}

export default memo(MerchantTradingViewChart);

import { memo, useEffect, useMemo, useRef, useState } from "react";

import {
  buildTradingViewSymbolOptions,
  pickTradingViewCurrency,
  resolveTradingViewSymbol,
  tradingViewChartUrl,
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

function buildWidgetConfig(
  symbol: string,
  interval: (typeof INTERVAL_OPTIONS)[number]["value"],
  compact: boolean,
): string {
  return JSON.stringify({
    allow_symbol_change: false,
    calendar: false,
    details: false,
    hide_side_toolbar: true,
    hide_top_toolbar: compact,
    hide_legend: false,
    hide_volume: true,
    hotlist: false,
    interval,
    locale: "ru",
    save_image: false,
    style: "1",
    symbol,
    theme: "dark",
    timezone: "Etc/UTC",
    backgroundColor: "#080e1c",
    gridColor: "rgba(117, 158, 255, 0.08)",
    watchlist: [],
    withdateranges: false,
    compareSymbols: [],
    studies: [],
    autosize: true,
  });
}

function MerchantTradingViewChart({
  rates,
  defaultCurrency,
  compact = false,
  className = "",
}: MerchantTradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const symbolOptions = useMemo(() => buildTradingViewSymbolOptions(rates), [rates]);
  const [selectedCurrency, setSelectedCurrency] = useState(() =>
    pickTradingViewCurrency(symbolOptions, defaultCurrency),
  );
  const [chartInterval, setChartInterval] = useState<(typeof INTERVAL_OPTIONS)[number]["value"]>("1");

  const tradingViewSymbol = useMemo(
    () => resolveTradingViewSymbol(selectedCurrency),
    [selectedCurrency],
  );

  useEffect(() => {
    setSelectedCurrency((current) => {
      if (current && symbolOptions.includes(current)) {
        return current;
      }
      return pickTradingViewCurrency(symbolOptions, defaultCurrency);
    });
  }, [defaultCurrency, symbolOptions]);

  useEffect(() => {
    const normalized = defaultCurrency?.trim().toUpperCase() ?? "";
    if (normalized && symbolOptions.includes(normalized)) {
      setSelectedCurrency(normalized);
    }
  }, [defaultCurrency, symbolOptions]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !tradingViewSymbol) {
      return;
    }

    container.querySelectorAll("script").forEach((node) => node.remove());
    const widget = container.querySelector(".tradingview-widget-container__widget");
    if (widget instanceof HTMLElement) {
      widget.replaceChildren();
    }

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = buildWidgetConfig(tradingViewSymbol, chartInterval, compact);
    container.appendChild(script);

    return () => {
      container.querySelectorAll("script").forEach((node) => node.remove());
    };
  }, [chartInterval, compact, tradingViewSymbol]);

  if (symbolOptions.length === 0) {
    return (
      <article className={`mc-surface mc-tv-widget mc-tv-widget--empty ${className}`.trim()}>
        <header className="mc-surface-header">
          <p className="mc-surface-eyebrow">Рынок</p>
          <h2 className="mc-surface-title">{compact ? "Курс токена" : "График котировок"}</h2>
        </header>
        <p className="muted-text mc-tv-widget__empty">
          Нет доступных пар для графика. Включите монеты в настройках платформы — здесь появятся только
          принимаемые вами токены.
        </p>
      </article>
    );
  }

  return (
    <article className={`mc-surface mc-tv-widget${compact ? " mc-tv-widget--compact" : ""} ${className}`.trim()}>
      <header className="mc-surface-header mc-surface-header--row mc-tv-widget__header">
        <div>
          <p className="mc-surface-eyebrow">Рынок</p>
          <h2 className="mc-surface-title">{compact ? "Курс токена" : "График котировок"}</h2>
          <p className="mc-surface-desc" style={{ marginBottom: 0 }}>
            {compact
              ? "Курс выбранного токена из вашего списка приёма."
              : `Доступно пар: ${symbolOptions.length} — только монеты из вашего каталога.`}
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

      <div className="mc-tv-widget__stage">
        <div
          className="tradingview-widget-container mc-tv-widget__embed"
          ref={containerRef}
          style={{ height: "100%", width: "100%" }}
        >
          <div
            className="tradingview-widget-container__widget"
            style={{ height: "calc(100% - 32px)", width: "100%" }}
          />
          <div className="tradingview-widget-copyright mc-tv-widget__copyright">
            <a href={tradingViewChartUrl(tradingViewSymbol)} rel="noopener nofollow noreferrer" target="_blank">
              <span>{tradingViewSymbolLabel(selectedCurrency)}</span>
            </a>
            <span className="mc-tv-widget__trademark"> · TradingView</span>
          </div>
        </div>
      </div>
    </article>
  );
}

export default memo(MerchantTradingViewChart);

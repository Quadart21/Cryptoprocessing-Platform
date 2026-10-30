import { memo, useEffect, useMemo, useRef, useState } from "react";

import { useTranslation } from "../../i18n";
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

const INTERVAL_VALUES = ["1", "15", "60", "240", "D"] as const;
type ChartInterval = (typeof INTERVAL_VALUES)[number];

function buildWidgetConfig(symbol: string, interval: ChartInterval, compact: boolean): string {
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

type TradingViewEmbedProps = {
  symbol: string;
  interval: ChartInterval;
  compact: boolean;
};

/**
 * TradingView embed script only reads config on first execution of a cached URL.
 * Remount the whole tree (via parent `key`) and bust the script URL so a new
 * symbol/interval always loads a fresh widget.
 */
function TradingViewEmbed({ symbol, interval, compact }: TradingViewEmbedProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = hostRef.current;
    if (!container || !symbol) {
      return;
    }

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "100%";
    widget.style.width = "100%";
    container.appendChild(widget);

    const script = document.createElement("script");
    // Cache-bust so the browser re-executes the embed bootstrap with new config.
    script.src = `https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js?v=${encodeURIComponent(`${symbol}-${interval}`)}`;
    script.type = "text/javascript";
    script.async = true;
    script.text = buildWidgetConfig(symbol, interval, compact);
    container.appendChild(script);

    return () => {
      container.replaceChildren();
    };
  }, [compact, interval, symbol]);

  return (
    <div
      className="tradingview-widget-container mc-tv-widget__embed"
      ref={hostRef}
      style={{ height: "100%", width: "100%" }}
    />
  );
}

function MerchantTradingViewChart({
  rates,
  defaultCurrency,
  compact = false,
  className = "",
}: MerchantTradingViewChartProps) {
  const { t } = useTranslation();
  const symbolOptions = useMemo(() => buildTradingViewSymbolOptions(rates), [rates]);
  const [selectedCurrency, setSelectedCurrency] = useState(() =>
    pickTradingViewCurrency(symbolOptions, defaultCurrency),
  );
  const [chartInterval, setChartInterval] = useState<ChartInterval>("1");
  const [userPickedPair, setUserPickedPair] = useState(false);

  const tradingViewSymbol = useMemo(
    () => resolveTradingViewSymbol(selectedCurrency),
    [selectedCurrency],
  );

  // Keep selection valid when the catalog changes; do not yank back to default
  // while the merchant is browsing another pair.
  useEffect(() => {
    setSelectedCurrency((current) => {
      if (current && symbolOptions.includes(current)) {
        return current;
      }
      return pickTradingViewCurrency(symbolOptions, defaultCurrency);
    });
  }, [defaultCurrency, symbolOptions]);

  // Sync from invoice form only until the user manually picks a pair.
  useEffect(() => {
    if (userPickedPair) {
      return;
    }
    const normalized = defaultCurrency?.trim().toUpperCase() ?? "";
    if (normalized && symbolOptions.includes(normalized)) {
      setSelectedCurrency(normalized);
    }
  }, [defaultCurrency, symbolOptions, userPickedPair]);

  if (symbolOptions.length === 0) {
    return (
      <article className={`mc-surface mc-tv-widget mc-tv-widget--empty ${className}`.trim()}>
        <header className="mc-surface-header">
          <p className="mc-surface-eyebrow">{t("merchant.widgets.merchantTradingViewChart.eyebrow")}</p>
          <h2 className="mc-surface-title">
            {compact
              ? t("merchant.widgets.merchantTradingViewChart.titleCompact")
              : t("merchant.widgets.merchantTradingViewChart.titleFull")}
          </h2>
        </header>
        <p className="muted-text mc-tv-widget__empty">
          {t("merchant.widgets.merchantTradingViewChart.emptyDescription")}
        </p>
      </article>
    );
  }

  const embedKey = `${tradingViewSymbol}|${chartInterval}|${compact ? "c" : "f"}`;

  return (
    <article className={`mc-surface mc-tv-widget${compact ? " mc-tv-widget--compact" : ""} ${className}`.trim()}>
      <header className="mc-surface-header mc-surface-header--row mc-tv-widget__header">
        <div>
          <p className="mc-surface-eyebrow">{t("merchant.widgets.merchantTradingViewChart.eyebrow")}</p>
          <h2 className="mc-surface-title">
            {compact
              ? t("merchant.widgets.merchantTradingViewChart.titleCompact")
              : t("merchant.widgets.merchantTradingViewChart.titleFull")}
          </h2>
          <p className="mc-surface-desc" style={{ marginBottom: 0 }}>
            {compact
              ? t("merchant.widgets.merchantTradingViewChart.compactDescription")
              : t("merchant.widgets.merchantTradingViewChart.fullDescription", {
                  count: symbolOptions.length,
                })}
          </p>
        </div>
        <div className="mc-tv-widget__controls">
          <label className="mc-tv-widget__control">
            <span>{t("common.pair")}</span>
            <select
              onChange={(event) => {
                setUserPickedPair(true);
                setSelectedCurrency(event.target.value);
              }}
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
            <span>{t("merchant.widgets.merchantTradingViewChart.interval")}</span>
            <select
              onChange={(event) => setChartInterval(event.target.value as ChartInterval)}
              value={chartInterval}
            >
              {INTERVAL_VALUES.map((value) => (
                <option key={value} value={value}>
                  {t(`merchant.widgets.merchantTradingViewChart.intervals.${value}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="mc-tv-widget__stage">
        {tradingViewSymbol ? (
          <div className="mc-tv-widget__embed-shell" key={embedKey}>
            <TradingViewEmbed compact={compact} interval={chartInterval} symbol={tradingViewSymbol} />
            <div className="tradingview-widget-copyright mc-tv-widget__copyright">
              <a href={tradingViewChartUrl(tradingViewSymbol)} rel="noopener nofollow noreferrer" target="_blank">
                <span>{tradingViewSymbolLabel(selectedCurrency)}</span>
              </a>
              <span className="mc-tv-widget__trademark">
                {t("merchant.widgets.merchantTradingViewChart.trademark")}
              </span>
            </div>
          </div>
        ) : (
          <p className="muted-text mc-tv-widget__empty">
            {t("merchant.widgets.merchantTradingViewChart.emptyDescription")}
          </p>
        )}
      </div>
    </article>
  );
}

export default memo(MerchantTradingViewChart);

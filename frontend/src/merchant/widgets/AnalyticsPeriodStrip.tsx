import type { AnalyticsChartPoint, AnalyticsPeriod, ClientAnalyticsSummary } from "../../hooks/useClientAnalytics";
import { useTranslation } from "../../i18n";

export type AnalyticsPeriodStripProps = {
  period: AnalyticsPeriod;
  onPeriodChange: (next: AnalyticsPeriod) => void;
  summary: ClientAnalyticsSummary;
  chartPoints?: AnalyticsChartPoint[];
};

const PERIOD_KEYS: AnalyticsPeriod[] = ["today", "7d", "30d", "90d", "all"];

type KpiTone = "primary" | "accent" | "neutral" | "muted";

function AnalyticsKpi({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: KpiTone;
}) {
  return (
    <article className={`mc-kpi mc-kpi--${tone}`}>
      <span className="mc-kpi__label">{label}</span>
      <strong className="mc-kpi__value">{value}</strong>
      {hint ? <p className="mc-kpi__hint">{hint}</p> : null}
    </article>
  );
}

function AnalyticsSparkBars({
  points,
  emptyLabel,
  legendTurnover,
  legendNet,
}: {
  points: AnalyticsChartPoint[];
  emptyLabel: string;
  legendTurnover: string;
  legendNet: string;
}) {
  if (points.length === 0) {
    return <p className="mc-analytics-chart__empty">{emptyLabel}</p>;
  }

  const maxValue = Math.max(...points.map((point) => Math.max(point.primary, point.secondary)), 0);
  const peak = maxValue > 0 ? maxValue : 1;

  return (
    <div className="mc-analytics-chart">
      <div className="mc-analytics-chart__legend" aria-hidden="true">
        <span className="mc-analytics-chart__swatch mc-analytics-chart__swatch--primary" />
        {legendTurnover}
        <span className="mc-analytics-chart__swatch mc-analytics-chart__swatch--secondary" />
        {legendNet}
      </div>
      <div className="mc-analytics-chart__bars" role="img" aria-label={legendTurnover}>
        {points.map((point, index) => {
          const primaryHeight = Math.max(4, Math.round((point.primary / peak) * 100));
          const secondaryHeight = Math.max(point.secondary > 0 ? 4 : 0, Math.round((point.secondary / peak) * 100));
          return (
            <div className="mc-analytics-chart__col" key={`${point.label}-${index}`} title={point.label}>
              <div className="mc-analytics-chart__stack">
                <span
                  className="mc-analytics-chart__bar mc-analytics-chart__bar--primary"
                  style={{ height: `${primaryHeight}%` }}
                />
                <span
                  className="mc-analytics-chart__bar mc-analytics-chart__bar--secondary"
                  style={{ height: `${secondaryHeight}%` }}
                />
              </div>
              <span className="mc-analytics-chart__tick">{point.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AnalyticsPeriodStrip({
  period,
  onPeriodChange,
  summary,
  chartPoints = [],
}: AnalyticsPeriodStripProps) {
  const { t } = useTranslation();

  return (
    <section className="mc-analytics">
      <div className="mc-analytics-top">
        <div className="mc-analytics-heading">
          <p className="mc-analytics-eyebrow">{t("merchant.analytics.eyebrow")}</p>
          <h2 className="mc-analytics-title">{t("merchant.analytics.title")}</h2>
          <p className="mc-analytics-lead">{t("merchant.analytics.lead")}</p>
        </div>
        <div className="mc-analytics-range-box">
          <span className="mc-analytics-range-label">{t("merchant.analytics.rangeLabel")}</span>
          <p className="mc-analytics-range">{summary.periodLabel}</p>
        </div>
      </div>

      <div className="mc-analytics-chips" role="group" aria-label={t("merchant.analytics.periodAria")}>
        {PERIOD_KEYS.map((key) => (
          <button
            className={`mc-analytics-chip${period === key ? " mc-analytics-chip--active" : ""}`}
            key={key}
            onClick={() => onPeriodChange(key)}
            type="button"
          >
            {t(`merchant.analytics.periods.${key}`)}
          </button>
        ))}
      </div>

      <div className="mc-analytics-hero">
        <AnalyticsKpi
          hint={t("merchant.analytics.turnoverHint")}
          label={t("merchant.analytics.turnover")}
          tone="primary"
          value={summary.turnover}
        />
        <AnalyticsKpi
          hint={t("merchant.analytics.netHint")}
          label={t("merchant.analytics.net")}
          tone="accent"
          value={summary.net}
        />
      </div>

      <div className="mc-analytics-kpis">
        <AnalyticsKpi
          hint={t("merchant.analytics.pureProfitHint")}
          label={t("merchant.analytics.pureProfit")}
          value={summary.pureProfit}
        />
        <AnalyticsKpi hint={t("merchant.analytics.feesHint")} label={t("merchant.analytics.fees")} value={summary.fee} />
        <AnalyticsKpi
          hint={t("merchant.analytics.successHint", {
            paid: summary.paidCount,
            total: summary.transactionCount,
          })}
          label={t("merchant.analytics.success")}
          value={summary.successRate}
        />
        <AnalyticsKpi
          hint={t("merchant.analytics.avgCheckHint")}
          label={t("merchant.analytics.avgCheck")}
          value={summary.averageCheck}
        />
        <AnalyticsKpi
          hint={t("merchant.analytics.transactionsHint")}
          label={t("merchant.analytics.transactions")}
          tone="muted"
          value={summary.transactionCount}
        />
        <AnalyticsKpi
          hint={t("merchant.analytics.paidHint")}
          label={t("merchant.analytics.paid")}
          tone="muted"
          value={summary.paidCount}
        />
      </div>

      <div className="mc-analytics-chart-wrap">
        <div className="mc-analytics-chart-head">
          <h3 className="mc-analytics-chart-title">{t("merchant.analytics.chartTitle")}</h3>
          <p className="mc-analytics-chart-desc">{t("merchant.analytics.chartDesc")}</p>
        </div>
        <AnalyticsSparkBars
          emptyLabel={t("merchant.analytics.chartEmpty")}
          legendNet={t("merchant.analytics.net")}
          legendTurnover={t("merchant.analytics.turnover")}
          points={chartPoints}
        />
      </div>
    </section>
  );
}

import type { AnalyticsPeriod } from "../../hooks/useClientAnalytics";
import { useTranslation } from "../../i18n";

type AnalyticsSummaryProps = {
  periodLabel: string;
  turnover: string;
  net: string;
  fee: string;
  pureProfit: string;
  successRate: string;
  averageCheck: string;
  transactionCount: number;
};

export type AnalyticsPeriodStripProps = {
  period: AnalyticsPeriod;
  onPeriodChange: (next: AnalyticsPeriod) => void;
  summary: AnalyticsSummaryProps;
};

const PERIOD_KEYS: AnalyticsPeriod[] = ["today", "7d", "30d", "90d", "all"];

export function AnalyticsPeriodStrip({
  period,
  onPeriodChange,
  summary,
}: AnalyticsPeriodStripProps) {
  const { t } = useTranslation();

  return (
    <section className="mc-analytics">
      <div className="mc-analytics-top">
        <div>
          <p className="mc-analytics-eyebrow">{t("merchant.analytics.eyebrow")}</p>
          <h2 className="mc-analytics-title">{t("merchant.analytics.title")}</h2>
        </div>
        <p className="mc-analytics-range">{summary.periodLabel}</p>
      </div>

      <div className="mc-analytics-chips" role="group" aria-label={t("merchant.analytics.periodAria")}>
        {PERIOD_KEYS.map((key) => (
          <button
            className={`segment-button ${period === key ? "segment-button-active" : ""}`}
            key={key}
            onClick={() => onPeriodChange(key)}
            type="button"
          >
            {t(`merchant.analytics.periods.${key}`)}
          </button>
        ))}
      </div>

      <div className="mc-analytics-kpis">
        <article className="mc-kpi">
          <span>{t("merchant.analytics.turnover")}</span>
          <strong>{summary.turnover}</strong>
        </article>
        <article className="mc-kpi">
          <span>{t("merchant.analytics.net")}</span>
          <strong>{summary.net}</strong>
        </article>
        <article className="mc-kpi">
          <span>{t("merchant.analytics.pureProfit")}</span>
          <strong>{summary.pureProfit}</strong>
        </article>
        <article className="mc-kpi">
          <span>{t("merchant.analytics.fees")}</span>
          <strong>{summary.fee}</strong>
        </article>
        <article className="mc-kpi">
          <span>{t("merchant.analytics.success")}</span>
          <strong>{summary.successRate}</strong>
        </article>
        <article className="mc-kpi">
          <span>{t("merchant.analytics.avgCheck")}</span>
          <strong>{summary.averageCheck}</strong>
        </article>
        <article className="mc-kpi">
          <span>{t("merchant.analytics.transactions")}</span>
          <strong>{summary.transactionCount}</strong>
        </article>
      </div>
    </section>
  );
}

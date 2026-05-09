import type { AnalyticsPeriod } from "../../hooks/useClientAnalytics";

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

type AnalyticsFiltersPanelProps = {
  period: AnalyticsPeriod;
  onPeriodChange: (next: AnalyticsPeriod) => void;
  summary: AnalyticsSummaryProps;
};

const PERIODS: Array<{ key: AnalyticsPeriod; label: string }> = [
  { key: "today", label: "Сегодня" },
  { key: "7d", label: "7 дн." },
  { key: "30d", label: "30 дн." },
  { key: "90d", label: "90 дн." },
  { key: "all", label: "Всё" },
];

export function AnalyticsFiltersPanel({
  period,
  onPeriodChange,
  summary,
}: AnalyticsFiltersPanelProps) {
  return (
    <section className="mc-analytics">
      <div className="mc-analytics-top">
        <div>
          <p className="mc-analytics-eyebrow">Аналитика</p>
          <h2 className="mc-analytics-title">Срез по периоду</h2>
        </div>
        <p className="mc-analytics-range">{summary.periodLabel}</p>
      </div>

      <div className="mc-analytics-chips" role="group" aria-label="Период">
        {PERIODS.map((item) => (
          <button
            className={`segment-button ${period === item.key ? "segment-button-active" : ""}`}
            key={item.key}
            onClick={() => onPeriodChange(item.key)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mc-analytics-kpis">
        <article className="mc-kpi">
          <span>Оборот (оплач.)</span>
          <strong>{summary.turnover}</strong>
        </article>
        <article className="mc-kpi">
          <span>К зачислению</span>
          <strong>{summary.net}</strong>
        </article>
        <article className="mc-kpi">
          <span>Чистая прибыль</span>
          <strong>{summary.pureProfit}</strong>
        </article>
        <article className="mc-kpi">
          <span>Комиссии</span>
          <strong>{summary.fee}</strong>
        </article>
        <article className="mc-kpi">
          <span>Успех</span>
          <strong>{summary.successRate}</strong>
        </article>
        <article className="mc-kpi">
          <span>Ср. чек</span>
          <strong>{summary.averageCheck}</strong>
        </article>
        <article className="mc-kpi">
          <span>Транзакций</span>
          <strong>{summary.transactionCount}</strong>
        </article>
      </div>
    </section>
  );
}

import type { AnalyticsPeriod } from "../../hooks/useClientAnalytics";

type AnalyticsSummaryProps = {
  periodLabel: string;
  turnover: string;
  net: string;
  fee: string;
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
  { key: "7d", label: "7 дней" },
  { key: "30d", label: "30 дней" },
  { key: "90d", label: "90 дней" },
  { key: "all", label: "Весь период" },
];

export function AnalyticsFiltersPanel({
  period,
  onPeriodChange,
  summary,
}: AnalyticsFiltersPanelProps) {
  return (
    <section className="analytics-toolbar">
      <div className="analytics-toolbar-head">
        <div>
          <p className="eyebrow">Аналитика</p>
          <h2>Обзор за выбранный период</h2>
        </div>
        <p className="analytics-range">{summary.periodLabel}</p>
      </div>

      <div className="analytics-periods">
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

      <div className="analytics-kpis">
        <article className="analytics-kpi-card">
          <span>Оборот</span>
          <strong>{summary.turnover}</strong>
        </article>
        <article className="analytics-kpi-card">
          <span>Чистый доход</span>
          <strong>{summary.net}</strong>
        </article>
        <article className="analytics-kpi-card">
          <span>Комиссии</span>
          <strong>{summary.fee}</strong>
        </article>
        <article className="analytics-kpi-card">
          <span>Успешность</span>
          <strong>{summary.successRate}</strong>
        </article>
        <article className="analytics-kpi-card">
          <span>Средний чек</span>
          <strong>{summary.averageCheck}</strong>
        </article>
        <article className="analytics-kpi-card">
          <span>Транзакций</span>
          <strong>{summary.transactionCount}</strong>
        </article>
      </div>
    </section>
  );
}


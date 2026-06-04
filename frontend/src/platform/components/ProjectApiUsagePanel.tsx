import { useEffect, useState } from "react";

import type { ApiUsageCategoryItem, ApiUsageResponse, ApiUsageRouteItem } from "../../api/base";
import { fetchProjectApiUsage } from "../../api/admin";

type ProjectApiUsagePanelProps = {
  token: string;
  projectId: string;
  projectName: string;
};

const PERIOD_OPTIONS = [
  { value: 1, label: "24 часа" },
  { value: 7, label: "7 дней" },
  { value: 30, label: "30 дней" },
];

export function ProjectApiUsagePanel({ token, projectId, projectName }: ProjectApiUsagePanelProps) {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<ApiUsageResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchProjectApiUsage(token, projectId, days);
        if (!cancelled) {
          setUsage(data);
        }
      } catch (err) {
        if (!cancelled) {
          setUsage(null);
          setError(err instanceof Error ? err.message : "Не удалось загрузить статистику API.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, projectId, days]);

  return (
    <article className="tenant-card">
      <div className="integration-card-head">
        <strong>{projectName}</strong>
        <span>API-трафик и rate limit</span>
      </div>
      <div className="action-row-inline" style={{ marginBottom: "1rem" }}>
        {PERIOD_OPTIONS.map((option) => (
          <button
            className={days === option.value ? "primary-button" : "ghost-button"}
            key={option.value}
            type="button"
            onClick={() => setDays(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? <p className="muted-text">Загружаем статистику…</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {!loading && usage ? (
        <div className="detail-summary pw-readonly-kv-grid">
          <div className="detail-chip">
            <span>Всего запросов</span>
            <strong>{usage.total_requests.toLocaleString("ru-RU")}</strong>
          </div>
          <div className="detail-chip">
            <span>Ошибок / 429</span>
            <strong>{usage.total_errors.toLocaleString("ru-RU")}</strong>
          </div>
          <div className="detail-chip">
            <span>Период</span>
            <strong>
              {usage.period_start} — {usage.period_end}
            </strong>
          </div>
        </div>
      ) : null}

      {!loading && usage && usage.categories.length === 0 ? (
        <p className="muted-text">За выбранный период запросов пока нет. Счётчики начинают копиться после деплоя.</p>
      ) : null}

      {!loading && usage
        ? usage.categories.map((category: ApiUsageCategoryItem) => (
            <div className="detail-section" key={category.category}>
              <h4 className="pw-subsection-title">
                {category.label}{" "}
                <span className="muted-text">
                  ({category.total.toLocaleString("ru-RU")}
                  {category.errors > 0 ? `, ошибок ${category.errors.toLocaleString("ru-RU")}` : ""})
                </span>
              </h4>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Операция</th>
                      <th>Запросов</th>
                      <th>Ошибок</th>
                    </tr>
                  </thead>
                  <tbody>
                    {category.routes.map((route: ApiUsageRouteItem) => (
                      <tr key={route.route_key}>
                        <td>
                          <strong>{route.label}</strong>
                          <div className="muted-text">{route.route_key}</div>
                        </td>
                        <td>{route.total.toLocaleString("ru-RU")}</td>
                        <td>{route.errors.toLocaleString("ru-RU")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        : null}
    </article>
  );
}

import { useEffect, useState } from "react";

import type { ApiUsageCategoryItem, ApiUsageResponse, ApiUsageRouteItem } from "../../api/base";

const PERIOD_OPTIONS = [
  { value: 1, label: "24 часа" },
  { value: 7, label: "7 дней" },
  { value: 30, label: "30 дней" },
  { value: 45, label: "45 дней" },
];

const CATEGORY_SHORT: Record<string, string> = {
  merchant_api: "Merchant API",
  public_pay: "Платёжная страница",
  provider_inbound: "Webhook Crypto-Cash",
  provider_outbound: "Вызовы Crypto-Cash",
  merchant_webhook_out: "Webhook мерчанту",
  rate_limit_blocked: "Rate limit",
};

type ApiUsagePanelProps = {
  title: string;
  subtitle?: string;
  loadUsage: (days: number) => Promise<ApiUsageResponse>;
  className?: string;
  days?: number;
  onDaysChange?: (days: number) => void;
};

export function ApiUsagePanel({
  title,
  subtitle = "Хранится 45 дней",
  loadUsage,
  className = "",
  days: controlledDays,
  onDaysChange,
}: ApiUsagePanelProps) {
  const [innerDays, setInnerDays] = useState(30);
  const days = controlledDays ?? innerDays;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<ApiUsageResponse | null>(null);
  const [showKeys, setShowKeys] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await loadUsage(days);
        if (!cancelled) setUsage(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Не удалось загрузить статистику API.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [days, loadUsage]);

  function selectDays(next: number) {
    if (onDaysChange) onDaysChange(next);
    else setInnerDays(next);
  }

  const maxCategory = usage ? Math.max(1, ...usage.categories.map((category) => category.total)) : 1;

  return (
    <article className={["au-panel", className].filter(Boolean).join(" ")} aria-busy={loading}>
      <div className={`au-body ${loading && usage ? "au-body-loading" : ""}`}>
        <header className="au-head">
          <div>
            <h3>{title}</h3>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className="au-periods" role="group" aria-label="Период статистики">
            {PERIOD_OPTIONS.map((option) => (
              <button
                aria-pressed={days === option.value}
                className={`segment-button ${days === option.value ? "segment-button-active" : ""}`}
                key={option.value}
                onClick={() => selectDays(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </header>

        {loading && !usage ? <p className="au-muted">Считаем запросы…</p> : null}
        {error ? <p className="au-error">{error}</p> : null}

        {usage ? (
          <>
            <div className="au-stats">
              <Stat label="Запросы" value={formatCount(usage.total_requests)} />
              <Stat label="Ошибки" value={formatCount(usage.total_errors)} tone={usage.total_errors > 0 ? "bad" : "ok"} />
              <Stat label="Доля ошибок" value={errorShare(usage.total_errors, usage.total_requests)} />
              <Stat label="Период" value={formatPeriod(usage.period_start, usage.period_end)} />
            </div>

            {usage.categories.length === 0 ? (
              <p className="au-muted">За этот период запросов нет.</p>
            ) : (
              <div className="au-cats">
                {usage.categories.map((category) => (
                  <CategoryBlock
                    category={category}
                    key={category.category}
                    maxTotal={maxCategory}
                    showKeys={showKeys}
                  />
                ))}
              </div>
            )}

            {usage.categories.some((category) => category.routes.length > 0) ? (
              <button className="au-keys" onClick={() => setShowKeys((current) => !current)} type="button">
                {showKeys ? "Скрыть ключи маршрутов" : "Показать ключи маршрутов"}
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  );
}

function CategoryBlock({
  category,
  maxTotal,
  showKeys,
}: {
  category: ApiUsageCategoryItem;
  maxTotal: number;
  showKeys: boolean;
}) {
  const label = CATEGORY_SHORT[category.category] ?? category.label;
  const share = Math.max(4, Math.round((category.total / maxTotal) * 100));
  const routes = [...category.routes].sort((left, right) => right.total - left.total);
  const routeMax = Math.max(1, ...routes.map((route) => route.total));

  return (
    <section className="au-cat">
      <header className="au-cat-head">
        <div>
          <h4 title={category.label}>{label}</h4>
          <div className="au-bar" aria-hidden="true">
            <span style={{ width: `${share}%` }} />
          </div>
        </div>
        <div className="au-cat-nums">
          <strong>{formatCount(category.total)}</strong>
          {category.errors > 0 ? <span className="au-err">{formatCount(category.errors)} ош.</span> : null}
        </div>
      </header>
      {routes.length > 0 ? (
        <ul className="au-routes">
          {routes.map((route) => (
            <RouteRow key={route.route_key} maxTotal={routeMax} route={route} showKey={showKeys} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function RouteRow({ route, maxTotal, showKey }: { route: ApiUsageRouteItem; maxTotal: number; showKey: boolean }) {
  const share = Math.max(3, Math.round((route.total / maxTotal) * 100));
  return (
    <li className="au-route">
      <div className="au-route-name">
        <span>{route.label}</span>
        {showKey ? <code>{route.route_key}</code> : null}
      </div>
      <span className="au-route-total">{formatCount(route.total)}</span>
      <span className={route.errors > 0 ? "au-err" : "au-zero"}>{formatCount(route.errors)}</span>
      <div className="au-bar" aria-hidden="true">
        <span style={{ width: `${share}%` }} />
      </div>
    </li>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "ok" | "bad" }) {
  return (
    <div className={`au-stat au-stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatCount(value: number): string {
  return value.toLocaleString("ru-RU");
}

function errorShare(errors: number, total: number): string {
  if (total <= 0) return "—";
  const percent = (errors / total) * 100;
  if (percent > 0 && percent < 0.1) return "< 0,1%";
  return `${percent.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`;
}

function formatPeriod(start: string, end: string): string {
  const from = formatDay(start);
  const to = formatDay(end);
  return from === to ? from : `${from} — ${to}`;
}

function formatDay(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: year === new Date().getFullYear() ? undefined : "numeric",
  }).format(new Date(year, month - 1, day));
}

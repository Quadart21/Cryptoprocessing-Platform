import { useMemo } from "react";

import type { PayoutRequestItem, ProviderEventItem, TenantItem } from "../../api";
import { formatDecimal } from "../../utils/format";
import type { AdminSection } from "../types";

type AdminOverviewSectionProps = {
  tenants: TenantItem[];
  platformPayouts: PayoutRequestItem[];
  platformEvents: ProviderEventItem[];
  loading?: boolean;
  onOpenSection: (section: AdminSection) => void;
  onApproveTenant: (tenantId: string) => void;
  onRejectTenant: (tenantId: string) => void;
  onApprovePayout: (payoutId: string) => void;
  onRejectPayout: (payoutId: string) => void;
};

const QUICK_LINKS: Array<{ section: AdminSection; label: string; hint: string }> = [
  { section: "accounting", label: "Бухгалтерия", hint: "Комиссия, оборот, балансы клиентов" },
  { section: "payouts", label: "Выплаты", hint: "Очередь заявок на вывод" },
  { section: "invoices", label: "Инвойсы", hint: "Все счета платформы" },
  { section: "transactions", label: "Транзакции", hint: "Движение средств end-to-end" },
];

function formatEventWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminOverviewSection({
  tenants,
  platformPayouts,
  platformEvents,
  loading = false,
  onOpenSection,
  onApproveTenant,
  onRejectTenant,
  onApprovePayout,
  onRejectPayout,
}: AdminOverviewSectionProps) {
  const pendingTenants = useMemo(
    () => tenants.filter((tenant) => tenant.status === "pending_review"),
    [tenants],
  );
  const pendingPayouts = useMemo(
    () => platformPayouts.filter((payout) => payout.status === "pending_review"),
    [platformPayouts],
  );
  const activeClients = useMemo(
    () => tenants.filter((tenant) => tenant.status === "approved").length,
    [tenants],
  );
  const pendingPayoutAmount = useMemo(
    () =>
      pendingPayouts.reduce((sum, payout) => {
        const amount = Number(payout.amount_requested);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    [pendingPayouts],
  );
  const recentEvents = useMemo(() => platformEvents.slice(0, 6), [platformEvents]);
  const attentionCount = pendingTenants.length + pendingPayouts.length;

  return (
    <div className="pw-overview">
      <section className="pw-overview-kpis stats-grid">
        <article className="stat-card pw-overview-kpi pw-overview-kpi--attention">
          <span>Требуют решения</span>
          <strong>{attentionCount}</strong>
          <p className="muted-text">
            {pendingTenants.length} заявок · {pendingPayouts.length} выплат
          </p>
        </article>
        <article className="stat-card pw-overview-kpi">
          <span>Активные клиенты</span>
          <strong>{activeClients}</strong>
          <p className="muted-text">из {tenants.length} в каталоге</p>
        </article>
        <article className="stat-card pw-overview-kpi">
          <span>Выплаты на проверке</span>
          <strong>{formatDecimal(pendingPayoutAmount)} USDT</strong>
          <p className="muted-text">{pendingPayouts.length} заявок</p>
        </article>
        <article className="stat-card pw-overview-kpi">
          <span>События (буфер)</span>
          <strong>{platformEvents.length}</strong>
          <p className="muted-text">webhooks и провайдер</p>
        </article>
      </section>

      <section className="pw-overview-links">
        {QUICK_LINKS.map((item) => (
          <button
            key={item.section}
            type="button"
            className="pw-overview-link-card"
            onClick={() => onOpenSection(item.section)}
          >
            <strong>{item.label}</strong>
            <span className="muted-text">{item.hint}</span>
          </button>
        ))}
      </section>

      {pendingPayouts.length > 0 ? (
        <section className="panel pw-overview-queue">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Срочно</p>
              <h2>Выплаты на проверке</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => onOpenSection("payouts")}>
              Все выплаты
            </button>
          </div>
          <div className="tenant-list">
            {pendingPayouts.slice(0, 4).map((payout) => (
              <article className="tenant-card" key={payout.id}>
                <div>
                  <strong>
                    {formatDecimal(payout.amount_requested)} {payout.currency}
                  </strong>
                  <p>{payout.tenant_name ?? payout.tenant_id}</p>
                  <p className="muted-text">{payout.destination_address}</p>
                </div>
                <div className="tenant-meta">
                  <span>{payout.created_at}</span>
                  <div className="action-row">
                    <button
                      type="button"
                      className="primary-button"
                      disabled={loading}
                      onClick={() => onApprovePayout(payout.id)}
                    >
                      Одобрить
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={loading}
                      onClick={() => onRejectPayout(payout.id)}
                    >
                      Отклонить
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {pendingTenants.length > 0 ? (
        <section className="panel pw-overview-queue">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Онбординг</p>
              <h2>Новые заявки</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => onOpenSection("requests")}>
              Все заявки
            </button>
          </div>
          <div className="tenant-list">
            {pendingTenants.slice(0, 4).map((tenant) => (
              <article className="tenant-card" key={tenant.id}>
                <div>
                  <strong>{tenant.name}</strong>
                  <p>{tenant.owner_email ?? "—"}</p>
                  <p className="muted-text">{tenant.slug}</p>
                </div>
                <div className="tenant-meta">
                  <span>{tenant.status}</span>
                  <div className="action-row">
                    <button
                      type="button"
                      className="primary-button"
                      disabled={loading}
                      onClick={() => onApproveTenant(tenant.id)}
                    >
                      Одобрить
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={loading}
                      onClick={() => onRejectTenant(tenant.id)}
                    >
                      Отклонить
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {attentionCount === 0 ? (
        <section className="panel pw-overview-clear">
          <p className="eyebrow">Статус</p>
          <h2>Всё спокойно</h2>
          <p className="muted-text">
            Нет заявок на подключение и выплат в очереди. Детальная бухгалтерия — в разделе
            «Бухгалтерия».
          </p>
        </section>
      ) : null}

      {recentEvents.length > 0 ? (
        <section className="panel pw-overview-events">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Лента</p>
              <h2>Последние события</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => onOpenSection("events")}>
              Все события
            </button>
          </div>
          <ul className="pw-overview-event-list">
            {recentEvents.map((event) => (
              <li key={event.id}>
                <span className="pw-overview-event-type">{event.event_type}</span>
                <span className="muted-text">{formatEventWhen(event.created_at)}</span>
                <p>
                  {event.invoice_id ? `Invoice ${event.invoice_id}` : event.status}
                  {event.source ? ` · ${event.source}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

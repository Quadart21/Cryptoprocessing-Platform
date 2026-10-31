import type { AccountingSummary, InvoiceItem, PayoutRequestItem, ProjectItem, TenantDetailResponse } from "../../../api";
import { formatDecimal } from "../../../utils/format";
import { invoiceCompactPillClass, invoiceStatusLabelRu } from "../../../utils/invoiceStatus";
import { StatusPill } from "./fields";
import {
  checkoutLabel,
  formatWhen,
  projectStatusLabel,
  projectStatusTone,
  ruNoun,
  userStatusLabel,
  tenantStatusTone,
} from "./model";

type ClientCardOverviewProps = {
  accounting: AccountingSummary | null;
  detail: TenantDetailResponse;
  invoices: InvoiceItem[];
  loading: boolean;
  payouts: PayoutRequestItem[];
  onOpenInvoice: (invoiceId: string) => void;
  onOpenInvoices: () => void;
  onOpenPayouts: () => void;
  onOpenProjects: () => void;
  onResetPassword: () => void;
  onResetTwoFactor: () => void;
};

export function ClientCardOverview({
  accounting,
  detail,
  invoices,
  loading,
  payouts,
  onOpenInvoice,
  onOpenInvoices,
  onOpenPayouts,
  onOpenProjects,
  onResetPassword,
  onResetTwoFactor,
}: ClientCardOverviewProps) {
  const pendingPayouts = payouts.filter((payout) => payout.status === "pending_review");
  const recentInvoices = invoices.slice(0, 6);
  const projects = detail.projects ?? [];

  return (
    <div className="cc-stack">
      {pendingPayouts.length > 0 ? (
        <div className="cc-banner cc-banner-wait">
          <p>
            {ruNoun(
              pendingPayouts.length,
              "заявка на вывод ждёт решения.",
              "заявки на вывод ждут решения.",
              "заявок на вывод ждут решения.",
            )}
          </p>
          <button className="ghost-button" onClick={onOpenPayouts} type="button">
            Открыть выводы
          </button>
        </div>
      ) : null}

      <div className="cc-grid-2">
        <section className="cc-card">
          <h3>Владелец</h3>
          <dl className="cc-dl">
            <dt>Имя</dt>
            <dd>{detail.owner?.full_name?.trim() || "—"}</dd>
            <dt>Email</dt>
            <dd className="cc-break">{detail.owner?.email || "—"}</dd>
            <dt>Статус</dt>
            <dd>
              <StatusPill tone={tenantStatusTone(detail.owner?.status ?? "")}>
                {userStatusLabel(detail.owner?.status ?? "")}
              </StatusPill>
            </dd>
          </dl>
          <div className="cc-actions">
            <button className="primary-button" disabled={loading} onClick={onResetPassword} type="button">
              Сбросить пароль
            </button>
            <button className="ghost-button" disabled={loading} onClick={onResetTwoFactor} type="button">
              Сбросить 2FA
            </button>
          </div>
          <p className="cc-hint">Новый пароль появится в уведомлении. Текущий перестанет работать сразу.</p>
        </section>

        <section className="cc-card">
          <h3>Учёт</h3>
          {accounting ? (
            <dl className="cc-dl">
              <dt>Счета</dt>
              <dd>
                {accounting.invoices_total_count} всего · {accounting.invoices_paid_count} оплачено ·{" "}
                {accounting.invoices_confirmed_count} подтверждено
              </dd>
              <dt>Неуспешные</dt>
              <dd>
                {accounting.invoices_failed_count} с ошибкой · {accounting.invoices_expired_count} истекли
              </dd>
              <dt>Оборот</dt>
              <dd>{formatDecimal(accounting.gross_amount)}</dd>
              <dt>Комиссия провайдера</dt>
              <dd>{formatDecimal(accounting.provider_fee_amount)}</dd>
              <dt>Комиссия платформы</dt>
              <dd>{formatDecimal(accounting.platform_fee_amount)}</dd>
              <dt>Комиссия с оборота</dt>
              <dd>{formatDecimal(accounting.turnover_fee_amount)}</dd>
              <dt>К выплате клиенту</dt>
              <dd>{formatDecimal(accounting.net_amount)}</dd>
            </dl>
          ) : (
            <p className="cc-hint">Учётные суммы ещё не загружены.</p>
          )}
        </section>
      </div>

      <section className="cc-block">
        <div className="cc-section-head">
          <h3>Последние инвойсы</h3>
          <button className="ghost-button" onClick={onOpenInvoices} type="button">
            Все инвойсы
          </button>
        </div>
        {recentInvoices.length === 0 ? (
          <p className="cc-empty">Инвойсов пока нет.</p>
        ) : (
          <div className="cc-list">
            {recentInvoices.map((invoice) => (
              <button
                className="cc-row"
                key={invoice.id}
                onClick={() => onOpenInvoice(invoice.id)}
                type="button"
              >
                <span className="cc-row-title">{invoice.merchant_order_id}</span>
                <span className={invoiceCompactPillClass(invoice.status)}>{invoiceStatusLabelRu(invoice.status)}</span>
                <span className="cc-row-sub">
                  {formatDecimal(invoice.amount_fiat)} {invoice.fiat_currency} · {invoice.network} ·{" "}
                  {formatWhen(invoice.created_at)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="cc-block">
        <div className="cc-section-head">
          <h3>Проекты</h3>
          <button className="ghost-button" onClick={onOpenProjects} type="button">
            Управление
          </button>
        </div>
        {projects.length === 0 ? (
          <p className="cc-empty">Проектов пока нет.</p>
        ) : (
          <div className="cc-list">
            {projects.slice(0, 5).map((project) => (
              <ProjectSnapshot key={project.id} onOpen={onOpenProjects} project={project} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProjectSnapshot({ project, onOpen }: { project: ProjectItem; onOpen: () => void }) {
  return (
    <button className="cc-row" onClick={onOpen} type="button">
      <span className="cc-row-title">{project.name}</span>
      <StatusPill tone={projectStatusTone(project.status)}>{projectStatusLabel(project.status)}</StatusPill>
      <span className="cc-row-sub">
        {project.domain || "домен не задан"} · {checkoutLabel(project.checkout_delivery)}
        {project.webhook_url ? " · webhook" : ""}
      </span>
    </button>
  );
}

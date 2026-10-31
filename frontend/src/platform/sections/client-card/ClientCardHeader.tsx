import type { AccountingSummary, TenantDetailResponse } from "../../../api";
import { CopyableIdentifier } from "../../../components/CopyableIdentifier";
import { formatDecimal } from "../../../utils/format";
import { StatusPill } from "./fields";
import { moneyPair, planLabel, tenantStatusLabel, tenantStatusTone } from "./model";

type ClientCardHeaderProps = {
  detail: TenantDetailResponse;
  accounting: AccountingSummary | null;
  fallbackName: string;
  onBack: () => void;
};

export function ClientCardHeader({ detail, accounting, fallbackName, onBack }: ClientCardHeaderProps) {
  const tenant = detail.tenant;
  const name = tenant.name?.trim() || fallbackName || "Клиент";
  const comment = tenant.review_comment?.trim() ?? "";

  return (
    <header className="cc-hero">
      <div className="cc-hero-top">
        <button className="cc-back" onClick={onBack} type="button">
          ← К списку клиентов
        </button>
      </div>
      <div className="cc-hero-grid">
        <div className="cc-hero-main">
          <p className="eyebrow">Карточка клиента</p>
          <div className="cc-title-row">
            <h2 className="cc-title">{name}</h2>
            <StatusPill tone={tenantStatusTone(tenant.status)}>{tenantStatusLabel(tenant.status)}</StatusPill>
          </div>
          <div className="cc-meta">
            <span className="cc-chip cc-mono">{tenant.slug || "без slug"}</span>
            <span className="cc-chip">{planLabel(tenant.plan)}</span>
            <span className="cc-chip">{tenant.base_currency || "—"}</span>
            <span className="cc-chip">{tenant.timezone || "UTC"}</span>
            {detail.owner?.email ? <span className="cc-chip">{detail.owner.email}</span> : null}
          </div>
          {comment ? (
            <p className="cc-note" title={comment}>
              {comment}
            </p>
          ) : null}
        </div>
        <CopyableIdentifier
          hint="UUID тенанта. В API и webhook это tenant_id."
          label="Merchant ID"
          value={tenant.id}
          variant="block"
        />
      </div>
      <ClientCardStats accounting={accounting} detail={detail} />
    </header>
  );
}

function ClientCardStats({
  accounting,
  detail,
}: {
  accounting: AccountingSummary | null;
  detail: TenantDetailResponse;
}) {
  const net = accounting ? moneyPair(accounting.net_amount, accounting.total_platform_revenue_amount) : null;
  return (
    <div className="cc-stats" aria-label="Ключевые суммы">
      <Stat label="Оплачено" value={accounting ? formatDecimal(accounting.invoices_paid_amount) : "—"} />
      <Stat label="Подтверждено" value={accounting ? formatDecimal(accounting.invoices_confirmed_amount) : "—"} />
      <Stat label="Чистая прибыль" value={net === null ? "—" : formatDecimal(net)} />
      <Stat
        label="Выручка платформы"
        value={accounting ? formatDecimal(accounting.total_platform_revenue_amount) : "—"}
      />
      <Stat label="Средний чек" value={accounting ? formatDecimal(accounting.average_invoice_amount) : "—"} />
      <Stat label="Инвойсы" value={String(detail.invoices_count)} />
      <Stat label="Активные проекты" value={String(detail.approved_projects_count)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="cc-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

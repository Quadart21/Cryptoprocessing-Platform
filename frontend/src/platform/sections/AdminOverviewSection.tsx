import { formatDecimal } from "../../utils/format";
import type {
  AccountingSummary,
  CurrentUser,
  InvoiceItem,
  ProviderEventItem,
  TenantItem,
  TransactionItem,
} from "../../api";
import {
  PlatformEventsPanel,
  PlatformInvoicesPanel,
  PlatformTransactionsPanel,
} from "./AdminPlatformPanels";

type AdminOverviewSectionProps = {
  user: CurrentUser;
  tenants: TenantItem[];
  platformAccounting: AccountingSummary | null;
  platformInvoices: InvoiceItem[];
  platformTransactions: TransactionItem[];
  platformEvents: ProviderEventItem[];
  onSyncInvoice?: (invoiceId: string) => void;
};

export function AdminOverviewSection({
  user,
  tenants,
  platformAccounting,
  platformInvoices,
  platformTransactions,
  platformEvents,
  onSyncInvoice,
}: AdminOverviewSectionProps) {
  return (
    <>
      <section className="stats-grid">
        <article className="stat-card">
          <span>Роль</span>
          <strong>{user.role}</strong>
        </article>
        <article className="stat-card">
          <span>Статус</span>
          <strong>{user.status}</strong>
        </article>
        <article className="stat-card">
          <span>Количество клиентов</span>
          <strong>{tenants.length}</strong>
        </article>
        <article className="stat-card">
          <span>Инвойсов всего</span>
          <strong>{platformAccounting?.invoices_total_count ?? 0}</strong>
        </article>
      </section>

      {platformAccounting ? (
        <section className="stats-grid">
          <article className="stat-card">
            <span>Оборот по инвойсам</span>
            <strong>{formatDecimal(platformAccounting.invoices_total_amount)}</strong>
          </article>
          <article className="stat-card">
            <span>Подтверждено</span>
            <strong>{formatDecimal(platformAccounting.invoices_confirmed_amount)}</strong>
          </article>
          <article className="stat-card">
            <span>Комиссия платформы</span>
            <strong>{formatDecimal(platformAccounting.total_platform_revenue_amount)}</strong>
          </article>
          <article className="stat-card">
            <span>Net amount</span>
            <strong>{formatDecimal(platformAccounting.net_amount)}</strong>
          </article>
        </section>
      ) : null}

      <section className="dashboard-grid client-grid">
        <PlatformInvoicesPanel invoices={platformInvoices} onSyncInvoice={onSyncInvoice} />
        <PlatformTransactionsPanel transactions={platformTransactions} />
        <PlatformEventsPanel className="panel panel-span-2" events={platformEvents} />
      </section>
    </>
  );
}

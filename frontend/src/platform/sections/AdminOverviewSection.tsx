import { formatDecimal } from "../../utils/format";
import type { AccountingSummary, InvoiceItem, TransactionItem } from "../../api";
import { PlatformInvoicesPanel, PlatformTransactionsPanel } from "./AdminPlatformPanels";

type AdminOverviewSectionProps = {
  platformAccounting: AccountingSummary | null;
  platformInvoices: InvoiceItem[];
  platformTransactions: TransactionItem[];
  onSyncInvoice?: (invoiceId: string) => void;
};

export function AdminOverviewSection({
  platformAccounting,
  platformInvoices,
  platformTransactions,
  onSyncInvoice,
}: AdminOverviewSectionProps) {
  return (
    <>
      {platformAccounting ? (
        <section className="stats-grid">
          <article className="stat-card">
            <span>Оборот (оплаченные инвойсы)</span>
            <strong>{formatDecimal(platformAccounting.invoices_paid_amount)}</strong>
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
      </section>
    </>
  );
}

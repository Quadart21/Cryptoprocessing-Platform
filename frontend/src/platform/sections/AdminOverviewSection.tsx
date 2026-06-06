import type {
  InvoiceItem,
  PlatformAccountingOverview,
  PlatformEarningsWithdrawalPayload,
  TransactionItem,
} from "../../api";
import { PlatformInvoicesPanel, PlatformTransactionsPanel } from "./AdminPlatformPanels";
import { PlatformAccountingPanel } from "./PlatformAccountingPanel";

type AdminOverviewSectionProps = {
  platformAccountingOverview: PlatformAccountingOverview | null;
  platformInvoices: InvoiceItem[];
  platformTransactions: TransactionItem[];
  isSuperadmin?: boolean;
  loading?: boolean;
  onRecordPlatformWithdrawal?: (
    payload: PlatformEarningsWithdrawalPayload,
  ) => Promise<void>;
  onSyncInvoice?: (invoiceId: string) => void;
};

export function AdminOverviewSection({
  platformAccountingOverview,
  platformInvoices,
  platformTransactions,
  isSuperadmin = false,
  loading = false,
  onRecordPlatformWithdrawal,
  onSyncInvoice,
}: AdminOverviewSectionProps) {
  return (
    <>
      {platformAccountingOverview ? (
        <PlatformAccountingPanel
          overview={platformAccountingOverview}
          isSuperadmin={isSuperadmin}
          loading={loading}
          onRecordPlatformWithdrawal={onRecordPlatformWithdrawal}
        />
      ) : (
        <section className="panel aps-empty-state">
          <p className="muted-text">Загружаем бухгалтерию платформы…</p>
        </section>
      )}

      <section className="dashboard-grid client-grid">
        <PlatformInvoicesPanel invoices={platformInvoices} onSyncInvoice={onSyncInvoice} />
        <PlatformTransactionsPanel transactions={platformTransactions} />
      </section>
    </>
  );
}

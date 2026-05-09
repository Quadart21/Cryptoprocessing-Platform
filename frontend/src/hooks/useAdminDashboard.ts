import type {
  AccountingSummary,
  InvoiceItem,
  ProviderEventItem,
  TenantItem,
  TransactionItem,
} from "../api";
import { formatDecimal } from "../utils/format";

type UseAdminDashboardParams = {
  tenants: TenantItem[];
  platformInvoices: InvoiceItem[];
  platformTransactions: TransactionItem[];
  platformEvents: ProviderEventItem[];
  platformAccounting: AccountingSummary | null;
};

export function useAdminDashboard({
  tenants,
  platformInvoices,
  platformTransactions,
  platformEvents,
  platformAccounting,
}: UseAdminDashboardParams) {
  const heroRows = [
    { label: "Tenants", value: String(tenants.length) },
    { label: "Инвойсы", value: String(platformInvoices.length) },
    { label: "Транзакции", value: String(platformTransactions.length) },
    { label: "События", value: String(platformEvents.length) },
  ];

  return {
    heroRows,
    heroPrimaryValue: formatDecimal(platformAccounting?.invoices_paid_amount),
    heroSecondaryValue: formatDecimal(platformAccounting?.net_amount),
  };
}

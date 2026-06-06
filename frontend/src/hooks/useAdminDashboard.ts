import type { PlatformAccountingOverview, ProviderEventItem, TenantItem } from "../api";
import { formatDecimal } from "../utils/format";

type UseAdminDashboardParams = {
  tenants: TenantItem[];
  platformEvents: ProviderEventItem[];
  platformAccountingOverview: PlatformAccountingOverview | null;
};

export function useAdminDashboard({
  tenants,
  platformEvents,
  platformAccountingOverview,
}: UseAdminDashboardParams) {
  const currency = platformAccountingOverview?.currency ?? "USDT";

  const heroRows = [
    { label: "Клиентов", value: String(tenants.length) },
    { label: "События", value: String(platformEvents.length) },
  ];

  return {
    heroRows,
    heroPrimaryValue: platformAccountingOverview
      ? `${formatDecimal(platformAccountingOverview.platform_earnings_outstanding)} ${currency}`
      : "—",
    heroPrimaryLabel: "Ваша комиссия (остаток)",
    heroSecondaryValue: platformAccountingOverview
      ? `${formatDecimal(platformAccountingOverview.merchant_balances.on_accounts)} ${currency}`
      : "—",
    heroSecondaryLabel: "На счетах мерчантов",
  };
}

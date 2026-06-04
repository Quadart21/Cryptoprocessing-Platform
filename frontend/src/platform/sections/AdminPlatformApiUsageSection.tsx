import { useCallback } from "react";

import { fetchPlatformApiUsage } from "../../api/admin";
import { ApiUsagePanel } from "../components/ApiUsagePanel";

type AdminPlatformApiUsageSectionProps = {
  adminToken: string | null;
};

export function AdminPlatformApiUsageSection({ adminToken }: AdminPlatformApiUsageSectionProps) {
  const loadUsage = useCallback(
    (days: number) => {
      if (!adminToken) {
        return Promise.reject(new Error("Нет сессии администратора."));
      }
      return fetchPlatformApiUsage(adminToken, days);
    },
    [adminToken],
  );

  if (!adminToken) {
    return <p className="muted-text">Нет сессии администратора для загрузки статистики.</p>;
  }

  return (
    <section className="dashboard-grid client-grid">
      <ApiUsagePanel
        className="panel panel-span-2"
        loadUsage={loadUsage}
        subtitle="Вся платформа: Merchant API, pay-страница, Crypto-Cash, webhook мерчантам, rate limit"
        title="Системный трафик"
      />
    </section>
  );
}

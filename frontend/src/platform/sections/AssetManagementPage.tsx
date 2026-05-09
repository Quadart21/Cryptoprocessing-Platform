import { useMemo, useState } from "react";

import type { AssetAvailabilityPayload, RateItem } from "../../api";
import { AssetAvailabilityCompact } from "./AssetAvailabilityCompact";

type AssetManagementPageProps = {
  loading: boolean;
  adminAssetRates: RateItem[];
  onUpdateAssetAvailability: (payload: AssetAvailabilityPayload) => void;
};

export function AssetManagementPage({
  loading,
  adminAssetRates,
  onUpdateAssetAvailability,
}: AssetManagementPageProps) {
  const [search, setSearch] = useState("");

  const stats = useMemo(() => {
    let total = 0;
    let enabled = 0;
    for (const rate of adminAssetRates) {
      for (const network of rate.networks) {
        total++;
        if (network.platform_enabled) enabled++;
      }
    }
    return { total, enabled, disabled: total - enabled };
  }, [adminAssetRates]);

  const filteredRates = useMemo(() => {
    if (!search.trim()) return adminAssetRates;
    const q = search.trim().toLowerCase();
    return adminAssetRates.filter(
      (rate) =>
        rate.currency.toLowerCase().includes(q) ||
        rate.networks.some((n) => n.network.toLowerCase().includes(q)),
    );
  }, [adminAssetRates, search]);

  return (
    <div className="pw-assets-page">
      <p className="muted-text pw-assets-intro">
        Включение и отключение сетей на уровне платформы влияет на доступность в кабинетах клиентов.
        Используйте поиск, чтобы быстро найти валюту или сеть в длинном списке.
      </p>

      <section className="stats-grid pw-console-stats">
        <article className="stat-card">
          <span>Всего сетей</span>
          <strong>{stats.total}</strong>
        </article>
        <article className="stat-card">
          <span>Включено</span>
          <strong className="text-success">{stats.enabled}</strong>
        </article>
        <article className="stat-card">
          <span>Отключено</span>
          <strong className="text-muted">{stats.disabled}</strong>
        </article>
      </section>

      <div className="pw-assets-search-field">
        <span>Поиск по валюте или сети</span>
        <div className="pw-assets-search">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path
              d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="search"
            placeholder="Например USDT или TRC20…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      <AssetAvailabilityCompact
        loading={loading}
        rates={filteredRates}
        onUpdateAssetAvailability={onUpdateAssetAvailability}
      />
    </div>
  );
}

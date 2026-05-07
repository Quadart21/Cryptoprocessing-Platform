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
    <div className="asset-management-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Управление</p>
          <h1>Токены и сети</h1>
          <p className="page-description">
            Управляйте доступностью криптовалют и сетей для ваших клиентов
          </p>
        </div>
      </header>

      <section className="stats-grid">
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

      <div className="asset-search-bar">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <input
          type="text"
          placeholder="Поиск по валюте или сети..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <AssetAvailabilityCompact
        loading={loading}
        rates={filteredRates}
        onUpdateAssetAvailability={onUpdateAssetAvailability}
      />
    </div>
  );
}

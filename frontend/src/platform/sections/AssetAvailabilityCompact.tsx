import { useMemo, useState } from "react";

import type { AssetAvailabilityPayload, RateItem, RateNetworkItem } from "../../api";
import { mapAvailabilityReason } from "./assetAvailabilityLabels";

type AssetAvailabilityCompactProps = {
  rates: RateItem[];
  loading: boolean;
  onUpdateAssetAvailability: (payload: AssetAvailabilityPayload) => void;
};

export function AssetAvailabilityCompact({
  rates,
  loading,
  onUpdateAssetAvailability,
}: AssetAvailabilityCompactProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<string>("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const currencies = useMemo(() => {
    const unique = new Set<string>();
    for (const rate of rates) {
      unique.add(rate.currency);
    }
    return ["all", ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [rates]);

  const groups = useMemo(() => {
    const selected = selectedCurrency.toUpperCase();
    const result: Array<{ currency: string; networks: RateNetworkItem[] }> = [];

    for (const rate of rates) {
      if (selected !== "ALL" && rate.currency.toUpperCase() !== selected) {
        continue;
      }
      result.push({
        currency: rate.currency,
        networks: rate.networks.sort((left, right) => left.network.localeCompare(right.network)),
      });
    }

    return result.sort((left, right) => left.currency.localeCompare(right.currency));
  }, [rates, selectedCurrency]);

  const toggleGroup = (currency: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(currency)) {
        next.delete(currency);
      } else {
        next.add(currency);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (expandedGroups.size === groups.length && groups.length > 0) {
      setExpandedGroups(new Set());
    } else {
      setExpandedGroups(new Set(groups.map((g) => g.currency)));
    }
  };

  return (
    <section className="pw-assets-panel" aria-label="Список валют и сетей">
      <div className="pw-assets-panel-cap">
        <div>
          <h2>Сети по валютам</h2>
          <p>
            Разворачивайте валюту и переключайте доступность сети. Показаны провайдер, причина статуса и
            видимость для клиентов.
          </p>
        </div>
        <button className="ghost-button" onClick={toggleAll} type="button">
          {expandedGroups.size === groups.length && groups.length > 0 ? "Свернуть все" : "Развернуть все"}
        </button>
      </div>

      <div className="pw-assets-toolbar">
        <label>
          <span>Фильтр по валюте</span>
          <select value={selectedCurrency} onChange={(event) => setSelectedCurrency(event.target.value)}>
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency === "all" ? "Все валюты" : currency}
              </option>
            ))}
          </select>
        </label>
      </div>

      {groups.length === 0 ? (
        <p className="muted-text" style={{ margin: "1rem 1.15rem 1.25rem" }}>
          Нет данных по выбранному фильтру или поиску.
        </p>
      ) : (
        <div className="pw-assets-list">
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.currency);
            const enabledCount = group.networks.filter((n) => n.platform_enabled).length;
            const totalCount = group.networks.length;

            return (
              <div className="pw-assets-group" key={group.currency}>
                <button
                  className="pw-assets-group-head"
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => toggleGroup(group.currency)}
                >
                  <div className="pw-assets-group-meta">
                    <strong>{group.currency}</strong>
                    <span>
                      {enabledCount} из {totalCount} сетей включено на платформе
                    </span>
                  </div>
                  <span className={`pw-assets-chevron ${isExpanded ? "is-open" : ""}`} aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M6 9L12 15L18 9"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>

                {isExpanded ? (
                  <div className="pw-assets-networks">
                    {group.networks.map((network) => (
                      <div
                        className="pw-assets-network-card"
                        key={`${group.currency}-${network.network}`}
                      >
                        <div className="pw-assets-network-title">
                          <strong>{network.network}</strong>
                          {network.ticker ? (
                            <span className="pw-assets-network-ticker">Тикер: {network.ticker}</span>
                          ) : null}
                          <p className="pw-assets-network-reason">
                            Причина: {mapAvailabilityReason(network.availability_reason)}
                          </p>
                        </div>
                        <div className="pw-assets-badges">
                          <span
                            className={`pw-assets-badge pw-assets-badge--provider ${
                              network.provider_availability ? "pw-assets-badge--ok" : "pw-assets-badge--off"
                            }`}
                          >
                            Провайдер: {network.provider_availability ? "on" : "off"}
                          </span>
                          <span
                            className={`pw-assets-badge ${network.platform_enabled ? "pw-assets-badge--ok" : "pw-assets-badge--off"}`}
                          >
                            Платформа: {network.platform_enabled ? "вкл" : "выкл"}
                          </span>
                          <span
                            className={`pw-assets-badge ${network.client_available ? "pw-assets-badge--ok" : "pw-assets-badge--off"}`}
                          >
                            Клиентам: {network.client_available ? "да" : "скрыто"}
                          </span>
                        </div>
                        <div className="pw-assets-network-actions">
                          <button
                            className={network.platform_enabled ? "ghost-button" : "primary-button"}
                            disabled={loading}
                            onClick={() =>
                              onUpdateAssetAvailability({
                                currency: group.currency,
                                network: network.network,
                                platform_enabled: !network.platform_enabled,
                              })
                            }
                            type="button"
                          >
                            {network.platform_enabled ? "Отключить" : "Включить"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

import { useMemo, useState } from "react";

import type { AssetAvailabilityPayload, RateItem, RateNetworkItem } from "../../api";

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
        networks: rate.networks.sort((left, right) =>
          left.network.localeCompare(right.network),
        ),
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
    if (expandedGroups.size === groups.length) {
      setExpandedGroups(new Set());
    } else {
      setExpandedGroups(new Set(groups.map((g) => g.currency)));
    }
  };

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Токены и сети</p>
          <h2>Управление активами</h2>
        </div>
        <button className="ghost-button" onClick={toggleAll} type="button">
          {expandedGroups.size === groups.length ? "Свернуть все" : "Развернуть все"}
        </button>
      </div>

      <div className="asset-compact-toolbar">
        <label>
          <span>Валюта</span>
          <select value={selectedCurrency} onChange={(event) => setSelectedCurrency(event.target.value)}>
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency === "all" ? "Все" : currency}
              </option>
            ))}
          </select>
        </label>
      </div>

      {groups.length === 0 ? (
        <p className="muted-text">Нет данных</p>
      ) : (
        <div className="asset-compact-list">
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.currency);
            const enabledCount = group.networks.filter((n) => n.platform_enabled).length;
            const totalCount = group.networks.length;

            return (
              <div className="asset-compact-group" key={group.currency}>
                <button
                  className="asset-compact-group-header"
                  onClick={() => toggleGroup(group.currency)}
                  type="button"
                >
                  <div className="asset-compact-group-info">
                    <strong>{group.currency}</strong>
                    <span>
                      {enabledCount}/{totalCount} включено
                    </span>
                  </div>
                  <span className={`asset-compact-chevron ${isExpanded ? "expanded" : ""}`}>
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                </button>

                {isExpanded && (
                  <div className="asset-compact-networks">
                    {group.networks.map((network) => (
                      <div className="asset-compact-network" key={`${group.currency}-${network.network}`}>
                        <div className="asset-compact-network-info">
                          <strong>{network.network}</strong>
                          {network.ticker && <span>{network.ticker}</span>}
                        </div>
                        <div className="asset-compact-badges">
                          <span className={`badge ${network.platform_enabled ? "badge-success" : "badge-muted"}`}>
                            {network.platform_enabled ? "Вкл" : "Выкл"}
                          </span>
                          <span className={`badge ${network.client_available ? "badge-success" : "badge-muted"}`}>
                            {network.client_available ? "Доступно" : "Скрыто"}
                          </span>
                        </div>
                        <button
                          className={`asset-compact-toggle ${network.platform_enabled ? "ghost-button" : "primary-button"}`}
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
                          {network.platform_enabled ? "Откл" : "Вкл"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
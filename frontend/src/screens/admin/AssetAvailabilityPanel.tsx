import { useMemo, useState } from "react";

import type { AssetAvailabilityPayload, RateItem, RateNetworkItem } from "../../api";

type AssetAvailabilityPanelProps = {
  rates: RateItem[];
  loading: boolean;
  onUpdateAssetAvailability: (payload: AssetAvailabilityPayload) => void;
};

type AssetGroup = {
  currency: string;
  networks: RateNetworkItem[];
};

export function AssetAvailabilityPanel({
  rates,
  loading,
  onUpdateAssetAvailability,
}: AssetAvailabilityPanelProps) {
  const [selectedCurrency, setSelectedCurrency] = useState("all");
  const [search, setSearch] = useState("");

  const currencies = useMemo(() => {
    const unique = new Set<string>();
    for (const rate of rates) {
      unique.add(rate.currency);
    }
    return ["all", ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [rates]);

  const groups = useMemo(() => {
    const normalizedSearch = search.trim().toUpperCase();
    const selected = selectedCurrency.toUpperCase();

    const result: AssetGroup[] = [];
    for (const rate of rates) {
      if (selected !== "ALL" && rate.currency.toUpperCase() !== selected) {
        continue;
      }
      const filteredNetworks = rate.networks.filter((network) => {
        if (!normalizedSearch) {
          return true;
        }
        const target = `${network.network} ${network.ticker ?? ""}`.toUpperCase();
        return target.includes(normalizedSearch);
      });
      if (filteredNetworks.length > 0) {
        result.push({
          currency: rate.currency,
          networks: filteredNetworks.sort((left, right) =>
            left.network.localeCompare(right.network),
          ),
        });
      }
    }

    return result.sort((left, right) => left.currency.localeCompare(right.currency));
  }, [rates, search, selectedCurrency]);

  return (
    <article className="panel panel-span-2">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Доступные активы</p>
          <h2>Токены и сети для клиентов</h2>
        </div>
      </div>

      <div className="asset-toolbar">
        <label>
          <span>Валюта</span>
          <select value={selectedCurrency} onChange={(event) => setSelectedCurrency(event.target.value)}>
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency === "all" ? "Все валюты" : currency}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Поиск сети / тикера</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Например: TRC20"
            value={search}
          />
        </label>
      </div>

      {groups.length === 0 ? (
        <p className="muted-text">Нет данных по токенам и сетям.</p>
      ) : (
        <div className="asset-groups-grid">
          {groups.map((group) => (
            <section className="asset-group-card" key={group.currency}>
              <header className="asset-group-head">
                <strong>{group.currency}</strong>
                <span>{group.networks.length} сетей</span>
              </header>
              <div className="asset-network-list">
                {group.networks.map((network) => (
                  <div className="asset-network-row" key={`${group.currency}-${network.network}`}>
                    <div className="asset-network-main">
                      <strong>{network.network}</strong>
                      <span>Ticker: {network.ticker ?? "—"}</span>
                    </div>
                    <div className="asset-badges">
                      <span className="asset-badge">
                        Провайдер: {network.provider_availability ? "on" : "off"}
                      </span>
                      <span className="asset-badge">
                        Платформа: {network.platform_enabled ? "on" : "off"}
                      </span>
                      <span className="asset-badge">
                        Клиентам: {network.client_available ? "доступно" : "скрыто"}
                      </span>
                      <span className="asset-badge">
                        Причина: {mapAvailabilityReason(network.availability_reason)}
                      </span>
                    </div>
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
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </article>
  );
}

function mapAvailabilityReason(reason: string | null): string {
  if (!reason) {
    return "не указана";
  }
  if (reason === "available") {
    return "доступно";
  }
  if (reason === "disabled_by_platform") {
    return "отключено платформой";
  }
  if (reason === "disabled_by_provider") {
    return "отключено провайдером";
  }
  if (reason === "acquiring_off") {
    return "приём отключён у провайдера";
  }
  return reason;
}

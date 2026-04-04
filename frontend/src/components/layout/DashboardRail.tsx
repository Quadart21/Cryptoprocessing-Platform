export type DashboardRailItem = {
  key: string;
  label: string;
  disabled?: boolean;
};

export type DashboardRailGroup = {
  key: string;
  label: string;
  items: DashboardRailItem[];
};

type DashboardRailProps = {
  role: "client" | "admin";
  items?: DashboardRailItem[];
  groups?: DashboardRailGroup[];
  activeKey?: string;
  onSelect?: (key: string) => void;
};

const DEFAULT_ADMIN_GROUPS: DashboardRailGroup[] = [
  {
    key: "monitoring",
    label: "Мониторинг",
    items: [
      { key: "overview", label: "Обзор" },
      { key: "invoices", label: "Инвойсы" },
      { key: "transactions", label: "Транзакции" },
      { key: "events", label: "События" },
    ],
  },
  {
    key: "clients",
    label: "Клиенты",
    items: [
      { key: "requests", label: "Заявки" },
      { key: "clients", label: "Список" },
    ],
  },
  {
    key: "management",
    label: "Управление",
    items: [
      { key: "platform-settings", label: "Настройки" },
      { key: "team", label: "Команда" },
      { key: "security", label: "Безопасность" },
    ],
  },
];

const DEFAULT_CLIENT_GROUPS: DashboardRailGroup[] = [
  {
    key: "overview",
    label: "Обзор",
    items: [
      { key: "overview", label: "Сводка" },
      { key: "transactions", label: "Операции" },
      { key: "balance", label: "Баланс" },
    ],
  },
  {
    key: "integration",
    label: "Интеграция",
    items: [
      { key: "docs", label: "API" },
      { key: "projects", label: "Проекты" },
      { key: "keys", label: "Ключи" },
      { key: "invoices", label: "Инвойсы" },
    ],
  },
  {
    key: "security",
    label: "Безопасность",
    items: [{ key: "security", label: "Доступ" }],
  },
];

function buildMobilePrimaryItems(groups: DashboardRailGroup[]): DashboardRailItem[] {
  const allItems = groups.flatMap((group) => group.items);
  const uniqueItems: DashboardRailItem[] = [];
  for (const item of allItems) {
    if (!uniqueItems.some((candidate) => candidate.key === item.key)) {
      uniqueItems.push(item);
    }
  }
  return uniqueItems.slice(0, 4);
}

function findActiveGroupLabel(groups: DashboardRailGroup[], activeKey: string): string {
  const group = groups.find((entry) => entry.items.some((item) => item.key === activeKey));
  return group?.label ?? groups[0]?.label ?? "Разделы";
}

export function DashboardRail({
  role,
  items,
  groups,
  activeKey,
  onSelect,
}: DashboardRailProps) {
  const railGroups =
    groups ??
    (items
      ? [
          {
            key: "all",
            label: "Разделы",
            items,
          },
        ]
      : role === "admin"
        ? DEFAULT_ADMIN_GROUPS
        : DEFAULT_CLIENT_GROUPS);

  const fallbackActiveKey = railGroups[0]?.items[0]?.key ?? "";
  const resolvedActiveKey = activeKey ?? fallbackActiveKey;
  const mobilePrimaryItems = buildMobilePrimaryItems(railGroups);

  return (
    <>
      <aside className="dashboard-rail" aria-label="Навигация">
        <div className="dashboard-rail-brand">
          <span className="dashboard-rail-logo" aria-hidden="true" />
          <div className="dashboard-rail-brand-text">
            <strong>{role === "admin" ? "Noren Admin" : "Noren Merchant"}</strong>
            <span>{findActiveGroupLabel(railGroups, resolvedActiveKey)}</span>
          </div>
        </div>

        <div className="dashboard-rail-groups">
          {railGroups.map((group) => (
            <section className="dashboard-rail-group" key={group.key}>
              <p className="dashboard-rail-group-label">{group.label}</p>
              <div className="dashboard-rail-stack">
                {group.items.map((item) => {
                  const isActive = resolvedActiveKey === item.key;
                  const className = `dashboard-rail-item ${isActive ? "dashboard-rail-item-active" : ""}`;

                  if (!onSelect) {
                    return (
                      <div className={className} key={item.key}>
                        <span className="dashboard-rail-label">{item.label}</span>
                      </div>
                    );
                  }

                  return (
                    <button
                      className={className}
                      disabled={item.disabled}
                      key={item.key}
                      onClick={() => onSelect(item.key)}
                      type="button"
                    >
                      <span className="dashboard-rail-label">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <details className="dashboard-rail-mobile-sheet">
          <summary className="dashboard-rail-mobile-trigger">Все разделы</summary>
          <div className="dashboard-rail-mobile-sheet-content">
            {railGroups.map((group) => (
              <section className="dashboard-rail-group" key={`mobile-${group.key}`}>
                <p className="dashboard-rail-group-label">{group.label}</p>
                <div className="dashboard-rail-stack">
                  {group.items.map((item) => {
                    const isActive = resolvedActiveKey === item.key;
                    const className = `dashboard-rail-item ${isActive ? "dashboard-rail-item-active" : ""}`;

                    if (!onSelect) {
                      return (
                        <div className={className} key={`sheet-${item.key}`}>
                          <span className="dashboard-rail-label">{item.label}</span>
                        </div>
                      );
                    }

                    return (
                      <button
                        className={className}
                        disabled={item.disabled}
                        key={`sheet-${item.key}`}
                        onClick={() => onSelect(item.key)}
                        type="button"
                      >
                        <span className="dashboard-rail-label">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </details>
      </aside>

      <nav className="dashboard-mobile-nav" aria-label="Быстрое меню">
        {mobilePrimaryItems.map((item) => {
          const isActive = resolvedActiveKey === item.key;
          return (
            <button
              className={`dashboard-mobile-nav-item ${isActive ? "dashboard-mobile-nav-item-active" : ""}`}
              disabled={item.disabled || !onSelect}
              key={`mobile-tab-${item.key}`}
              onClick={() => onSelect?.(item.key)}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}

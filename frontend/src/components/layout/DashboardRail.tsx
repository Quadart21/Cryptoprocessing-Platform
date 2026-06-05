import type { CurrentUser } from "../../api";
import { TopbarUser } from "./TopbarUser";
import { DashboardDockIcon } from "./DashboardDockIcon";

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
  /** full — все пункты в доке; hubs — только группы (для админки). */
  navVariant?: "full" | "hubs";
  activeKey?: string;
  topbarSubtitle?: string;
  onSelect?: (key: string) => void;
  user?: CurrentUser;
  onLogout?: () => void;
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
      { key: "public-pages", label: "Страницы" },
      { key: "team", label: "Команда" },
      { key: "security", label: "Безопасность" },
    ],
  },
];

const DEFAULT_CLIENT_GROUPS: DashboardRailGroup[] = [
  {
    key: "overview",
    label: "Главная",
    items: [{ key: "overview", label: "Сводка" }],
  },
  {
    key: "finance",
    label: "Финансы",
    items: [
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

function findActiveGroupLabel(groups: DashboardRailGroup[], activeKey: string): string {
  const group = groups.find((entry) => entry.items.some((item) => item.key === activeKey));
  return group?.label ?? groups[0]?.label ?? "Разделы";
}

export function DashboardRail({
  role,
  items,
  groups,
  navVariant = "full",
  activeKey,
  topbarSubtitle,
  onSelect,
  user,
  onLogout,
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

  const handleSelect = (key: string) => {
    onSelect?.(key);
  };

  const hubMode = navVariant === "hubs" && railGroups.length > 0;

  return (
    <>
      <nav
        aria-label="Навигация по разделам"
        className={`dashboard-dock ${hubMode ? "dashboard-dock-hubs" : ""}`}
      >
        <div className="dashboard-dock-surface">
          <div className="dashboard-dock-scroll">
            <div className="dashboard-dock-track">
              {hubMode
                ? railGroups.map((group) => {
                    const isActive = group.items.some((item) => item.key === resolvedActiveKey);
                    const className = `dashboard-dock-item dashboard-dock-hub ${isActive ? "dashboard-dock-item-active" : ""}`;

                    if (!onSelect) {
                      return (
                        <div className={className} key={group.key}>
                          <span aria-hidden className="dashboard-dock-icon">
                            <DashboardDockIcon itemKey={group.key} />
                          </span>
                          <span className="dashboard-dock-label">{group.label}</span>
                        </div>
                      );
                    }

                    return (
                      <button
                        aria-current={isActive ? "page" : undefined}
                        className={className}
                        key={group.key}
                        onClick={() => handleSelect(group.key)}
                        title={group.label}
                        type="button"
                      >
                        <span aria-hidden className="dashboard-dock-icon">
                          <DashboardDockIcon itemKey={group.key} />
                        </span>
                        <span className="dashboard-dock-label">{group.label}</span>
                      </button>
                    );
                  })
                : railGroups.map((group) => (
                <div className="dashboard-dock-cluster" key={group.key}>
                  <span className="dashboard-dock-cluster-label">{group.label}</span>
                  <div className="dashboard-dock-cluster-items">
                    {group.items.map((item) => {
                      const isActive = resolvedActiveKey === item.key;
                      const className = `dashboard-dock-item ${isActive ? "dashboard-dock-item-active" : ""}`;

                      if (!onSelect) {
                        return (
                          <div className={className} key={item.key}>
                            <span className="dashboard-dock-icon" aria-hidden>
                              <DashboardDockIcon itemKey={item.key} />
                            </span>
                            <span className="dashboard-dock-label">{item.label}</span>
                          </div>
                        );
                      }

                      return (
                        <button
                          className={className}
                          disabled={item.disabled}
                          key={item.key}
                          onClick={() => handleSelect(item.key)}
                          type="button"
                          title={item.label}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <span className="dashboard-dock-icon" aria-hidden>
                            <DashboardDockIcon itemKey={item.key} />
                          </span>
                          <span className="dashboard-dock-label">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <header className="dashboard-topbar">
        <div className="topbar-left">
          <div className="topbar-title">
            <span className="topbar-role">{role === "admin" ? "Админ-панель" : "Кабинет клиента"}</span>
            <span className="topbar-section">
              {topbarSubtitle ?? findActiveGroupLabel(railGroups, resolvedActiveKey)}
            </span>
          </div>
        </div>
        <div className="topbar-right">
          {user && onLogout ? <TopbarUser user={user} onLogout={onLogout} /> : null}
        </div>
      </header>
    </>
  );
}

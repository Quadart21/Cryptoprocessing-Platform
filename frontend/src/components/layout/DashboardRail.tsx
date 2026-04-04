import { useState, useEffect } from "react";
import type { CurrentUser } from "../../api";
import { TopbarUser } from "./TopbarUser";

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
    items: [
      { key: "overview", label: "Сводка" },
    ],
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
  activeKey,
  onSelect,
  user,
  onLogout,
}: DashboardRailProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 960) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

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
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <aside className="dashboard-rail" aria-label="Навигация">
        <div className="dashboard-rail-header">
          <div className="dashboard-rail-brand">
            <div className="dashboard-rail-logo">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="dashboard-rail-brand-text">
              <strong>{role === "admin" ? "Admin" : "Merchant"}</strong>
              <span>CryptoProcessing</span>
            </div>
          </div>
        </div>

        <div className="dashboard-rail-content">
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
                      onClick={() => handleSelect(item.key)}
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
      </aside>

      <header className="dashboard-topbar">
        <div className="topbar-left">
          <button 
            className="mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? "Закрыть меню" : "Открыть меню"}
          >
            <span className={`hamburger ${isMobileMenuOpen ? 'hamburger-active' : ''}`}>
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
          <div className="topbar-title">
            <span className="topbar-role">{role === "admin" ? "Админ-панель" : "Кабинет клиента"}</span>
            <span className="topbar-section">{findActiveGroupLabel(railGroups, resolvedActiveKey)}</span>
          </div>
        </div>
        <div className="topbar-right">
          {user && onLogout && <TopbarUser user={user} onLogout={onLogout} />}
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setIsMobileMenuOpen(false)}>
          <nav className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <div className="mobile-menu-brand">
                <div className="mobile-menu-logo">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="mobile-menu-brand-text">
                  <strong>{role === "admin" ? "Admin Panel" : "Merchant Cabinet"}</strong>
                  <span>CryptoProcessing Platform</span>
                </div>
              </div>
              <button 
                className="mobile-menu-close"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Закрыть меню"
              >
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            
            <div className="mobile-menu-content">
              {railGroups.map((group) => (
                <section className="mobile-menu-group" key={group.key}>
                  <p className="mobile-menu-group-label">{group.label}</p>
                  <div className="mobile-menu-stack">
                    {group.items.map((item) => {
                      const isActive = resolvedActiveKey === item.key;
                      return (
                        <button
                          className={`mobile-menu-item ${isActive ? "mobile-menu-item-active" : ""}`}
                          disabled={item.disabled}
                          key={item.key}
                          onClick={() => handleSelect(item.key)}
                          type="button"
                        >
                          <span className="mobile-menu-item-label">{item.label}</span>
                          {isActive && (
                            <span className="mobile-menu-item-indicator"></span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
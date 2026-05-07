import type { AdminSection } from "../types";

type AdminSectionTabsProps = {
  section: AdminSection;
  selectedTenantId: string | null;
  onSectionChange: (section: AdminSection) => void;
};

const TOP_NAV_ITEMS: Array<{
  section: AdminSection;
  label: string;
  requiresTenant?: boolean;
}> = [
  { section: "overview", label: "Обзор платформы" },
  { section: "requests", label: "Заявки" },
  { section: "clients", label: "Клиенты" },
  { section: "client-detail", label: "Карточка клиента", requiresTenant: true },
  { section: "invoices", label: "Инвойсы" },
  { section: "transactions", label: "Транзакции" },
  { section: "events", label: "События" },
  { section: "platform-settings", label: "Настройки платформы" },
  { section: "team", label: "Команда" },
  { section: "security", label: "Безопасность" },
];

export function AdminSectionTabs({
  section,
  selectedTenantId,
  onSectionChange,
}: AdminSectionTabsProps) {
  return (
    <section className="admin-nav">
      {TOP_NAV_ITEMS.map((item) => (
        <button
          className={`admin-nav-button ${section === item.section ? "admin-nav-button-active" : ""}`}
          disabled={item.requiresTenant ? !selectedTenantId : false}
          key={item.section}
          onClick={() => onSectionChange(item.section)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </section>
  );
}

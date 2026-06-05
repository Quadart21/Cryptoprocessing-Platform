import type { DashboardRailGroup } from "../../components/layout/DashboardRail";

import type { AdminSection } from "../types";

type AdminSectionSubNavProps = {
  section: AdminSection;
  groups: DashboardRailGroup[];
  onSectionChange: (section: AdminSection) => void;
};

export function AdminSectionSubNav({
  section,
  groups,
  onSectionChange,
}: AdminSectionSubNavProps) {
  const activeGroup =
    groups.find((group) => group.items.some((item) => item.key === section)) ?? groups[0];

  if (!activeGroup || activeGroup.items.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Подразделы" className="admin-section-subnav">
      <div className="admin-section-subnav-scroll">
        {activeGroup.items.map((item) => {
          const isActive = section === item.key;
          return (
            <button
              aria-current={isActive ? "page" : undefined}
              className={`admin-nav-button admin-section-subnav-item ${isActive ? "admin-nav-button-active" : ""}`}
              disabled={item.disabled}
              key={item.key}
              onClick={() => onSectionChange(item.key as AdminSection)}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

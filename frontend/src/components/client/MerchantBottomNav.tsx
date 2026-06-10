import type { ReactElement } from "react";

import { useTranslation } from "../../i18n";

export type MerchantBottomNavKey = "overview" | "transactions" | "balance" | "invoices" | "docs";

type MerchantBottomNavProps = {
  activeKey: string;
  onSelect: (key: MerchantBottomNavKey) => void;
  /** Подсказка: открыт раздел только из полного меню (проекты, ключи, безопасность). */
  suggestFullMenu?: boolean;
};

const NAV_LABEL_KEYS: Record<MerchantBottomNavKey, string> = {
  overview: "merchant.bottomNav.summary",
  transactions: "merchant.bottomNav.transactions",
  balance: "merchant.bottomNav.balance",
  invoices: "merchant.bottomNav.invoices",
  docs: "merchant.bottomNav.docs",
};

const ITEMS: Array<{
  key: MerchantBottomNavKey;
  icon: ReactElement;
}> = [
  {
    key: "overview",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "transactions",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "balance",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M4 7a2 2 0 0 1 2-2h11a3 3 0 0 1 3 3v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" strokeLinejoin="round" />
        <path d="M8 11h4M8 15h8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "invoices",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M9 3h7l4 4v13a1 1 0 0 1-1 1H9m0-18v18m0-18H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h3" strokeLinejoin="round" />
        <path d="M9 8h6M9 12h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "docs",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" strokeLinejoin="round" />
        <path d="M10 8l-2 2 2 2M14 16l2-2-2-2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function openFullNavigationMenu() {
  window.dispatchEvent(new Event("merchant-open-nav"));
}

export function MerchantBottomNav({ activeKey, onSelect, suggestFullMenu }: MerchantBottomNavProps) {
  const { t } = useTranslation();

  return (
    <nav className="merchant-bottom-nav" aria-label={t("merchant.bottomNav.quickNavAria")}>
      {ITEMS.map((item) => {
        const isActive = activeKey === item.key;
        return (
          <button
            className={`merchant-bottom-nav-item ${isActive ? "merchant-bottom-nav-item-active" : ""}`}
            key={item.key}
            onClick={() => onSelect(item.key)}
            type="button"
            aria-current={isActive ? "page" : undefined}
          >
            <span className="merchant-bottom-nav-icon">{item.icon}</span>
            <span className="merchant-bottom-nav-label">{t(NAV_LABEL_KEYS[item.key])}</span>
          </button>
        );
      })}
      <button
        className={`merchant-bottom-nav-item ${suggestFullMenu ? "merchant-bottom-nav-item-hint" : ""}`}
        onClick={openFullNavigationMenu}
        type="button"
        aria-label={t("merchant.bottomNav.openFullMenuAria")}
        title={suggestFullMenu ? t("merchant.bottomNav.moreMenuHint") : undefined}
      >
        <span className="merchant-bottom-nav-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <span className="merchant-bottom-nav-label">{t("merchant.bottomNav.more")}</span>
      </button>
    </nav>
  );
}

import type { ReactNode } from "react";

const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Mark({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24">
      {children}
    </svg>
  );
}

/** Значки нижнего дока. Один набор для админки, кабинета и партнёра. */
export function DashboardDockIcon({ itemKey }: { itemKey: string }) {
  switch (itemKey.toLowerCase()) {
    case "monitoring":
      return (
        <Mark>
          <circle cx="12" cy="12" r="8" {...line} />
          <circle cx="12" cy="12" r="3" {...line} />
          <circle cx="12" cy="12" r="1.35" fill="currentColor" />
          <path d="M12 12 17.4 7.2" {...line} />
        </Mark>
      );
    case "clients":
    case "merchants":
      return (
        <Mark>
          <circle cx="12" cy="8" r="3" fill="currentColor" />
          <path d="M6.2 19.4c.7-3.4 3-5.1 5.8-5.1s5.1 1.7 5.8 5.1" {...line} />
        </Mark>
      );
    case "management":
      return (
        <Mark>
          <path d="M4 7h16M4 12h16M4 17h16" {...line} />
          <circle cx="9" cy="7" r="2.15" fill="currentColor" />
          <circle cx="15" cy="12" r="2.15" fill="currentColor" />
          <circle cx="8.5" cy="17" r="2.15" fill="currentColor" />
        </Mark>
      );
    case "overview":
      return (
        <Mark>
          <rect x="4" y="4" width="6.6" height="6.6" rx="1.8" fill="currentColor" />
          <rect x="13.4" y="4" width="6.6" height="6.6" rx="1.8" {...line} />
          <rect x="4" y="13.4" width="6.6" height="6.6" rx="1.8" {...line} />
          <rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.8" fill="currentColor" opacity="0.45" />
        </Mark>
      );
    case "transactions":
      return (
        <Mark>
          <path d="M7 8h11M15 5.2 18 8l-3 2.8" {...line} />
          <path d="M17 16H6M9 13.2 6 16l3 2.8" {...line} />
        </Mark>
      );
    case "balance":
    case "accounting":
      return (
        <Mark>
          <ellipse cx="12" cy="7" rx="7" ry="2.7" {...line} />
          <path d="M5 7v4.6c0 1.5 3.1 2.7 7 2.7s7-1.2 7-2.7V7" {...line} />
          <path d="M5 11.6V16.4c0 1.5 3.1 2.7 7 2.7s7-1.2 7-2.7v-4.8" {...line} />
        </Mark>
      );
    case "docs":
      return (
        <Mark>
          <path d="M9 5c-2.1 0-3.2 1.2-3.2 3.1v1.8c0 .9-.6 1.5-1.6 1.7 1 .2 1.6.8 1.6 1.7v1.6C5.8 17.8 6.9 19 9 19" {...line} />
          <path d="M15 5c2.1 0 3.2 1.2 3.2 3.1v1.8c0 .9.6 1.5 1.6 1.7-1 .2-1.6.8-1.6 1.7v1.6c0 1.9-1.1 3.1-3.2 3.1" {...line} />
        </Mark>
      );
    case "projects":
      return (
        <Mark>
          <path d="m12 4-8.4 4.4L12 12.8l8.4-4.4L12 4Z" fill="currentColor" opacity="0.35" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="m3.6 12 8.4 4.4 8.4-4.4" {...line} />
          <path d="m3.6 15.6 8.4 4.4 8.4-4.4" {...line} />
        </Mark>
      );
    case "keys":
      return (
        <Mark>
          <circle cx="8.2" cy="12" r="3.1" {...line} />
          <path d="M11.1 12H20l-1.5 2.1M16.4 12l1.4 2" {...line} />
        </Mark>
      );
    case "invoices":
      return (
        <Mark>
          <path d="M7 3.6h10v16.6l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3V3.6Z" {...line} />
          <path d="M9.6 8h4.8M9.6 11.4h4.8" {...line} />
        </Mark>
      );
    case "security":
      return (
        <Mark>
          <rect x="6" y="10.2" width="12" height="8.6" rx="2" {...line} />
          <path d="M8.6 10.2V8.1a3.4 3.4 0 0 1 6.8 0v2.1" {...line} />
          <circle cx="12" cy="14.4" r="1.15" fill="currentColor" />
        </Mark>
      );
    case "events":
      return (
        <Mark>
          <path d="M6.4 16.4h11.2l-1.2-2V10a4.4 4.4 0 0 0-8.8 0v4.4l-1.2 2Z" {...line} />
          <path d="M10 16.4a2 2 0 0 0 4 0" {...line} />
        </Mark>
      );
    case "requests":
      return (
        <Mark>
          <path d="M4 13.2h4.1l1.3 1.9h5.2l1.3-1.9H20v5.2a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 18.4v-5.2Z" fill="currentColor" opacity="0.28" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M4 13.2V6.6A1.4 1.4 0 0 1 5.4 5.2h13.2A1.4 1.4 0 0 1 20 6.6v6.6" {...line} />
        </Mark>
      );
    case "payouts":
      return (
        <Mark>
          <rect x="3.6" y="7" width="11.2" height="11" rx="2" {...line} />
          <path d="M13.4 5.2H20M16.8 2.6 20 5.2l-3.2 2.6" {...line} />
        </Mark>
      );
    case "platform-settings":
      return (
        <Mark>
          <circle cx="12" cy="12" r="7" {...line} />
          <path d="M12 12 15.6 9" {...line} />
          <circle cx="12" cy="12" r="1.45" fill="currentColor" />
        </Mark>
      );
    case "public-pages":
      return (
        <Mark>
          <rect x="3.5" y="5" width="17" height="14" rx="2" {...line} />
          <path d="M3.5 9h17" {...line} />
          <circle cx="6.4" cy="7" r="0.7" fill="currentColor" />
        </Mark>
      );
    case "assets":
      return (
        <Mark>
          <path d="M12 3.4 20 12l-8 8.6L4 12 12 3.4Z" {...line} />
          <path d="M8.2 12h7.6" {...line} />
        </Mark>
      );
    case "team":
      return (
        <Mark>
          <circle cx="8" cy="9" r="2.15" fill="currentColor" />
          <circle cx="16.2" cy="9" r="2.15" {...line} />
          <path d="M3.8 18c.5-2.3 2.1-3.5 4.2-3.5s3.7 1.2 4.2 3.5" {...line} />
          <path d="M12.4 18c.4-1.7 1.6-2.7 3.4-2.7 1.7 0 2.9.9 3.5 2.7" {...line} />
        </Mark>
      );
    case "api-traffic":
      return (
        <Mark>
          <circle cx="6" cy="12" r="2.15" fill="currentColor" />
          <circle cx="18" cy="7" r="2.15" {...line} />
          <circle cx="18" cy="17" r="2.15" {...line} />
          <path d="M8.1 11.2 16 8.1M8.1 12.8 16 15.9" {...line} />
        </Mark>
      );
    case "client-detail":
    case "profile":
      return (
        <Mark>
          <rect x="4" y="5" width="16" height="14" rx="2.4" {...line} />
          <circle cx="9" cy="11" r="1.9" fill="currentColor" />
          <path d="M13 10h4.2M13 13h3" {...line} />
        </Mark>
      );
    case "referral":
      return (
        <Mark>
          <path d="M10.2 13.6 8.4 15.4a2.9 2.9 0 0 1-4.1-4.1L6.2 9.4" {...line} />
          <path d="M13.8 10.4 15.6 8.6a2.9 2.9 0 0 1 4.1 4.1L17.8 14.6" {...line} />
          <path d="M9.2 14.8 14.8 9.2" {...line} />
        </Mark>
      );
    case "commissions":
      return (
        <Mark>
          <circle cx="12" cy="12" r="8" {...line} />
          <path d="M9 15.2 15 9" {...line} />
          <circle cx="9.2" cy="9.2" r="1.05" fill="currentColor" />
          <circle cx="14.8" cy="14.8" r="1.05" fill="currentColor" />
        </Mark>
      );
    case "backups":
      return (
        <Mark>
          <ellipse cx="12" cy="7" rx="6.5" ry="2.4" {...line} />
          <path d="M5.5 7v5c0 1.3 2.9 2.4 6.5 2.4s6.5-1.1 6.5-2.4V7" {...line} />
          <path d="M5.5 12v5c0 1.3 2.9 2.4 6.5 2.4s6.5-1.1 6.5-2.4v-5" {...line} />
        </Mark>
      );
    case "partners":
      return (
        <Mark>
          <circle cx="8" cy="10" r="2.3" fill="currentColor" />
          <circle cx="16" cy="10" r="2.3" {...line} />
          <path d="M5.2 17.6c.4-2 1.8-3 3.2-3 .8 0 1.5.2 2.1.7" {...line} />
          <path d="M13.5 15.3c.6-.5 1.3-.7 2.1-.7 1.4 0 2.8 1 3.2 3" {...line} />
        </Mark>
      );
    default:
      return (
        <Mark>
          <circle cx="12" cy="12" r="7" {...line} />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </Mark>
      );
  }
}

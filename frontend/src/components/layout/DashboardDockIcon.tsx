/** Иконки пунктов дока (компактные SVG, stroke). */

export function DashboardDockIcon({ itemKey }: { itemKey: string }) {
  const k = itemKey.toLowerCase();
  const common = { viewBox: "0 0 24 24" as const, fill: "none" as const, stroke: "currentColor", strokeWidth: 1.65 };

  switch (k) {
    case "overview":
      return (
        <svg {...common} aria-hidden>
          <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" strokeLinejoin="round" />
        </svg>
      );
    case "invoices":
      return (
        <svg {...common} aria-hidden>
          <path d="M9 3h7l4 4v13a1 1 0 0 1-1 1H9m0-18v18m0-18H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h3" strokeLinejoin="round" />
          <path d="M9 8h6M9 12h6" strokeLinecap="round" />
        </svg>
      );
    case "transactions":
      return (
        <svg {...common} aria-hidden>
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
        </svg>
      );
    case "events":
      return (
        <svg {...common} aria-hidden>
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" strokeLinejoin="round" />
        </svg>
      );
    case "payouts":
      return (
        <svg {...common} aria-hidden>
          <path d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "requests":
      return (
        <svg {...common} aria-hidden>
          <path d="M21 15a4 4 0 0 1-4 4H8l-4 3v-7a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4Z" strokeLinejoin="round" />
          <path d="M7 8.5a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4" strokeLinecap="round" />
        </svg>
      );
    case "clients":
      return (
        <svg {...common} aria-hidden>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" strokeLinecap="round" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
        </svg>
      );
    case "client-detail":
      return (
        <svg {...common} aria-hidden>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" />
          <path d="M18 2.09a4 4 0 0 1 0 7.82" strokeLinecap="round" />
        </svg>
      );
    case "platform-settings":
      return (
        <svg {...common} aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
        </svg>
      );
    case "public-pages":
      return (
        <svg {...common} aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" strokeLinejoin="round" />
          <path d="M14 2v6h6M10 13h8M10 17h8" strokeLinecap="round" />
        </svg>
      );
    case "assets":
      return (
        <svg {...common} aria-hidden>
          <circle cx="8" cy="8" r="3" />
          <circle cx="16" cy="16" r="3" />
          <path d="m8.5 13.5 7-7" strokeLinecap="round" />
        </svg>
      );
    case "team":
      return (
        <svg {...common} aria-hidden>
          <path d="M18 21a4 4 0 0 0 4-4v-2a4 4 0 0 0-4-4M14 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0ZM2 21a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "security":
      return (
        <svg {...common} aria-hidden>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" strokeLinejoin="round" />
        </svg>
      );
    case "docs":
      return (
        <svg {...common} aria-hidden>
          <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" strokeLinejoin="round" />
          <path d="M10 8h4M10 12h4" strokeLinecap="round" />
        </svg>
      );
    case "projects":
      return (
        <svg {...common} aria-hidden>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11Z" strokeLinejoin="round" />
        </svg>
      );
    case "keys":
      return (
        <svg {...common} aria-hidden>
          <path d="M21 2l-2 2m0 0 3 3L13 16l-4 1 1-4 9-9ZM7.5 13.5l2 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "balance":
      return (
        <svg {...common} aria-hidden>
          <path d="M4 7a2 2 0 0 1 2-2h11a3 3 0 0 1 3 3v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" strokeLinejoin="round" />
          <path d="M8 11h4M8 15h8" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...common} aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" strokeLinecap="round" />
        </svg>
      );
  }
}

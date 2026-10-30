import type { DocsSectionKey } from "../types/docsSection";

export type { DocsSectionKey };

export type DocsNavItemKey =
  | "overview"
  | "quickstart"
  | "checkout"
  | "webhooks"
  | "integrations"
  | "reference"
  | "commissions"
  | "faq";

export type DocsSidebarGroupKey = "gettingStarted" | "integration" | "reference";

export type DocsNavItemStruct = {
  to: string;
  key: DocsNavItemKey;
  icon: string;
};

export const DOCS_SIDEBAR_STRUCTURE: Array<{
  groupKey: DocsSidebarGroupKey;
  items: DocsNavItemStruct[];
}> = [
  {
    groupKey: "gettingStarted",
    items: [
      { to: "/", key: "overview", icon: "◆" },
      { to: "/quickstart", key: "quickstart", icon: "→" },
    ],
  },
  {
    groupKey: "integration",
    items: [
      { to: "/checkout", key: "checkout", icon: "◈" },
      { to: "/webhooks", key: "webhooks", icon: "⇄" },
      { to: "/integrations", key: "integrations", icon: "⬡" },
    ],
  },
  {
    groupKey: "reference",
    items: [
      { to: "/reference", key: "reference", icon: "⚡" },
      { to: "/commissions", key: "commissions", icon: "%" },
      { to: "/faq", key: "faq", icon: "?" },
    ],
  },
];

export const DOCS_GUIDE_ORDER: DocsSectionKey[] = [
  "quickstart",
  "checkout",
  "webhooks",
  "integrations",
  "reference",
  "commissions",
  "faq",
];

export const DOCS_PIPELINE_KEYS = ["keys", "rates", "invoice", "webhook"] as const;

export const DOCS_HUB_CARD_KEYS = [
  "quickstart",
  "checkout",
  "reference",
  "webhooks",
  "integrations",
  "commissions",
  "faq",
] as const;

export const DOCS_HUB_CARD_ROUTES: Record<(typeof DOCS_HUB_CARD_KEYS)[number], string> = {
  quickstart: "/quickstart",
  checkout: "/checkout",
  reference: "/reference",
  webhooks: "/webhooks",
  integrations: "/integrations",
  commissions: "/commissions",
  faq: "/faq",
};

/** Legacy hash on /merchant-api → new route */
export const DOCS_LEGACY_HASH_REDIRECTS: Record<string, string> = {
  "#docs-start": "/quickstart",
  "#docs-auth": "/quickstart",
  "#docs-checkout-delivery": "/checkout",
  "#docs-webhooks": "/webhooks",
  "#docs-integrations": "/integrations",
  "#docs-commissions": "/commissions",
  "#docs-faq": "/faq",
  "#docs-endpoints-table": "/reference",
  "#docs-reference": "/reference",
  "#docs-cabinet": "/reference",
};

export const DOCS_API_ENDPOINT_KEYS = [
  { href: "#endpoint-health", key: "health", method: "GET" },
  { href: "#endpoint-login", key: "login", method: "POST" },
  { href: "#endpoint-create-invoice", key: "createInvoice", method: "POST" },
  { href: "#endpoint-list-invoices", key: "listInvoices", method: "GET" },
  { href: "#endpoint-get-invoice", key: "getInvoice", method: "GET" },
  { href: "#endpoint-sync-invoice", key: "syncInvoice", method: "POST" },
  { href: "#endpoint-rates", key: "rates", method: "GET" },
  { href: "#endpoint-balance", key: "balance", method: "GET" },
  { href: "#endpoint-transactions", key: "transactions", method: "GET" },
  { href: "#endpoint-transaction", key: "transaction", method: "GET" },
] as const;

export type DocsNavItem = {
  to: string;
  label: string;
  description: string;
  icon: string;
};

import type { DocsSectionKey } from "../types/docsSection";

export type { DocsSectionKey };

export type DocsPageMeta = {
  eyebrow: string;
  title: string;
  lead: string;
};

export const DOCS_PAGE_META: Record<DocsSectionKey, DocsPageMeta> = {
  quickstart: {
    eyebrow: "Getting started",
    title: "Quick start",
    lead: "Keys, your first invoice, and authentication — the minimum steps to a test payment.",
  },
  checkout: {
    eyebrow: "Payments",
    title: "Checkout: hosted page or H2H",
    lead: "How to deliver /pay/{token} or address/QR to the customer — depends on the project checkout_delivery setting.",
  },
  webhooks: {
    eyebrow: "Events",
    title: "Webhooks",
    lead: "HMAC signature, payload format, and test delivery.",
  },
  integrations: {
    eyebrow: "CMS",
    title: "CMS modules",
    lead: "Ready-made plugins for WordPress, DLE, Tilda, and 1C — download, install, connect webhook.",
  },
  commissions: {
    eyebrow: "Pricing",
    title: "Commissions",
    lead: "0.4% per payment, $0.70 minimum — formula and examples.",
  },
  reference: {
    eyebrow: "Reference",
    title: "API Reference",
    lead: "All merchant endpoints: table and curl/JSON examples.",
  },
  faq: {
    eyebrow: "Help",
    title: "FAQ",
    lead: "Keys, errors, checkout, and common integration questions.",
  },
};

export const DOCS_SIDEBAR_GROUPS: Array<{ label: string; items: DocsNavItem[] }> = [
  {
    label: "Getting started",
    items: [
      {
        to: "/",
        label: "Overview",
        description: "Documentation map",
        icon: "◆",
      },
      {
        to: "/quickstart",
        label: "Quick start",
        description: "7 steps to your first invoice",
        icon: "→",
      },
    ],
  },
  {
    label: "Integration",
    items: [
      {
        to: "/checkout",
        label: "Checkout",
        description: "Payment page / H2H",
        icon: "◈",
      },
      {
        to: "/webhooks",
        label: "Webhooks",
        description: "Signature and payload",
        icon: "⇄",
      },
      {
        to: "/integrations",
        label: "CMS modules",
        description: "WordPress, DLE, Tilda, 1C",
        icon: "⬡",
      },
    ],
  },
  {
    label: "Reference",
    items: [
      {
        to: "/reference",
        label: "API methods",
        description: "Endpoint reference",
        icon: "⚡",
      },
      {
        to: "/commissions",
        label: "Commissions",
        description: "0.4% · min $0.70",
        icon: "%",
      },
      {
        to: "/faq",
        label: "FAQ",
        description: "Answers to common questions",
        icon: "?",
      },
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

export const DOCS_PIPELINE = [
  { step: "01", title: "Keys", text: "Public + Secret on your backend" },
  { step: "02", title: "Rates", text: "Network and limits" },
  { step: "03", title: "Invoice", text: "POST /invoices" },
  { step: "04", title: "Webhook", text: "Payment confirmation" },
] as const;

export const DOCS_HUB_CARDS: Array<{
  to: string;
  title: string;
  body: string;
  icon: string;
}> = [
  {
    to: "/quickstart",
    title: "Quick start",
    body: "Keys → rates → invoice → webhook.",
    icon: "01",
  },
  {
    to: "/checkout",
    title: "Checkout",
    body: "Hosted /pay/{token} or H2H payment details.",
    icon: "02",
  },
  {
    to: "/reference",
    title: "API methods",
    body: "Endpoint table and examples.",
    icon: "03",
  },
  {
    to: "/webhooks",
    title: "Webhooks",
    body: "HMAC, event_id, test delivery.",
    icon: "04",
  },
  {
    to: "/integrations",
    title: "CMS modules",
    body: "WordPress, DLE, Tilda, 1C downloads.",
    icon: "05",
  },
  {
    to: "/commissions",
    title: "Commissions",
    body: "0.4%, $0.70 minimum.",
    icon: "06",
  },
  {
    to: "/faq",
    title: "FAQ",
    body: "Keys, errors, sandbox.",
    icon: "07",
  },
];

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

export const DOCS_API_ENDPOINTS = [
  { href: "#endpoint-health", label: "Health", method: "GET" },
  { href: "#endpoint-login", label: "Auth login", method: "POST" },
  { href: "#endpoint-create-invoice", label: "Create invoice", method: "POST" },
  { href: "#endpoint-list-invoices", label: "List invoices", method: "GET" },
  { href: "#endpoint-get-invoice", label: "Get invoice", method: "GET" },
  { href: "#endpoint-sync-invoice", label: "Sync invoice", method: "POST" },
  { href: "#endpoint-rates", label: "Rates", method: "GET" },
  { href: "#endpoint-balance", label: "Balance", method: "GET" },
  { href: "#endpoint-transactions", label: "Transactions", method: "GET" },
  { href: "#endpoint-transaction", label: "Transaction", method: "GET" },
] as const;

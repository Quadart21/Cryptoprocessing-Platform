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
    eyebrow: "Начало",
    title: "Быстрый старт",
    lead: "Ключи, первый инвойс и авторизация — минимум шагов до тестового платежа.",
  },
  checkout: {
    eyebrow: "Оплата",
    title: "Checkout: страница или H2H",
    lead: "Как отдавать клиенту ссылку /pay/{token} или адрес/QR — зависит от checkout_delivery проекта.",
  },
  webhooks: {
    eyebrow: "События",
    title: "Webhooks",
    lead: "Подпись HMAC, формат payload и тестовая доставка.",
  },
  commissions: {
    eyebrow: "Тариф",
    title: "Комиссии",
    lead: "0,4% от платежа, минимум $0,70 — формула и примеры.",
  },
  reference: {
    eyebrow: "Справочник",
    title: "API Reference",
    lead: "Все merchant-методы: таблица и примеры curl/JSON.",
  },
  faq: {
    eyebrow: "Помощь",
    title: "FAQ",
    lead: "Ключи, ошибки, checkout и типовые вопросы интеграции.",
  },
};

export const DOCS_SIDEBAR_GROUPS: Array<{ label: string; items: DocsNavItem[] }> = [
  {
    label: "Начало",
    items: [
      {
        to: "/",
        label: "Обзор",
        description: "Карта документации",
        icon: "◆",
      },
      {
        to: "/quickstart",
        label: "Быстрый старт",
        description: "7 шагов до первого инвойса",
        icon: "→",
      },
    ],
  },
  {
    label: "Интеграция",
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
        description: "Подпись и payload",
        icon: "⇄",
      },
    ],
  },
  {
    label: "Справочник",
    items: [
      {
        to: "/reference",
        label: "API методы",
        description: "Endpoint reference",
        icon: "⚡",
      },
      {
        to: "/commissions",
        label: "Комиссии",
        description: "0,4% · min $0,70",
        icon: "%",
      },
      {
        to: "/faq",
        label: "FAQ",
        description: "Ответы на частые вопросы",
        icon: "?",
      },
    ],
  },
];

export const DOCS_GUIDE_ORDER: DocsSectionKey[] = [
  "quickstart",
  "checkout",
  "webhooks",
  "reference",
  "commissions",
  "faq",
];

export const DOCS_PIPELINE = [
  { step: "01", title: "Ключи", text: "Public + Secret на backend" },
  { step: "02", title: "Rates", text: "Сеть и лимиты" },
  { step: "03", title: "Invoice", text: "POST /invoices" },
  { step: "04", title: "Webhook", text: "Подтверждение оплаты" },
] as const;

export const DOCS_HUB_CARDS: Array<{
  to: string;
  title: string;
  body: string;
  icon: string;
}> = [
  {
    to: "/quickstart",
    title: "Быстрый старт",
    body: "Ключи → rates → инвойс → webhook.",
    icon: "01",
  },
  {
    to: "/checkout",
    title: "Checkout",
    body: "Hosted /pay/{token} или H2H-реквизиты.",
    icon: "02",
  },
  {
    to: "/reference",
    title: "API методы",
    body: "Таблица endpoint'ов и примеры.",
    icon: "03",
  },
  {
    to: "/webhooks",
    title: "Webhooks",
    body: "HMAC, event_id, тест доставки.",
    icon: "04",
  },
  {
    to: "/commissions",
    title: "Комиссии",
    body: "0,4%, минимум $0,70.",
    icon: "05",
  },
  {
    to: "/faq",
    title: "FAQ",
    body: "Ключи, ошибки, sandbox.",
    icon: "06",
  },
];

/** Legacy hash on /merchant-api → new route */
export const DOCS_LEGACY_HASH_REDIRECTS: Record<string, string> = {
  "#docs-start": "/quickstart",
  "#docs-auth": "/quickstart",
  "#docs-checkout-delivery": "/checkout",
  "#docs-webhooks": "/webhooks",
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

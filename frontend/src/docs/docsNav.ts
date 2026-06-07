export type DocsNavItem = {
  to: string;
  label: string;
  description: string;
  icon: string;
};

export const DOCS_PRIMARY_NAV: DocsNavItem[] = [
  {
    to: "/",
    label: "Overview",
    description: "Обзор и быстрый старт",
    icon: "◆",
  },
  {
    to: "/merchant-api",
    label: "Merchant API",
    description: "Контракт и примеры",
    icon: "⚡",
  },
  {
    to: "/merchant-api#docs-checkout-delivery",
    label: "Payment page",
    description: "Hosted checkout или H2H",
    icon: "◈",
  },
  {
    to: "/merchant-api#docs-webhooks",
    label: "Webhooks",
    description: "События, подпись, retry",
    icon: "⇄",
  },
  {
    to: "/merchant-api#docs-commissions",
    label: "Комиссии",
    description: "0,4% · минимум $7",
    icon: "%",
  },
  {
    to: "/merchant-api#docs-faq",
    label: "FAQ",
    description: "Ключи, ошибки, типовые кейсы",
    icon: "?",
  },
];

export const DOCS_QUICK_CARDS = [
  {
    to: "/merchant-api#docs-start",
    title: "Quickstart",
    body: "Ключи, rates, первый инвойс и checkout_delivery — 7 шагов.",
    icon: "01",
  },
  {
    to: "/merchant-api#docs-checkout-delivery",
    title: "Payment page",
    body: "Hosted checkout /pay/{token} или H2H-реквизиты — на уровне проекта.",
    icon: "02",
  },
  {
    to: "/merchant-api#docs-endpoints-table",
    title: "API Reference",
    body: "Endpoint'ы, auth-схема и curl-примеры.",
    icon: "03",
  },
  {
    to: "/merchant-api#docs-webhooks",
    title: "Webhooks",
    body: "Invoice events, HMAC-подпись, checkout_delivery, тестовая доставка.",
    icon: "04",
  },
  {
    to: "/merchant-api#docs-commissions",
    title: "Комиссии",
    body: "0,4% от платежа, но не ниже $7 — формула и примеры расчёта.",
    icon: "05",
  },
];

export const DOCS_PIPELINE = [
  { step: "01", title: "Keys", text: "Public + Secret — только на backend" },
  { step: "02", title: "Rates", text: "Сеть, лимиты, комиссия 0,4% (мин. $7)" },
  { step: "03", title: "Checkout", text: "checkout_delivery: payment page или H2H" },
  { step: "04", title: "Invoice", text: "POST /invoices → ссылка или реквизиты" },
  { step: "05", title: "Webhook", text: "Подтверждение оплаты и sync" },
];

export const DOCS_STATS = [
  { value: "10+", label: "API methods", hint: "Payments, balance, accounting" },
  { value: "3", label: "Checkout modes", hint: "payment_page · h2h · both" },
  { value: "<200ms", label: "Health ping", hint: "Smoke endpoint без auth" },
];

export const DOCS_API_SECTIONS = [
  { href: "#docs-start", label: "Быстрый старт" },
  { href: "#docs-auth", label: "Авторизация" },
  { href: "#docs-checkout-delivery", label: "Checkout" },
  { href: "#docs-endpoints-table", label: "Сводка методов" },
  { href: "#docs-reference", label: "Endpoint reference" },
  { href: "#docs-cabinet", label: "Кабинет (JWT)" },
  { href: "#docs-webhooks", label: "Webhooks" },
  { href: "#docs-commissions", label: "Комиссии" },
  { href: "#docs-faq", label: "FAQ" },
];

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

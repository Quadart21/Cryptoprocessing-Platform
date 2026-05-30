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
    description: "Обзор платформы и быстрый старт",
    icon: "◆",
  },
  {
    to: "/merchant-api",
    label: "Merchant API",
    description: "Полный контракт и примеры",
    icon: "⚡",
  },
  {
    to: "/merchant-api#docs-webhooks",
    label: "Webhooks",
    description: "События, подпись, retry",
    icon: "⇄",
  },
  {
    to: "/merchant-api#docs-faq",
    label: "FAQ",
    description: "Ключи, ошибки, best practices",
    icon: "?",
  },
];

export const DOCS_QUICK_CARDS = [
  {
    to: "/merchant-api#docs-start",
    title: "Quickstart",
    body: "Ключи, rates, первый инвойс и проверка статуса за 6 шагов.",
    icon: "01",
  },
  {
    to: "/merchant-api#docs-endpoints-table",
    title: "API Reference",
    body: "Все endpoint'ы с методами, auth-схемой и живыми curl-примерами.",
    icon: "02",
  },
  {
    to: "/merchant-api#docs-webhooks",
    title: "Webhooks",
    body: "Invoice events, HMAC-подпись, idempotency и тестовая доставка.",
    icon: "03",
  },
  {
    to: "/merchant-api#docs-auth",
    title: "Security",
    body: "X-API-Key/Secret, JWT для кабинета и правила хранения секретов.",
    icon: "04",
  },
];

export const DOCS_PIPELINE = [
  { step: "01", title: "Keys", text: "Public + Secret только на backend" },
  { step: "02", title: "Rates", text: "Проверка сети, лимитов и комиссий" },
  { step: "03", title: "Invoice", text: "POST /invoices с merchant_order_id" },
  { step: "04", title: "Webhook", text: "Подтверждение оплаты и sync" },
];

export const DOCS_STATS = [
  { value: "10+", label: "API methods", hint: "Payments, balance, accounting" },
  { value: "2", label: "Auth modes", hint: "API keys + JWT cabinet" },
  { value: "<200ms", label: "Health ping", hint: "Smoke endpoint без auth" },
];

export const DOCS_API_SECTIONS = [
  { href: "#docs-start", label: "Быстрый старт" },
  { href: "#docs-auth", label: "Авторизация" },
  { href: "#docs-endpoints-table", label: "Сводка методов" },
  { href: "#docs-reference", label: "Endpoint reference" },
  { href: "#docs-cabinet", label: "Кабинет (JWT)" },
  { href: "#docs-webhooks", label: "Webhooks" },
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

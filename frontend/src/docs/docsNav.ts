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

export type DocsNavItem = {
  to: string;
  label: string;
  description: string;
};

export const DOCS_PRIMARY_NAV: DocsNavItem[] = [
  {
    to: "/",
    label: "Введение",
    description: "С чего начать интеграцию",
  },
  {
    to: "/merchant-api",
    label: "Merchant API",
    description: "Методы, примеры запросов и ответов",
  },
  {
    to: "/merchant-api#docs-webhooks",
    label: "Webhooks",
    description: "Подпись, события и тестовая доставка",
  },
  {
    to: "/merchant-api#docs-faq",
    label: "FAQ",
    description: "Частые вопросы по ключам и ошибкам",
  },
];

export const DOCS_QUICK_CARDS = [
  {
    to: "/merchant-api#docs-start",
    title: "Merchant API",
    body: "Создание инвойсов, курсы, баланс, транзакции и статусы платежей.",
  },
  {
    to: "/merchant-api#docs-webhooks",
    title: "Webhooks",
    body: "Настройка URL, проверка подписи и обработка событий invoice.*.",
  },
  {
    to: "/merchant-api#docs-endpoints-table",
    title: "Сводка методов",
    body: "Таблица всех endpoint'ов с методами, auth и быстрыми ссылками.",
  },
  {
    to: "/merchant-api#docs-auth",
    title: "Авторизация",
    body: "X-API-Key / X-API-Secret и JWT для сценариев кабинета.",
  },
];

import type {
  DashboardRailGroup,
  DashboardRailItem,
} from "../../components/layout/DashboardRail";

export type ClientSection =
  | "overview"
  | "docs"
  | "projects"
  | "keys"
  | "invoices"
  | "transactions"
  | "balance"
  | "security";

export const CLIENT_MENU_GROUPS: DashboardRailGroup[] = [
  {
    key: "overview-group",
    label: "Обзор",
    items: [
      { key: "overview", label: "Сводка" },
      { key: "transactions", label: "Операции" },
      { key: "balance", label: "Баланс" },
    ],
  },
  {
    key: "integration-group",
    label: "Интеграция",
    items: [
      { key: "docs", label: "API" },
      { key: "projects", label: "Проекты" },
      { key: "keys", label: "Ключи" },
      { key: "invoices", label: "Инвойсы" },
    ],
  },
  {
    key: "security-group",
    label: "Безопасность",
    items: [{ key: "security", label: "Доступ" }],
  },
];

const CLIENT_MENU_ITEMS: DashboardRailItem[] = CLIENT_MENU_GROUPS.flatMap((group) => group.items);

export const CLIENT_SECTION_META: Record<
  ClientSection,
  { group: string; title: string; description: string }
> = {
  overview: {
    group: "Обзор",
    title: "Сводка кабинета",
    description: "Ключевые метрики, статус проекта и быстрые действия в одном месте.",
  },
  transactions: {
    group: "Обзор",
    title: "Операции",
    description: "Фильтруйте и экспортируйте транзакции по статусам, валютам и периоду.",
  },
  balance: {
    group: "Обзор",
    title: "Баланс и выплаты",
    description: "Текущий баланс проекта и управление выплатами по кошелькам.",
  },
  docs: {
    group: "Интеграция",
    title: "API и документация",
    description: "Базовые маршруты, cURL-примеры и рекомендации по подключению.",
  },
  projects: {
    group: "Интеграция",
    title: "Проекты",
    description: "Список проектов и проверка webhook/интеграций в боевом режиме.",
  },
  keys: {
    group: "Интеграция",
    title: "API-ключи",
    description: "Управление ключами доступа и контроль webhook-конфигурации.",
  },
  invoices: {
    group: "Интеграция",
    title: "Инвойсы",
    description: "Создание, просмотр и синхронизация инвойсов в одном разделе.",
  },
  security: {
    group: "Безопасность",
    title: "Безопасность аккаунта",
    description: "2FA, уведомления и смена пароля для защиты доступа.",
  },
};

export const CLIENT_SHORTCUTS: Array<{ section: ClientSection; label: string; hint: string }> = [
  {
    section: "invoices",
    label: "Создать инвойс",
    hint: "Переход к выставлению новых счетов",
  },
  {
    section: "transactions",
    label: "Проверить операции",
    hint: "Фильтрация и поиск по транзакциям",
  },
  {
    section: "keys",
    label: "Обновить ключи",
    hint: "Ротация API-ключей и контроль доступа",
  },
  {
    section: "security",
    label: "Проверить 2FA",
    hint: "Настройки защиты аккаунта и уведомлений",
  },
];

export function isClientSection(value: string): value is ClientSection {
  return CLIENT_MENU_ITEMS.some((item) => item.key === value);
}

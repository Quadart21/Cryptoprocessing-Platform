import type { DashboardRailGroup } from "../components/layout/DashboardRail";

import type { AdminSection } from "./types";

/** Копирайт секций консоли платформы (навигация + шапка контента). */
export const ADMIN_SECTION_META: Record<
  AdminSection,
  { group: string; title: string; description: string }
> = {
  overview: {
    group: "Мониторинг",
    title: "Пульт платформы",
    description: "Сводка, последние инвойсы и транзакции по всей системе. События — в разделе «События».",
  },
  invoices: {
    group: "Мониторинг",
    title: "Инвойсы всей платформы",
    description: "Единый поток счетов по всем клиентам и тенантам.",
  },
  transactions: {
    group: "Мониторинг",
    title: "Транзакции платформы",
    description: "Операционный мониторинг движений средств end-to-end.",
  },
  payouts: {
    group: "Мониторинг",
    title: "Выплаты",
    description: "Очередь заявок на вывод и история решений.",
  },
  events: {
    group: "Мониторинг",
    title: "События и webhooks",
    description: "Системные и провайдерские события в хронологии.",
  },
  requests: {
    group: "Клиенты",
    title: "Заявки на подключение",
    description: "Модерация онбординга и решения по статусам.",
  },
  clients: {
    group: "Клиенты",
    title: "Каталог клиентов",
    description: "Список тенантов и быстрый переход к карточке.",
  },
  "client-detail": {
    group: "Клиенты",
    title: "Карточка клиента",
    description: "Проекты, ключи, инвойсы, операции и выплаты в одном месте.",
  },
  "platform-settings": {
    group: "Управление",
    title: "Настройки платформы",
    description: "Глобальные комиссии, уведомления, тарификация и интеграции.",
  },
  "public-pages": {
    group: "Управление",
    title: "Публичный сайт",
    description: "Страницы лендинга, меню и футер.",
  },
  assets: {
    group: "Управление",
    title: "Токены и сети",
    description: "Доступность активов для клиентов.",
  },
  team: {
    group: "Управление",
    title: "Команда платформы",
    description: "Внутренние пользователи и роли.",
  },
  security: {
    group: "Управление",
    title: "Безопасность доступа",
    description: "2FA и защита учётной записи в консоли.",
  },
};

export function buildAdminMenuGroups(selectedTenantId: string | null): DashboardRailGroup[] {
  return [
    {
      key: "monitoring",
      label: "Мониторинг",
      items: [
        { key: "overview", label: "Обзор" },
        { key: "invoices", label: "Инвойсы" },
        { key: "transactions", label: "Транзакции" },
        { key: "payouts", label: "Выплаты" },
        { key: "events", label: "События" },
      ],
    },
    {
      key: "clients",
      label: "Клиенты",
      items: [
        { key: "requests", label: "Заявки" },
        { key: "clients", label: "Список" },
        {
          key: "client-detail",
          label: "Карточка",
          disabled: !selectedTenantId,
        },
      ],
    },
    {
      key: "management",
      label: "Управление",
      items: [
        { key: "platform-settings", label: "Настройки" },
        { key: "public-pages", label: "Страницы" },
        { key: "assets", label: "Токены и сети" },
        { key: "team", label: "Команда" },
        { key: "security", label: "Безопасность" },
      ],
    },
  ];
}

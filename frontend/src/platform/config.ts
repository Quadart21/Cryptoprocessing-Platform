import type { DashboardRailGroup } from "../components/layout/DashboardRail";

import type { AdminSection } from "./types";

export type AdminHub = "monitoring" | "clients" | "management";

const ADMIN_HUB_SECTIONS: Record<AdminHub, AdminSection[]> = {
  monitoring: ["overview", "accounting", "invoices", "transactions", "payouts", "events", "api-traffic"],
  clients: ["requests", "clients", "client-detail"],
  management: ["platform-settings", "public-pages", "assets", "backups", "team", "security"],
};

export const ADMIN_HUB_DEFAULT_SECTION: Record<AdminHub, AdminSection> = {
  monitoring: "overview",
  clients: "clients",
  management: "platform-settings",
};

export function adminSectionToHub(section: AdminSection): AdminHub {
  for (const [hub, sections] of Object.entries(ADMIN_HUB_SECTIONS) as Array<[AdminHub, AdminSection[]]>) {
    if (sections.includes(section)) {
      return hub;
    }
  }
  return "monitoring";
}

export function isAdminHub(value: string): value is AdminHub {
  return value === "monitoring" || value === "clients" || value === "management";
}

/** Копирайт секций консоли платформы (навигация + шапка контента). */
export const ADMIN_SECTION_META: Record<
  AdminSection,
  { group: string; title: string; description: string }
> = {
  overview: {
    group: "Мониторинг",
    title: "Пульт платформы",
    description: "Что требует решения прямо сейчас: заявки, выплаты и быстрый переход в ключевые разделы.",
  },
  accounting: {
    group: "Мониторинг",
    title: "Бухгалтерия платформы",
    description: "Ваша комиссия, оборот, балансы мерчантов и история выводов markup.",
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
  "api-traffic": {
    group: "Мониторинг",
    title: "Трафик API",
    description: "Сводка запросов по всей платформе: Merchant API, Crypto-Cash, pay-страница и rate limit.",
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
  backups: {
    group: "Управление",
    title: "Бэкапы платформы",
    description: "Полные и частичные копии фронта, бэка и БД с выгрузкой в Google Drive и расписанием.",
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

export function buildAdminMenuGroups(
  selectedTenantId: string | null,
  opts?: { backupsConsole?: boolean },
): DashboardRailGroup[] {
  const backupsItem =
    opts?.backupsConsole === true ? [{ key: "backups" as const, label: "Бэкапы" }] : [];

  return [
    {
      key: "monitoring",
      label: "Мониторинг",
      items: [
        { key: "overview", label: "Обзор" },
        { key: "accounting", label: "Бухгалтерия" },
        { key: "invoices", label: "Инвойсы" },
        { key: "transactions", label: "Транзакции" },
        { key: "payouts", label: "Выплаты" },
        { key: "events", label: "События" },
        { key: "api-traffic", label: "Трафик" },
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
        { key: "assets", label: "Токены" },
        ...backupsItem,
        { key: "team", label: "Команда" },
        { key: "security", label: "Безопасность" },
      ],
    },
  ];
}

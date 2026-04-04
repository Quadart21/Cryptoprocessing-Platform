import type { DashboardRailGroup } from "../../components/layout/DashboardRail";
import type { AdminSection } from "./adminDashboard.types";

export const ADMIN_SECTION_META: Record<
  AdminSection,
  { group: string; title: string; description: string }
> = {
  overview: {
    group: "Мониторинг",
    title: "Обзор платформы",
    description: "Сводные метрики, последние инвойсы, транзакции и события платформы.",
  },
  invoices: {
    group: "Мониторинг",
    title: "Инвойсы платформы",
    description: "Единый поток инвойсов по всем клиентам для быстрого контроля.",
  },
  transactions: {
    group: "Мониторинг",
    title: "Транзакции платформы",
    description: "Операционный мониторинг движений средств по всей системе.",
  },
  events: {
    group: "Мониторинг",
    title: "События и webhooks",
    description: "Последние системные и провайдерские события по платформе.",
  },
  requests: {
    group: "Клиенты",
    title: "Заявки на подключение",
    description: "Модерация входящих запросов и принятие решения по онбордингу.",
  },
  clients: {
    group: "Клиенты",
    title: "Список клиентов",
    description: "Каталог клиентов, быстрый доступ к карточке и управлению доступом.",
  },
  "client-detail": {
    group: "Клиенты",
    title: "Карточка клиента",
    description: "Полная детализация клиента: проекты, ключи, инвойсы и операции.",
  },
  "platform-settings": {
    group: "Управление",
    title: "Настройки платформы",
    description: "Глобальные комиссии, уведомления и политика доступности активов.",
  },
  "public-pages": {
    group: "Управление",
    title: "Публичные страницы",
    description: "Управление контентом сайта, размещением в меню и футере.",
  },
  assets: {
    group: "Управление",
    title: "Токены и сети",
    description: "Управление доступностью криптовалют и сетей для клиентов.",
  },
  team: {
    group: "Управление",
    title: "Команда и роли",
    description: "Управление внутренними пользователями и их правами доступа.",
  },
  security: {
    group: "Управление",
    title: "Безопасность админов",
    description: "Защита учетной записи админки и контроль 2FA.",
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

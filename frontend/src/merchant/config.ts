import type { DashboardRailGroup, DashboardRailItem } from "../components/layout/DashboardRail";

import type { MerchantSection } from "./types";

export const MERCHANT_MENU_GROUPS: DashboardRailGroup[] = [
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

export const MERCHANT_MENU_ITEMS: DashboardRailItem[] = MERCHANT_MENU_GROUPS.flatMap((g) => g.items);

export const MERCHANT_SECTION_COPY: Record<
  MerchantSection,
  { group: string; title: string; description: string }
> = {
  overview: {
    group: "Пульс",
    title: "Сводка бизнеса",
    description: "Один экран: оборот, готовность интеграции и быстрые переходы.",
  },
  transactions: {
    group: "Реестр",
    title: "Движение средств",
    description: "Фильтры, поиск и выгрузка по всем операциям тенанта.",
  },
  balance: {
    group: "Казначейство",
    title: "Баланс и вывод",
    description: "Доступно / заморожено и заявки на вывод в одной ветке.",
  },
  docs: {
    group: "Справочник",
    title: "Контракт API",
    description: "Маршруты, примеры curl и ответы — без выхода из кабинета.",
  },
  projects: {
    group: "Портфель",
    title: "Проекты и среда",
    description: "Карточки проектов и стенд проверки интеграции рядом.",
  },
  keys: {
    group: "Доступ",
    title: "Ключи и webhook",
    description: "Управление парами ключей и тот же центр проверки, что у проектов.",
  },
  invoices: {
    group: "Приём",
    title: "Выставление счетов",
    description: "Мастер создания счёта и список инвойсов с поиском и постраничным просмотром.",
  },
  security: {
    group: "Доверие",
    title: "Защита аккаунта",
    description: "2FA и каналы уведомлений в раскрывающихся блоках.",
  },
};

export const MERCHANT_SHORTCUTS: Array<{ section: MerchantSection; label: string; hint: string }> = [
  { section: "invoices", label: "Новый инвойс", hint: "Мастер выставления" },
  { section: "transactions", label: "Реестр", hint: "Все операции" },
  { section: "keys", label: "Ключи", hint: "Ротация доступа" },
  { section: "security", label: "2FA / алерты", hint: "Защита входа" },
];

export function isMerchantSection(value: string): value is MerchantSection {
  return MERCHANT_MENU_ITEMS.some((item) => item.key === value);
}

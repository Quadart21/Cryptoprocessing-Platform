import type { DashboardRailGroup } from "../components/layout/DashboardRail";

export type PartnerSection =
  | "overview"
  | "referral"
  | "merchants"
  | "commissions"
  | "payouts"
  | "profile";

export const PARTNER_MENU_GROUPS: DashboardRailGroup[] = [
  {
    key: "home",
    label: "Главная",
    items: [
      { key: "overview", label: "Сводка" },
      { key: "referral", label: "Ссылка" },
    ],
  },
  {
    key: "finance",
    label: "Финансы",
    items: [
      { key: "commissions", label: "Начисления" },
      { key: "payouts", label: "Выплаты" },
      { key: "merchants", label: "Клиенты" },
    ],
  },
  {
    key: "account",
    label: "Аккаунт",
    items: [{ key: "profile", label: "Профиль" }],
  },
];

export const PARTNER_SECTION_META: Record<
  PartnerSection,
  { group: string; title: string; description: string }
> = {
  overview: {
    group: "Главная",
    title: "Сводка партнёра",
    description: "Баланс, воронка и быстрый доступ к ключевым разделам кабинета.",
  },
  referral: {
    group: "Главная",
    title: "Реферальная ссылка",
    description: "Код и ссылка для привлечения мерчантов, условия комиссии.",
  },
  merchants: {
    group: "Финансы",
    title: "Приведённые клиенты",
    description: "Агрегированная статистика по мерчантам без доступа к их операционным данным.",
  },
  commissions: {
    group: "Финансы",
    title: "Начисления",
    description: "Комиссии с platform fee по подтверждённым платежам и статус hold.",
  },
  payouts: {
    group: "Финансы",
    title: "Выплаты",
    description: "Заявки на вывод USDT и история решений администрации.",
  },
  profile: {
    group: "Аккаунт",
    title: "Профиль и реквизиты",
    description: "Публичное имя, контакт и адрес для выплат партнёра.",
  },
};

export function isPartnerSection(value: string): value is PartnerSection {
  return (
    value === "overview" ||
    value === "referral" ||
    value === "merchants" ||
    value === "commissions" ||
    value === "payouts" ||
    value === "profile"
  );
}

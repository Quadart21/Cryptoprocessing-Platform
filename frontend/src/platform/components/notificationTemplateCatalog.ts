import type { NotificationEventToggle, NotificationTemplateItem } from "../../api";

export type TemplateEventCategory = {
  id: string;
  label: string;
  codes: string[];
};

export const TEMPLATE_EVENT_CATEGORIES: TemplateEventCategory[] = [
  {
    id: "onboarding",
    label: "Заявки и подключение",
    codes: ["application_submitted", "application_approved", "application_rejected"],
  },
  {
    id: "access",
    label: "Доступ и пароли",
    codes: ["password_generated", "password_changed"],
  },
  {
    id: "api",
    label: "API-ключи",
    codes: ["api_key_generated", "api_key_regenerated", "api_key_revoked"],
  },
  {
    id: "security",
    label: "Безопасность",
    codes: ["two_factor_enabled", "two_factor_disabled"],
  },
  {
    id: "payouts",
    label: "Выплаты",
    codes: ["payout_requested", "payout_approved", "payout_rejected"],
  },
];

export const TEMPLATE_EVENT_HINTS: Record<string, string> = {
  application_submitted: "Мерчант отправил заявку — уведомление администраторам платформы.",
  application_approved: "Заявка одобрена — письмо владельцу с доступом в кабинет.",
  application_rejected: "Заявка отклонена — сообщение с причиной или комментарием.",
  password_generated: "Выдан временный пароль при создании или сбросе доступа.",
  password_changed: "Пользователь или админ сменил пароль.",
  api_key_generated: "Создан новый API-ключ проекта.",
  api_key_regenerated: "Ключ перевыпущен — в тексте может быть secret (показывается один раз).",
  api_key_revoked: "Ключ отозван — предупреждение о прекращении доступа.",
  two_factor_enabled: "Подтверждение включения двухфакторной аутентификации.",
  two_factor_disabled: "Подтверждение отключения 2FA.",
  payout_requested: "Мерчант создал заявку на вывод — уведомление админам.",
  payout_approved: "Админ одобрил выплату — сообщение мерчанту.",
  payout_rejected: "Выплата отклонена — сообщение с комментарием модератора.",
};

export const TEMPLATE_MODE_LABELS: Record<string, { label: string; hint: string }> = {
  notify: {
    label: "Уведомление",
    hint: "Информирует о событии (заявка, выплата, отклонение).",
  },
  confirm: {
    label: "Подтверждение",
    hint: "Подтверждает действие самому инициатору (пароль, API, 2FA).",
  },
};

export const TEMPLATE_VARIABLE_GROUPS: Array<{ label: string; variables: string[] }> = [
  {
    label: "Событие",
    variables: [
      "event_code",
      "event_title",
      "event_subject",
      "message_lines",
      "message_lines_html",
    ],
  },
  {
    label: "Бренд",
    variables: ["brand_name", "brand_url", "notification_logo_url"],
  },
  {
    label: "Получатель",
    variables: ["user_email", "user_full_name", "initiated_by_email"],
  },
  {
    label: "Проект",
    variables: ["tenant_name", "project_id", "project_name", "owner_email"],
  },
  {
    label: "Доступ и ключи",
    variables: [
      "temporary_password",
      "recovery_token",
      "invite_token",
      "api_secret_key",
      "api_public_key",
    ],
  },
  {
    label: "Выплаты",
    variables: [
      "payout_id",
      "payout_amount",
      "payout_currency",
      "payout_status",
      "destination_address",
      "review_comment",
    ],
  },
  { label: "Система", variables: ["utc_now"] },
];

export type TemplateListFilter = "all" | "configured" | "default";

export function hasConfiguredTemplateContent(template: NotificationTemplateItem) {
  if (template.configured) return true;
  const messageLinesChanged =
    (template.message_lines ?? "").trim() !== "" &&
    (template.message_lines ?? "").trim() !== (template.default_message_lines ?? "").trim();
  return (
    messageLinesChanged ||
    [template.email_subject, template.email_body, template.telegram_body].some(
      (value) => Boolean(value && value.trim() !== ""),
    )
  );
}

export function groupTemplatesByCategory(
  templates: NotificationTemplateItem[],
): Array<{ category: TemplateEventCategory | null; items: NotificationTemplateItem[] }> {
  const knownCodes = new Set<string>();
  const groups: Array<{ category: TemplateEventCategory | null; items: NotificationTemplateItem[] }> =
    TEMPLATE_EVENT_CATEGORIES.map((category) => {
      const items = templates.filter((template) => category.codes.includes(template.code));
      for (const item of items) {
        knownCodes.add(item.code);
      }
      return { category, items };
    }).filter((group) => group.items.length > 0);

  const uncategorized = templates.filter((template) => !knownCodes.has(template.code));
  if (uncategorized.length > 0) {
    groups.push({ category: null, items: uncategorized });
  }

  return groups;
}

export function matchesTemplateFilter(
  template: NotificationTemplateItem,
  filter: TemplateListFilter,
): boolean {
  if (filter === "all") return true;
  const configured = hasConfiguredTemplateContent(template);
  return filter === "configured" ? configured : !configured;
}

export function matchesTemplateSearch(template: NotificationTemplateItem, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    template.title.toLowerCase().includes(normalized) ||
    template.code.toLowerCase().includes(normalized)
  );
}

export function getEventChannels(
  events: NotificationEventToggle[],
  code: string,
): { email: boolean; telegram: boolean } {
  const event = events.find((item) => item.code === code);
  return {
    email: event?.email_enabled ?? false,
    telegram: event?.telegram_enabled ?? false,
  };
}

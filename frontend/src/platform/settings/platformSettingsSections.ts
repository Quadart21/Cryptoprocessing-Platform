import type { OpsTelegramSettings, PlatformBillingSettings } from "../../api";

export type SettingsSectionKey =
  | "fees"
  | "rates"
  | "payouts"
  | "brand"
  | "seo"
  | "email"
  | "telegram"
  | "ops-chat"
  | "templates"
  | "events"
  | "tenant";

export type SettingsGroupKey = "commissions" | "tarification" | "notifications" | "integrations";

export type SettingsSectionMeta = {
  key: SettingsSectionKey;
  label: string;
  eyebrow: string;
  description: string;
  icon: string;
};

export type SettingsGroupMeta = {
  key: SettingsGroupKey;
  label: string;
  description: string;
  sections: SettingsSectionKey[];
};

const SECTION_META: Record<SettingsSectionKey, SettingsSectionMeta> = {
  fees: {
    key: "fees",
    label: "Комиссии",
    eyebrow: "Биллинг",
    description: "Проценты провайдера и платформы, минимумы в USDT.",
    icon: "01",
  },
  rates: {
    key: "rates",
    label: "Курсы",
    eyebrow: "Exchange",
    description: "Источник цены Crypto-Cash и ручные override-курсы.",
    icon: "09",
  },
  payouts: {
    key: "payouts",
    label: "Выплаты",
    eyebrow: "Политики",
    description: "Глобальные правила выплат и переопределений.",
    icon: "02",
  },
  brand: {
    key: "brand",
    label: "Бренд",
    eyebrow: "Оформление",
    description: "Имя, логотип и основной URL в письмах и UI.",
    icon: "03",
  },
  seo: {
    key: "seo",
    label: "SEO",
    eyebrow: "Публичность",
    description: "Мета-теги, favicon и Open Graph для лендинга.",
    icon: "07",
  },
  email: {
    key: "email",
    label: "Email",
    eyebrow: "SMTP.bz",
    description: "Подключение SMTP и тестовая отправка.",
    icon: "04",
  },
  telegram: {
    key: "telegram",
    label: "Telegram",
    eyebrow: "Бот",
    description: "Токен бота, проверка и тестовая доставка.",
    icon: "05",
  },
  "ops-chat": {
    key: "ops-chat",
    label: "Служебный чат",
    eyebrow: "Ops",
    description: "Форум-чат команды с топиками (superadmin).",
    icon: "10",
  },
  templates: {
    key: "templates",
    label: "Шаблоны",
    eyebrow: "Контент",
    description: "Тексты email и Telegram для событий платформы.",
    icon: "06",
  },
  events: {
    key: "events",
    label: "События",
    eyebrow: "Матрица",
    description: "Какие каналы активны для каждого события.",
    icon: "08",
  },
  tenant: {
    key: "tenant",
    label: "Клиенты",
    eyebrow: "Индивидуально",
    description: "Переопределения правил для выбранного клиента.",
    icon: "11",
  },
};

export const SETTINGS_GROUPS: SettingsGroupMeta[] = [
  {
    key: "commissions",
    label: "Комиссии",
    description: "Глобальные проценты, минимумы и политики выплат.",
    sections: ["fees", "payouts"],
  },
  {
    key: "tarification",
    label: "Тарификация",
    description: "Курсы обмена и индивидуальные правила клиентов.",
    sections: ["rates", "tenant"],
  },
  {
    key: "notifications",
    label: "Уведомления",
    description: "Бренд, шаблоны и матрица событий.",
    sections: ["brand", "templates", "events"],
  },
  {
    key: "integrations",
    label: "Интеграции",
    description: "Email, Telegram, SEO и служебный чат.",
    sections: ["email", "telegram", "seo", "ops-chat"],
  },
];

export function getSectionMeta(key: SettingsSectionKey): SettingsSectionMeta {
  return SECTION_META[key];
}

export function buildVisibleGroups(isSuperadmin: boolean): SettingsGroupMeta[] {
  return SETTINGS_GROUPS.map((group) => ({
    ...group,
    sections: group.sections.filter((key) => isSuperadmin || key !== "ops-chat"),
  })).filter((group) => group.sections.length > 0);
}

export function flattenVisibleSections(isSuperadmin: boolean): SettingsSectionMeta[] {
  return buildVisibleGroups(isSuperadmin).flatMap((group) =>
    group.sections.map((key) => getSectionMeta(key)),
  );
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function pickSectionFields(
  source: PlatformBillingSettings,
  section: SettingsSectionKey,
): Partial<PlatformBillingSettings> {
  switch (section) {
    case "fees":
      return {
        provider_fee_percent: source.provider_fee_percent,
        default_markup_percent: source.default_markup_percent,
        platform_markup_min_usdt: source.platform_markup_min_usdt,
        platform_fee_min_usdt: source.platform_fee_min_usdt,
        exchange_rate_markup_percent: source.exchange_rate_markup_percent,
      };
    case "rates":
      return {
        exchange_rate_price_field: source.exchange_rate_price_field,
        manual_exchange_rates: { ...(source.manual_exchange_rates ?? {}) },
      };
    case "payouts":
      return {
        allow_tenant_markup_override: source.allow_tenant_markup_override,
        payouts_enabled: source.payouts_enabled,
      };
    case "brand":
      return {
        notification_brand_name: source.notification_brand_name,
        notification_logo_url: source.notification_logo_url,
        notification_primary_url: source.notification_primary_url,
      };
    case "seo":
      return {
        seo_title: source.seo_title,
        seo_description: source.seo_description,
        seo_keywords: source.seo_keywords,
        seo_favicon_url: source.seo_favicon_url,
        seo_og_image_url: source.seo_og_image_url,
        seo_robots: source.seo_robots,
        seo_canonical_url: source.seo_canonical_url,
      };
    case "email":
      return {
        email_notifications_enabled: source.email_notifications_enabled,
        smtp_bz_enabled: source.smtp_bz_enabled,
        smtp_bz_api_base_url: source.smtp_bz_api_base_url,
        smtp_bz_sender_email: source.smtp_bz_sender_email,
        smtp_bz_sender_name: source.smtp_bz_sender_name,
        smtp_bz_reply_to: source.smtp_bz_reply_to,
        smtp_bz_tag: source.smtp_bz_tag,
      };
    case "telegram":
      return {
        telegram_notifications_enabled: source.telegram_notifications_enabled,
        telegram_api_base_url: source.telegram_api_base_url,
      };
    case "templates":
      return {
        notification_templates: source.notification_templates.map((item) => ({ ...item })),
      };
    case "events":
      return {
        notification_events: source.notification_events.map((item) => ({ ...item })),
      };
    case "ops-chat":
      return {
        ops_telegram: source.ops_telegram
          ? {
              enabled: source.ops_telegram.enabled,
              chat_id: source.ops_telegram.chat_id,
              topics: source.ops_telegram.topics.map((item) => ({ ...item })),
              events: source.ops_telegram.events.map((item) => ({ ...item })),
            }
          : {
              enabled: false,
              chat_id: null,
              topics: [],
              events: [],
            },
      };
    default:
      return {};
  }
}

export function createSectionDrafts(
  server: PlatformBillingSettings,
  sections: SettingsSectionKey[],
): Partial<Record<SettingsSectionKey, Partial<PlatformBillingSettings>>> {
  const drafts: Partial<Record<SettingsSectionKey, Partial<PlatformBillingSettings>>> = {};
  for (const section of sections) {
    drafts[section] = pickSectionFields(server, section);
  }
  return drafts;
}

export function applySectionDraft(
  server: PlatformBillingSettings,
  section: SettingsSectionKey,
  draft: Partial<PlatformBillingSettings>,
  secrets?: { smtpBzApiKey?: string; telegramBotToken?: string },
): PlatformBillingSettings {
  const payload: PlatformBillingSettings = { ...server };
  const patch = pickSectionFields({ ...server, ...draft } as PlatformBillingSettings, section);
  Object.assign(payload, patch);

  if (section === "email" && secrets?.smtpBzApiKey?.trim()) {
    payload.smtp_bz_api_key = secrets.smtpBzApiKey.trim();
  }
  if (section === "telegram" && secrets?.telegramBotToken?.trim()) {
    payload.telegram_bot_token = secrets.telegramBotToken.trim();
  }
  if (section === "ops-chat" && draft.ops_telegram) {
    payload.ops_telegram = draft.ops_telegram as OpsTelegramSettings;
  }

  return payload;
}

export function isSectionDirty(
  server: PlatformBillingSettings,
  section: SettingsSectionKey,
  draft: Partial<PlatformBillingSettings> | undefined,
  secrets?: { smtpBzApiKey?: string; telegramBotToken?: string },
): boolean {
  if (!draft) return false;

  const serverSlice = pickSectionFields(server, section);
  const draftSlice = pickSectionFields({ ...server, ...draft } as PlatformBillingSettings, section);

  if (stableJson(serverSlice) !== stableJson(draftSlice)) {
    return true;
  }

  if (section === "email" && secrets?.smtpBzApiKey?.trim()) {
    return true;
  }
  if (section === "telegram" && secrets?.telegramBotToken?.trim()) {
    return true;
  }

  return false;
}

export function getSaveButtonLabel(section: SettingsSectionKey): string {
  switch (section) {
    case "rates":
      return "Сохранить курсы";
    case "ops-chat":
      return "Сохранить служебный чат";
    case "templates":
      return "Сохранить шаблоны";
    case "events":
      return "Сохранить матрицу";
    default:
      return "Сохранить раздел";
  }
}

export function getGroupForSection(section: SettingsSectionKey): SettingsGroupKey {
  for (const group of SETTINGS_GROUPS) {
    if (group.sections.includes(section)) {
      return group.key;
    }
  }
  return "commissions";
}

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

import type {
  ExchangeRateLookup,
  ExchangeRatePriceField,
  ExchangeRateRefresh,
  NotificationTemplatePreview,
  NotificationTemplatePreviewPayload,
  NotificationTemplateTestPayload,
  NotificationTemplateTestResponse,
  OpsTelegramProvisionResponse,
  OpsTelegramSettings,
  OpsTelegramTopicTestResponse,
  PlatformBillingSettings,
  RateItem,
  SmtpBzTestPayload,
  SmtpBzTestResponse,
  TelegramAdminTestPayload,
  TelegramAdminTestResponse,
  TelegramBotIdentity,
  TelegramBotInspectPayload,
  TenantBillingPolicy,
  TenantItem,
} from "../../api";
import { NotificationTemplatesWorkspace } from "../components/NotificationTemplatesWorkspace";
import { BrandLogoUploader } from "../components/BrandLogoUploader";
import {
  applySectionDraft,
  buildVisibleGroups,
  createSectionDrafts,
  flattenVisibleSections,
  getGroupForSection,
  getSaveButtonLabel,
  getSectionMeta,
  isSectionDirty,
  type SettingsGroupKey,
  type SettingsSectionKey,
} from "../settings/platformSettingsSections";

const EXCHANGE_RATE_PRICE_FIELD_LABELS: Record<ExchangeRatePriceField, string> = {
  last: "Last",
  buy: "Buy",
  sell: "Sell",
};

function formatExchangeRateSource(
  source: string | undefined,
  priceField: ExchangeRatePriceField,
): string {
  if (source === "manual") return "Ручной";
  if (source?.startsWith("crypto_cash_")) {
    const field = source.slice("crypto_cash_".length) as ExchangeRatePriceField;
    const label = EXCHANGE_RATE_PRICE_FIELD_LABELS[field] ?? field;
    return `Crypto-Cash · ${label}`;
  }
  return `Crypto-Cash · ${EXCHANGE_RATE_PRICE_FIELD_LABELS[priceField]}`;
}

type AdminPlatformSettingsSectionProps = {
  adminAssetRates: RateItem[];
  loading: boolean;
  isSuperadmin?: boolean;
  platformBillingSettings: PlatformBillingSettings | null;
  selectedTenantBillingPolicy: TenantBillingPolicy | null;
  selectedTenantId: string | null;
  tenants: TenantItem[];
  onSelectTenant: (tenantId: string) => void;
  onUpdatePlatformSettings: (payload: PlatformBillingSettings) => Promise<void>;
  onReloadPlatformSettings: () => Promise<void>;
  onUploadBrandLogo: (file: File) => Promise<void>;
  onRemoveBrandLogo: () => Promise<void>;
  onFetchPlatformExchangeRate: (currency: string) => Promise<ExchangeRateLookup>;
  onRefreshPlatformExchangeRate: () => Promise<ExchangeRateRefresh>;
  onInspectPlatformTelegramBot: (
    payload: TelegramBotInspectPayload,
  ) => Promise<TelegramBotIdentity>;
  onSendPlatformTelegramTest: (
    payload: TelegramAdminTestPayload,
  ) => Promise<TelegramAdminTestResponse>;
  onProvisionOpsTelegramTopics?: (
    chatId: string | null,
  ) => Promise<OpsTelegramProvisionResponse>;
  onSendOpsTelegramTopicTest?: (
    payload: import("../../api").OpsTelegramTopicTestPayload,
  ) => Promise<OpsTelegramTopicTestResponse>;
  onSendPlatformSmtpBzTest: (
    payload: SmtpBzTestPayload,
  ) => Promise<SmtpBzTestResponse>;
  onPreviewNotificationTemplate: (
    payload: NotificationTemplatePreviewPayload,
  ) => Promise<NotificationTemplatePreview>;
  onSendNotificationTemplateTest: (
    payload: NotificationTemplateTestPayload,
  ) => Promise<NotificationTemplateTestResponse>;
  onUpdateTenantPolicy: (payload: Omit<TenantBillingPolicy, "tenant_id">) => void;
};

type SettingsSectionMeta = ReturnType<typeof getSectionMeta>;

function SectionShell({
  meta,
  children,
  actions,
  dirty = false,
}: {
  meta: SettingsSectionMeta;
  children: ReactNode;
  actions?: ReactNode;
  dirty?: boolean;
}) {
  return (
    <section className="aps-section-card pw-settings-section-card" id={`settings-${meta.key}`}>
      <div className="aps-section-head">
        <div className="aps-section-mark">{meta.icon}</div>
        <div className="aps-section-copy">
          <p className="eyebrow">{meta.eyebrow}</p>
          <h2>
            {meta.label}
            {dirty ? <span className="aps-section-dirty">Изменено</span> : null}
          </h2>
          <p className="muted-text">{meta.description}</p>
        </div>
      </div>
      <div className="aps-section-body">{children}</div>
      {actions ? <div className="aps-section-actions">{actions}</div> : null}
    </section>
  );
}

function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="aps-field-grid">{children}</div>;
}

function StatPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className={`aps-stat-pill aps-stat-pill-${tone} pw-settings-stat-pill`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function AdminPlatformSettingsSection({
  adminAssetRates,
  loading,
  isSuperadmin = false,
  platformBillingSettings,
  selectedTenantBillingPolicy,
  selectedTenantId,
  tenants,
  onSelectTenant,
  onUpdatePlatformSettings,
  onReloadPlatformSettings,
  onUploadBrandLogo,
  onRemoveBrandLogo,
  onFetchPlatformExchangeRate,
  onRefreshPlatformExchangeRate,
  onInspectPlatformTelegramBot,
  onSendPlatformTelegramTest,
  onProvisionOpsTelegramTopics,
  onSendOpsTelegramTopicTest,
  onSendPlatformSmtpBzTest,
  onPreviewNotificationTemplate,
  onSendNotificationTemplateTest,
  onUpdateTenantPolicy,
}: AdminPlatformSettingsSectionProps) {
  const [sectionDrafts, setSectionDrafts] = useState<
    Partial<Record<SettingsSectionKey, Partial<PlatformBillingSettings>>>
  >({});
  const [smtpBzApiKey, setSmtpBzApiKey] = useState("");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramBotInfo, setTelegramBotInfo] = useState<TelegramBotIdentity | null>(null);
  const [telegramBotCheckError, setTelegramBotCheckError] = useState<string | null>(null);
  const [adminTelegramChatId, setAdminTelegramChatId] = useState("");
  const [telegramTestResult, setTelegramTestResult] =
    useState<TelegramAdminTestResponse | null>(null);
  const [checkingTelegramBot, setCheckingTelegramBot] = useState(false);
  const [sendingTelegramTest, setSendingTelegramTest] = useState(false);
  const [provisioningOpsTopics, setProvisioningOpsTopics] = useState(false);
  const [opsTopicTestKey, setOpsTopicTestKey] = useState<string | null>(null);
  const [opsChatError, setOpsChatError] = useState<string | null>(null);
  const [opsChatMessage, setOpsChatMessage] = useState<string | null>(null);

  const visibleGroups = useMemo(() => buildVisibleGroups(isSuperadmin), [isSuperadmin]);
  const visibleSections = useMemo(
    () => flattenVisibleSections(isSuperadmin),
    [isSuperadmin],
  );
  const [smtpTestRecipient, setSmtpTestRecipient] = useState("");
  const [smtpTestResult, setSmtpTestResult] = useState<SmtpBzTestResponse | null>(null);
  const [sendingSmtpTest, setSendingSmtpTest] = useState(false);
  const [selectedManualRateCurrency, setSelectedManualRateCurrency] = useState("");
  const [selectedExchangeRate, setSelectedExchangeRate] =
    useState<ExchangeRateLookup | null>(null);
  const [loadingSelectedExchangeRate, setLoadingSelectedExchangeRate] = useState(false);
  const [refreshingSelectedExchangeRate, setRefreshingSelectedExchangeRate] = useState(false);
  const [tenantPolicyForm, setTenantPolicyForm] = useState<Omit<
    TenantBillingPolicy,
    "tenant_id"
  > | null>(null);
  const [activeGroup, setActiveGroup] = useState<SettingsGroupKey>("commissions");
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>("fees");
  const [expandedSections, setExpandedSections] = useState<Set<SettingsSectionKey>>(
    new Set(["fees"]),
  );
  const [savingSection, setSavingSection] = useState<SettingsSectionKey | null>(null);
  const [sectionSaveMessage, setSectionSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!platformBillingSettings) {
      setSectionDrafts({});
      return;
    }
    setSectionDrafts(
      createSectionDrafts(
        platformBillingSettings,
        visibleSections.map((item) => item.key),
      ),
    );
    setSmtpBzApiKey("");
    setTelegramBotToken("");
    setAdminTelegramChatId("");
    setTelegramTestResult(null);
    setSmtpTestRecipient("");
    setSmtpTestResult(null);
    setTelegramBotInfo(null);
    setTelegramBotCheckError(null);
    setSectionSaveMessage(null);
  }, [platformBillingSettings, visibleSections]);

  useEffect(() => {
    if (!selectedTenantBillingPolicy) {
      setTenantPolicyForm(null);
      return;
    }
    setTenantPolicyForm({
      custom_markup_percent: selectedTenantBillingPolicy.custom_markup_percent,
      custom_turnover_fee_percent: null,
      payouts_enabled: selectedTenantBillingPolicy.payouts_enabled,
      requires_manual_payout_review: selectedTenantBillingPolicy.requires_manual_payout_review,
    });
  }, [selectedTenantBillingPolicy]);

  function getSectionForm(section: SettingsSectionKey): PlatformBillingSettings | null {
    if (!platformBillingSettings) return null;
    const draft = sectionDrafts[section] ?? {};
    return { ...platformBillingSettings, ...draft };
  }

  function updateSectionDraft(
    section: SettingsSectionKey,
    patch: Partial<PlatformBillingSettings>,
  ) {
    if (!platformBillingSettings) return;
    setSectionDrafts((prev) => {
      const merged = {
        ...platformBillingSettings,
        ...(prev[section] ?? {}),
        ...patch,
      };
      return {
        ...prev,
        [section]: createSectionDrafts(merged, [section])[section],
      };
    });
  }

  function sectionIsDirty(section: SettingsSectionKey): boolean {
    if (!platformBillingSettings) return false;
    return isSectionDirty(platformBillingSettings, section, sectionDrafts[section], {
      smtpBzApiKey: section === "email" ? smtpBzApiKey : undefined,
      telegramBotToken: section === "telegram" ? telegramBotToken : undefined,
    });
  }

  const manualRateCurrencies = useMemo(() => {
    const all = new Set<string>();
    for (const item of adminAssetRates) {
      all.add(item.currency);
    }
    const ratesForm = getSectionForm("rates");
    if (ratesForm) {
      for (const key of Object.keys(ratesForm.manual_exchange_rates ?? {})) {
        all.add(key);
      }
    }
    return Array.from(all).sort((left, right) => left.localeCompare(right));
  }, [adminAssetRates, platformBillingSettings, sectionDrafts.rates]);

  useEffect(() => {
    if (manualRateCurrencies.length === 0) {
      setSelectedManualRateCurrency("");
      return;
    }
    if (
      selectedManualRateCurrency.trim() === "" ||
      !manualRateCurrencies.includes(selectedManualRateCurrency)
    ) {
      setSelectedManualRateCurrency(manualRateCurrencies[0]);
    }
  }, [manualRateCurrencies, selectedManualRateCurrency]);

  useEffect(() => {
    const currency = selectedManualRateCurrency.trim();
    if (!currency) {
      setSelectedExchangeRate(null);
      setLoadingSelectedExchangeRate(false);
      return;
    }

    let cancelled = false;
    setLoadingSelectedExchangeRate(true);
    void onFetchPlatformExchangeRate(currency)
      .then((rate) => {
        if (!cancelled) {
          setSelectedExchangeRate(rate);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedExchangeRate({
            currency,
            quote_currency: "USD",
            rate: null,
            source: "cached",
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSelectedExchangeRate(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [onFetchPlatformExchangeRate, selectedManualRateCurrency]);

  const overviewStats = useMemo(() => {
    if (!platformBillingSettings) return [];
    const enabledEvents = platformBillingSettings.notification_events.filter(
      (event) => event.email_enabled || event.telegram_enabled,
    ).length;
    const dirtyCount = visibleSections.filter((item) => sectionIsDirty(item.key)).length;
    return [
      {
        label: "Email",
        value: platformBillingSettings.email_notifications_enabled ? "Вкл" : "Выкл",
        tone: platformBillingSettings.email_notifications_enabled ? "good" : "muted",
      },
      {
        label: "Telegram",
        value: platformBillingSettings.telegram_notifications_enabled ? "Вкл" : "Выкл",
        tone: platformBillingSettings.telegram_notifications_enabled ? "good" : "muted",
      },
      {
        label: "Шаблоны",
        value: String(platformBillingSettings.notification_templates.length),
        tone: "default",
      },
      {
        label: "Черновики",
        value: dirtyCount > 0 ? String(dirtyCount) : "—",
        tone: dirtyCount > 0 ? "good" : "muted",
      },
      {
        label: "События",
        value: `${enabledEvents}/${platformBillingSettings.notification_events.length}`,
        tone: "default",
      },
    ];
  }, [platformBillingSettings, sectionDrafts, smtpBzApiKey, telegramBotToken, visibleSections]);

  async function handleSaveSection(section: SettingsSectionKey) {
    if (!platformBillingSettings) return;
    const draft = sectionDrafts[section] ?? {};
    const payload = applySectionDraft(platformBillingSettings, section, draft, {
      smtpBzApiKey: section === "email" ? smtpBzApiKey : undefined,
      telegramBotToken: section === "telegram" ? telegramBotToken : undefined,
    });
    setSavingSection(section);
    setSectionSaveMessage(null);
    try {
      await onUpdatePlatformSettings(payload);
      if (section === "email") setSmtpBzApiKey("");
      if (section === "telegram") setTelegramBotToken("");
      setSectionSaveMessage(`Раздел «${getSectionMeta(section).label}» сохранён.`);
    } finally {
      setSavingSection(null);
    }
  }

  function handleSelectSection(section: SettingsSectionKey) {
    setActiveSection(section);
    setActiveGroup(getGroupForSection(section));
  }

  function handleSubmitTenantPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantPolicyForm) return;
    onUpdateTenantPolicy(tenantPolicyForm);
  }

  function handleToggleNotificationEvent(
    code: string,
    channel: "email_enabled" | "telegram_enabled",
    enabled: boolean,
  ) {
    const eventsForm = getSectionForm("events");
    if (!eventsForm) return;
    updateSectionDraft("events", {
      notification_events: eventsForm.notification_events.map((item) =>
        item.code === code ? { ...item, [channel]: enabled } : item,
      ),
    });
  }

  async function handleCheckTelegramBot() {
    const telegramForm = getSectionForm("telegram");
    if (!telegramForm) return;
    setCheckingTelegramBot(true);
    setTelegramTestResult(null);
    setTelegramBotCheckError(null);
    try {
      const info = await onInspectPlatformTelegramBot({
        telegram_api_base_url: telegramForm.telegram_api_base_url,
        telegram_bot_token: telegramBotToken.trim() || null,
      });
      setTelegramBotInfo(info);
    } catch (err) {
      setTelegramBotInfo(null);
      setTelegramBotCheckError(
        err instanceof Error ? err.message : "Не удалось проверить Telegram-бота.",
      );
    } finally {
      setCheckingTelegramBot(false);
    }
  }

  async function handleSendTelegramTest() {
    const telegramForm = getSectionForm("telegram");
    if (!telegramForm || adminTelegramChatId.trim() === "") return;
    setSendingTelegramTest(true);
    setTelegramBotCheckError(null);
    try {
      const result = await onSendPlatformTelegramTest({
        admin_telegram_chat_id: adminTelegramChatId.trim(),
        telegram_api_base_url: telegramForm.telegram_api_base_url,
        telegram_bot_token: telegramBotToken.trim() || null,
      });
      setTelegramTestResult(result);
    } catch (err) {
      setTelegramTestResult(null);
      setTelegramBotCheckError(
        err instanceof Error ? err.message : "Не удалось отправить тестовое сообщение.",
      );
    } finally {
      setSendingTelegramTest(false);
    }
  }

  async function handleSendSmtpTest() {
    const emailForm = getSectionForm("email");
    if (!emailForm || smtpTestRecipient.trim() === "") return;
    setSendingSmtpTest(true);
    try {
      const result = await onSendPlatformSmtpBzTest({
        test_recipient_email: smtpTestRecipient.trim(),
        smtp_bz_api_base_url: emailForm.smtp_bz_api_base_url,
        smtp_bz_sender_email: emailForm.smtp_bz_sender_email,
        smtp_bz_sender_name: emailForm.smtp_bz_sender_name,
        smtp_bz_reply_to: emailForm.smtp_bz_reply_to,
        smtp_bz_tag: emailForm.smtp_bz_tag,
        smtp_bz_api_key: smtpBzApiKey.trim() || null,
      });
      setSmtpTestResult(result);
    } finally {
      setSendingSmtpTest(false);
    }
  }

  function toggleMobileSection(key: SettingsSectionKey) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function renderUnavailable() {
    if (loading) {
      return (
        <div className="aps-empty-state">
          <p className="muted-text">Загружаем настройки платформы…</p>
        </div>
      );
    }
    return (
      <div className="aps-empty-state">
        <p className="muted-text">Настройки пока не загружены.</p>
        <button className="ghost-button" onClick={() => void onReloadPlatformSettings()} type="button">
          Повторить загрузку
        </button>
      </div>
    );
  }

  function renderFeesSection() {
    const feesForm = getSectionForm("fees");
    if (!feesForm) return renderUnavailable();
    return (
      <div className="aps-stack">
        <FieldGrid>
          <label>
            <span>Комиссия провайдера (%)</span>
            <input
              type="number"
              step="0.0001"
              min="0"
              max="100"
              value={feesForm.provider_fee_percent}
              onChange={(event) =>
                updateSectionDraft("fees", { provider_fee_percent: event.target.value })
              }
            />
          </label>
          <label>
            <span>Наценка платформы (%)</span>
            <input
              type="number"
              step="0.0001"
              min="0"
              max="100"
              value={feesForm.default_markup_percent}
              onChange={(event) =>
                updateSectionDraft("fees", { default_markup_percent: event.target.value })
              }
            />
          </label>
          <label>
            <span>Минимум комиссии провайдера (USDT)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={feesForm.platform_markup_min_usdt}
              onChange={(event) =>
                updateSectionDraft("fees", { platform_markup_min_usdt: event.target.value })
              }
            />
          </label>
          <label>
            <span>Фикс комиссии платформы (USDT)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={feesForm.platform_fee_min_usdt}
              onChange={(event) =>
                updateSectionDraft("fees", { platform_fee_min_usdt: event.target.value })
              }
            />
          </label>
          <label>
            <span>Накрутка курса (%)</span>
            <input
              type="number"
              step="0.0001"
              value={feesForm.exchange_rate_markup_percent}
              onChange={(event) =>
                updateSectionDraft("fees", { exchange_rate_markup_percent: event.target.value })
              }
            />
          </label>
        </FieldGrid>
        <p className="muted-text aps-field-span-2" style={{ gridColumn: "1 / -1", marginTop: "0.5rem" }}>
          Каскад: % провайдера от gross (минимум в USDT), затем % платформы от остатка. Если у провайдера
          сработал минимум — платформа берёт свой фикс в USDT вместо процента. Мерчант видит одну строку
          «Комиссия». Наценку по клиентам можно переопределить в блоке «Правила клиента».
        </p>
      </div>
    );
  }

  function renderRatesSection() {
    const ratesForm = getSectionForm("rates");
    if (!ratesForm) return renderUnavailable();
    const currency = selectedManualRateCurrency;
    const currentRate = selectedExchangeRate?.rate ?? null;
    const manualRate = currency ? ratesForm.manual_exchange_rates?.[currency] ?? "" : "";
    const priceField = ratesForm.exchange_rate_price_field ?? "last";
    const rateSource = manualRate
      ? "Ручной"
      : formatExchangeRateSource(selectedExchangeRate?.source, priceField);

    return (
      <div className="aps-stack">
        <label className="aps-field-span-2">
          <span>Цена Crypto-Cash для курса</span>
          <select
            value={priceField}
            onChange={(event) =>
              updateSectionDraft("rates", {
                exchange_rate_price_field: event.target.value as ExchangeRatePriceField,
              })
            }
          >
            <option value="last">Last — lastPrice (последняя)</option>
            <option value="buy">Buy — цена покупки</option>
            <option value="sell">Sell — цена продажи</option>
          </select>
        </label>
        <p className="muted-text aps-field-span-2">
          Поле из JSON export Crypto-Cash. Применяется ко всем автоматическим курсам и settlement.
        </p>
        <label className="aps-field-span-2">
          <span>Токен</span>
          <select
            value={currency}
            onChange={(event) => setSelectedManualRateCurrency(event.target.value)}
          >
            {manualRateCurrencies.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <div className="aps-inline-status">
          <StatPill
            label="Текущий курс"
            value={
              loadingSelectedExchangeRate
                ? "Загрузка..."
                : currency
                  ? `${currentRate ?? "н/д"} USD`
                  : "н/д"
            }
            tone={currentRate ? "good" : "muted"}
          />
          <StatPill
            label="Источник"
            value={rateSource}
            tone={
              manualRate
                ? "good"
                : selectedExchangeRate?.source?.startsWith("crypto_cash_")
                  ? "default"
                  : "muted"
            }
          />
        </div>
        <FieldGrid>
          <label>
            <span>Ручной курс {currency || "токена"} → USD</span>
            <input
              type="number"
              step="0.00000001"
              value={manualRate}
              placeholder="Оставьте пустым для автокурса"
              onChange={(event) => {
                if (!currency) return;
                const nextRates = { ...(ratesForm.manual_exchange_rates ?? {}) };
                const nextValue = event.target.value.trim();
                if (nextValue === "") {
                  delete nextRates[currency];
                } else {
                  nextRates[currency] = nextValue;
                }
                updateSectionDraft("rates", { manual_exchange_rates: nextRates });
              }}
            />
          </label>
        </FieldGrid>
        <div className="aps-section-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={refreshingSelectedExchangeRate}
            onClick={() => {
              setRefreshingSelectedExchangeRate(true);
              void onRefreshPlatformExchangeRate()
                .then((result) => {
                  if (!currency) return;
                  return onFetchPlatformExchangeRate(currency).then((rate) => {
                    setSelectedExchangeRate(rate);
                  });
                })
                .finally(() => {
                  setRefreshingSelectedExchangeRate(false);
                });
            }}
          >
            {refreshingSelectedExchangeRate ? "Обновляем все курсы..." : "Обновить все курсы"}
          </button>
        </div>
        <p className="muted-text">
          Ручной курс имеет приоритет над сохраненным курсом из БД. Автоматические курсы обновляются в фоне раз в 10 минут и читаются системой уже из базы.
        </p>
      </div>
    );
  }

  function renderPayoutsSection() {
    const payoutsForm = getSectionForm("payouts");
    if (!payoutsForm) return renderUnavailable();
    return (
      <div className="aps-stack">
        <label className="aps-switch-card">
          <div>
            <strong>Разрешить кастомную наценку</strong>
            <p className="muted-text">Клиенты смогут переопределять глобальную наценку.</p>
          </div>
          <input
            type="checkbox"
            checked={payoutsForm.allow_tenant_markup_override}
            onChange={(event) =>
              updateSectionDraft("payouts", {
                allow_tenant_markup_override: event.target.checked,
              })
            }
          />
        </label>
        <label className="aps-switch-card">
          <div>
            <strong>Выплаты включены</strong>
            <p className="muted-text">Глобальный тумблер доступности выплат по платформе.</p>
          </div>
          <input
            type="checkbox"
            checked={payoutsForm.payouts_enabled}
            onChange={(event) =>
              updateSectionDraft("payouts", { payouts_enabled: event.target.checked })
            }
          />
        </label>
      </div>
    );
  }

  function renderBrandSection() {
    const brandForm = getSectionForm("brand");
    if (!brandForm) return renderUnavailable();
    return (
      <FieldGrid>
        <label>
          <span>Название бренда</span>
          <input
            value={brandForm.notification_brand_name}
            placeholder="NorenDigital"
            onChange={(event) =>
              updateSectionDraft("brand", { notification_brand_name: event.target.value })
            }
          />
        </label>
        <label className="aps-field-span-2">
          <span>Файл логотипа</span>
          <BrandLogoUploader
            disabled={loading}
            logoUrl={brandForm.notification_logo_url}
            onRemoveUploaded={onRemoveBrandLogo}
            onUpload={onUploadBrandLogo}
          />
        </label>
        <label className="aps-field-span-2">
          <span>URL логотипа (вручную)</span>
          <input
            value={brandForm.notification_logo_url ?? ""}
            onChange={(event) =>
              updateSectionDraft("brand", {
                notification_logo_url: event.target.value.trim() === "" ? null : event.target.value,
              })
            }
            placeholder="https://example.com/logo.svg или /uploads/brand/logo.svg"
          />
          <p className="muted-text aps-field-hint">
            Загрузите файл выше или укажите внешний URL. SVG/PNG используются на лендинге, pay-странице, docs и в письмах.
          </p>
        </label>
        <label className="aps-field-span-2">
          <span>Основной URL</span>
          <input
            value={brandForm.notification_primary_url ?? ""}
            onChange={(event) =>
              updateSectionDraft("brand", {
                notification_primary_url:
                  event.target.value.trim() === "" ? null : event.target.value,
              })
            }
          />
        </label>
      </FieldGrid>
    );
  }

  function renderSeoSection() {
    const seoForm = getSectionForm("seo");
    if (!seoForm) return renderUnavailable();
    return (
      <FieldGrid>
        <label>
          <span>Title (заголовок страницы)</span>
          <input
            value={seoForm.seo_title ?? ""}
            onChange={(event) =>
              updateSectionDraft("seo", {
                seo_title: event.target.value.trim() === "" ? null : event.target.value,
              })
            }
            placeholder="NorenDigital — приём платежей"
          />
        </label>
        <label>
          <span>Description (описание)</span>
          <input
            value={seoForm.seo_description ?? ""}
            onChange={(event) =>
              updateSectionDraft("seo", {
                seo_description: event.target.value.trim() === "" ? null : event.target.value,
              })
            }
            placeholder="Принимайте криптовалютные платежи"
          />
        </label>
        <label className="aps-field-span-2">
          <span>Keywords (ключевые слова)</span>
          <input
            value={seoForm.seo_keywords ?? ""}
            onChange={(event) =>
              updateSectionDraft("seo", {
                seo_keywords: event.target.value.trim() === "" ? null : event.target.value,
              })
            }
            placeholder="crypto, payments, merchant, приём платежей"
          />
        </label>
        <label>
          <span>Favicon URL</span>
          <input
            value={seoForm.seo_favicon_url ?? ""}
            onChange={(event) =>
              updateSectionDraft("seo", {
                seo_favicon_url: event.target.value.trim() === "" ? null : event.target.value,
              })
            }
            placeholder="https://example.com/favicon.ico"
          />
        </label>
        <label>
          <span>OG Image (соцсети)</span>
          <input
            value={seoForm.seo_og_image_url ?? ""}
            onChange={(event) =>
              updateSectionDraft("seo", {
                seo_og_image_url: event.target.value.trim() === "" ? null : event.target.value,
              })
            }
            placeholder="https://example.com/og-image.png"
          />
        </label>
        <label>
          <span>Robots</span>
          <select
            value={seoForm.seo_robots ?? "index, follow"}
            onChange={(event) => updateSectionDraft("seo", { seo_robots: event.target.value })}
          >
            <option value="index, follow">Index, Follow</option>
            <option value="noindex, follow">No Index, Follow</option>
            <option value="index, nofollow">Index, No Follow</option>
            <option value="noindex, nofollow">No Index, No Follow</option>
          </select>
        </label>
        <label>
          <span>Canonical URL</span>
          <input
            value={seoForm.seo_canonical_url ?? ""}
            onChange={(event) =>
              updateSectionDraft("seo", {
                seo_canonical_url: event.target.value.trim() === "" ? null : event.target.value,
              })
            }
            placeholder="https://example.com/"
          />
        </label>
      </FieldGrid>
    );
  }

  function renderEmailSection() {
    const emailForm = getSectionForm("email");
    if (!emailForm) return renderUnavailable();
    return (
      <div className="aps-stack">
        <div className="aps-inline-status">
          <StatPill
            label="SMTP"
            value={emailForm.smtp_bz_enabled ? "Активен" : "Отключен"}
            tone={emailForm.smtp_bz_enabled ? "good" : "muted"}
          />
          <StatPill
            label="API key"
            value={
              platformBillingSettings?.smtp_bz_api_key_configured ? "Сохранён" : "Не задан"
            }
            tone={platformBillingSettings?.smtp_bz_api_key_configured ? "good" : "muted"}
          />
        </div>
        <FieldGrid>
          <label className="aps-switch-inline">
            <span>Email-уведомления включены</span>
            <input
              type="checkbox"
              checked={emailForm.email_notifications_enabled}
              onChange={(event) =>
                updateSectionDraft("email", { email_notifications_enabled: event.target.checked })
              }
            />
          </label>
          <label className="aps-switch-inline">
            <span>SMTP.bz включён</span>
            <input
              type="checkbox"
              checked={emailForm.smtp_bz_enabled}
              onChange={(event) =>
                updateSectionDraft("email", { smtp_bz_enabled: event.target.checked })
              }
            />
          </label>
          <label>
            <span>SMTP API URL</span>
            <input
              value={emailForm.smtp_bz_api_base_url}
              onChange={(event) =>
                updateSectionDraft("email", { smtp_bz_api_base_url: event.target.value })
              }
            />
          </label>
          <label>
            <span>Email отправителя</span>
            <input
              value={emailForm.smtp_bz_sender_email}
              onChange={(event) =>
                updateSectionDraft("email", { smtp_bz_sender_email: event.target.value })
              }
            />
          </label>
          <label>
            <span>Имя отправителя</span>
            <input
              value={emailForm.smtp_bz_sender_name}
              onChange={(event) =>
                updateSectionDraft("email", { smtp_bz_sender_name: event.target.value })
              }
            />
          </label>
          <label>
            <span>Reply-To</span>
            <input
              value={emailForm.smtp_bz_reply_to ?? ""}
              onChange={(event) =>
                updateSectionDraft("email", {
                  smtp_bz_reply_to: event.target.value.trim() === "" ? null : event.target.value,
                })
              }
            />
          </label>
          <label>
            <span>Тег</span>
            <input
              value={emailForm.smtp_bz_tag ?? ""}
              onChange={(event) =>
                updateSectionDraft("email", {
                  smtp_bz_tag: event.target.value.trim() === "" ? null : event.target.value,
                })
              }
            />
          </label>
          <label>
            <span>Новый SMTP API key</span>
            <input value={smtpBzApiKey} onChange={(event) => setSmtpBzApiKey(event.target.value)} />
          </label>
        </FieldGrid>
        <div className="aps-test-box">
          <div>
            <strong>Тестовая отправка</strong>
            <p className="muted-text">Проверьте конфигурацию на реальном адресе.</p>
          </div>
          <div className="aps-test-actions">
            <input
              placeholder="recipient@example.com"
              value={smtpTestRecipient}
              onChange={(event) => setSmtpTestRecipient(event.target.value)}
            />
            <button
              className="ghost-button"
              type="button"
              onClick={handleSendSmtpTest}
              disabled={sendingSmtpTest || smtpTestRecipient.trim() === ""}
            >
              {sendingSmtpTest ? "Отправляем..." : "Отправить тест"}
            </button>
          </div>
          {smtpTestResult ? (
            <p className="muted-text">Письмо отправлено на {smtpTestResult.recipient_email}.</p>
          ) : null}
        </div>
      </div>
    );
  }

  function renderTelegramSection() {
    const telegramForm = getSectionForm("telegram");
    if (!telegramForm) return renderUnavailable();
    return (
      <div className="aps-stack">
        <div className="aps-inline-status">
          <StatPill
            label="Канал"
            value={telegramForm.telegram_notifications_enabled ? "Активен" : "Отключен"}
            tone={telegramForm.telegram_notifications_enabled ? "good" : "muted"}
          />
          <StatPill
            label="Токен"
            value={
              platformBillingSettings?.telegram_bot_token_configured ? "Сохранён" : "Не задан"
            }
            tone={platformBillingSettings?.telegram_bot_token_configured ? "good" : "muted"}
          />
        </div>
        <FieldGrid>
          <label className="aps-switch-inline">
            <span>Telegram-уведомления включены</span>
            <input
              type="checkbox"
              checked={telegramForm.telegram_notifications_enabled}
              onChange={(event) =>
                updateSectionDraft("telegram", {
                  telegram_notifications_enabled: event.target.checked,
                })
              }
            />
          </label>
          <label className="aps-field-span-2">
            <span>Telegram API URL</span>
            <input
              value={telegramForm.telegram_api_base_url}
              onChange={(event) =>
                updateSectionDraft("telegram", { telegram_api_base_url: event.target.value })
              }
            />
          </label>
          <label className="aps-field-span-2">
            <span>Новый токен бота</span>
            <input
              type="password"
              autoComplete="off"
              placeholder="Вставьте токен из @BotFather (1234567890:AAH…)"
              value={telegramBotToken}
              onChange={(event) => {
                setTelegramBotToken(event.target.value);
                setTelegramBotCheckError(null);
              }}
            />
            <small className="muted-text">
              Для проверки без сохранения вставьте токен сюда и нажмите «Проверить бота». Чтобы записать в
              БД — «Сохранить раздел» внизу.
            </small>
          </label>
        </FieldGrid>
        <div className="aps-test-box">
          <div>
            <strong>Проверка интеграции</strong>
            <p className="muted-text">Проверьте бота и отправьте тестовое сообщение администратору.</p>
          </div>
          <div className="aps-test-actions">
            <button
              className="ghost-button"
              type="button"
              onClick={handleCheckTelegramBot}
              disabled={checkingTelegramBot}
            >
              {checkingTelegramBot ? "Проверяем..." : "Проверить бота"}
            </button>
            <input
              placeholder="Chat ID администратора"
              value={adminTelegramChatId}
              onChange={(event) => setAdminTelegramChatId(event.target.value)}
            />
            <button
              className="ghost-button"
              type="button"
              onClick={handleSendTelegramTest}
              disabled={sendingTelegramTest || adminTelegramChatId.trim() === ""}
            >
              {sendingTelegramTest ? "Отправляем..." : "Отправить тест"}
            </button>
          </div>
          {telegramBotCheckError ? (
            <p className="aps-telegram-check-error" role="alert">
              {telegramBotCheckError}
            </p>
          ) : null}
          {telegramBotInfo?.display_name || telegramBotInfo?.username ? (
            <p className="muted-text aps-telegram-check-ok">
              Бот подключён:{" "}
              {telegramBotInfo.display_name ??
                (telegramBotInfo.username ? `@${telegramBotInfo.username}` : "OK")}
              {telegramBotInfo.token_masked ? ` · токен ${telegramBotInfo.token_masked}` : ""}
            </p>
          ) : platformBillingSettings?.telegram_bot_token_configured ? (
            <p className="muted-text">
              В БД сохранён токен
              {platformBillingSettings.telegram_bot_token_masked
                ? ` ${platformBillingSettings.telegram_bot_token_masked}`
                : ""}
              . Нажмите «Проверить бота» — если токен отозван в @BotFather, вставьте новый выше.
            </p>
          ) : (
            <p className="muted-text">Токен бота ещё не сохранён.</p>
          )}
          {telegramTestResult ? (
            <p className="muted-text">Сообщение отправлено в чат {telegramTestResult.chat_id}.</p>
          ) : null}
        </div>
      </div>
    );
  }

  function ensureOpsTelegramSettings(): OpsTelegramSettings {
    const opsForm = getSectionForm("ops-chat");
    return (
      opsForm?.ops_telegram ?? {
        enabled: false,
        chat_id: null,
        topics: [],
        events: [],
      }
    );
  }

  function updateOpsTelegram(patch: Partial<OpsTelegramSettings>) {
    const current = ensureOpsTelegramSettings();
    updateSectionDraft("ops-chat", {
      ops_telegram: {
        ...current,
        ...patch,
      },
    });
  }

  function updateOpsTopic(
    key: string,
    patch: { thread_id?: number | null; enabled?: boolean },
  ) {
    const ops = ensureOpsTelegramSettings();
    updateOpsTelegram({
      topics: ops.topics.map((item) =>
        item.key === key ? { ...item, ...patch } : item,
      ),
    });
  }

  function toggleOpsEvent(code: string, enabled: boolean) {
    const ops = ensureOpsTelegramSettings();
    updateOpsTelegram({
      events: ops.events.map((item) =>
        item.code === code ? { ...item, enabled } : item,
      ),
    });
  }

  async function handleProvisionOpsTopics() {
    if (!onProvisionOpsTelegramTopics) return;
    const ops = ensureOpsTelegramSettings();
    const chatId = (ops.chat_id ?? "").trim();
    if (!chatId) {
      setOpsChatError("Сначала укажите chat_id форум-чата.");
      return;
    }
    setProvisioningOpsTopics(true);
    setOpsChatError(null);
    setOpsChatMessage(null);
    try {
      const result = await onProvisionOpsTelegramTopics(chatId);
      await onReloadPlatformSettings();
      const createdCount = Object.keys(result.created_topics).length;
      setOpsChatMessage(
        createdCount > 0
          ? `Создано топиков: ${createdCount}. Thread ID сохранены в настройках.`
          : "Все топики уже были созданы ранее.",
      );
    } catch (err) {
      setOpsChatError(
        err instanceof Error ? err.message : "Не удалось создать топики форума.",
      );
    } finally {
      setProvisioningOpsTopics(false);
    }
  }

  async function handleOpsTopicTest(topicKey: string) {
    if (!onSendOpsTelegramTopicTest) return;
    const ops = ensureOpsTelegramSettings();
    const chatId = (ops.chat_id ?? "").trim();
    const topic = ops.topics.find((item) => item.key === topicKey);
    const threadId = topic?.thread_id ?? null;
    if (!chatId) {
      setOpsChatError("Сначала укажите chat_id форум-чата.");
      return;
    }
    if (threadId == null) {
      setOpsChatError(
        `Для топика «${topicKey}» не задан thread_id. Создайте топики через бота или укажите thread_id вручную.`,
      );
      return;
    }
    setOpsTopicTestKey(topicKey);
    setOpsChatError(null);
    setOpsChatMessage(null);
    try {
      await onSendOpsTelegramTopicTest({
        topic_key: topicKey,
        chat_id: chatId,
        thread_id: threadId,
      });
      await onReloadPlatformSettings();
      setOpsChatMessage(`Тест отправлен в топик «${topicKey}».`);
    } catch (err) {
      setOpsChatError(
        err instanceof Error ? err.message : "Не удалось отправить тест в топик.",
      );
    } finally {
      setOpsTopicTestKey(null);
    }
  }

  function renderOpsChatSection() {
    if (!getSectionForm("ops-chat") || !isSuperadmin) return renderUnavailable();
    const ops = ensureOpsTelegramSettings();

    return (
        <div className="aps-field-stack">
          <p className="muted-text">
            Отдельный форум-чат для команды платформы. Мерчанты сюда не попадают — используется тот же
            бот, что и для уведомлений, но другой chat_id и топики (Topics). Бот должен быть админом группы
            с правом «Управление топиками».
          </p>
          <ol className="muted-text aps-ops-setup-list">
            <li>Создайте супергруппу, включите Topics (форум).</li>
            <li>Добавьте бота админом, дайте can_manage_topics.</li>
            <li>Узнайте chat_id (@userinfobot или getUpdates) и введите ниже.</li>
            <li>Нажмите «Создать топики» — chat_id сохранится автоматически.</li>
          </ol>
          <FieldGrid>
            <StatPill
              label="Служебный чат"
              value={ops.enabled ? "Вкл" : "Выкл"}
              tone={ops.enabled ? "good" : "muted"}
            />
            <StatPill
              label="Топиков"
              value={String(ops.topics.filter((item) => item.thread_id != null).length)}
              tone="default"
            />
          </FieldGrid>
          <label className="aps-switch-inline">
            <span>Служебные уведомления включены</span>
            <input
              type="checkbox"
              checked={ops.enabled}
              onChange={(event) => updateOpsTelegram({ enabled: event.target.checked })}
            />
          </label>
          <label>
            <span>Chat ID форум-чата</span>
            <input
              value={ops.chat_id ?? ""}
              onChange={(event) => updateOpsTelegram({ chat_id: event.target.value.trim() || null })}
              placeholder="-1001234567890"
            />
          </label>
          <div className="aps-inline-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={provisioningOpsTopics || !onProvisionOpsTelegramTopics}
              onClick={() => void handleProvisionOpsTopics()}
            >
              {provisioningOpsTopics ? "Создаём..." : "Создать топики через бота"}
            </button>
          </div>
          <div className="aps-ops-topics-table">
            {ops.topics.map((topic) => (
              <div key={topic.key} className="aps-ops-topic-row">
                <div className="aps-ops-topic-copy">
                  <strong>{topic.title}</strong>
                  <span className="muted-text">{topic.description}</span>
                </div>
                <label>
                  <span className="muted-text">thread_id</span>
                  <input
                    type="number"
                    value={topic.thread_id ?? ""}
                    onChange={(event) => {
                      const raw = event.target.value.trim();
                      updateOpsTopic(topic.key, {
                        thread_id: raw === "" ? null : Number(raw),
                      });
                    }}
                    placeholder="auto"
                  />
                </label>
                <label className="aps-switch-inline">
                  <span>Вкл</span>
                  <input
                    type="checkbox"
                    checked={topic.enabled}
                    onChange={(event) =>
                      updateOpsTopic(topic.key, { enabled: event.target.checked })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!onSendOpsTelegramTopicTest || opsTopicTestKey === topic.key}
                  onClick={() => void handleOpsTopicTest(topic.key)}
                >
                  {opsTopicTestKey === topic.key ? "..." : "Тест"}
                </button>
              </div>
            ))}
          </div>
          {ops.events.length > 0 ? (
            <div className="aps-events-list">
              <p className="eyebrow">События → топики</p>
              {ops.events.map((item) => (
                <div key={item.code} className="aps-event-row">
                  <div className="aps-event-copy">
                    <strong>{item.code}</strong>
                    <span className="muted-text">{item.topic_title}</span>
                  </div>
                  <label className="aps-switch-inline">
                    <span>В ops-чат</span>
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(event) => toggleOpsEvent(item.code, event.target.checked)}
                    />
                  </label>
                </div>
              ))}
            </div>
          ) : null}
          {opsChatError ? (
            <p className="aps-telegram-check-error" role="alert">
              {opsChatError}
            </p>
          ) : null}
          {opsChatMessage ? <p className="muted-text">{opsChatMessage}</p> : null}
        </div>
    );
  }

  function renderTemplatesSection() {
    const templatesForm = getSectionForm("templates");
    if (!templatesForm) return renderUnavailable();
    return (
      <NotificationTemplatesWorkspace
        loadedSettings={platformBillingSettings}
        platformSettings={templatesForm}
        setPlatformSettings={(updater) => {
          const current = getSectionForm("templates");
          if (!current) return;
          const next =
            typeof updater === "function"
              ? updater(current)
              : updater;
          if (!next) return;
          updateSectionDraft("templates", {
            notification_templates: next.notification_templates,
          });
        }}
        smtpBzApiKey={smtpBzApiKey}
        telegramBotToken={telegramBotToken}
        onPreviewNotificationTemplate={onPreviewNotificationTemplate}
        onSendNotificationTemplateTest={onSendNotificationTemplateTest}
      />
    );
  }

  function renderEventsSection() {
    const eventsForm = getSectionForm("events");
    if (!eventsForm) return renderUnavailable();
    return (
      <div className="aps-events-list">
        {eventsForm.notification_events.map((item) => (
          <div key={item.code} className="aps-event-row">
            <div className="aps-event-copy">
              <strong>{item.title}</strong>
              <span className="muted-text">{item.code}</span>
            </div>
            <div className="aps-event-controls">
              <label className="aps-switch-inline">
                <span>Email</span>
                <input
                  type="checkbox"
                  checked={item.email_enabled}
                  onChange={(event) =>
                    handleToggleNotificationEvent(item.code, "email_enabled", event.target.checked)
                  }
                />
              </label>
              <label className="aps-switch-inline">
                <span>Telegram</span>
                <input
                  type="checkbox"
                  checked={item.telegram_enabled}
                  onChange={(event) =>
                    handleToggleNotificationEvent(item.code, "telegram_enabled", event.target.checked)
                  }
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderTenantSection() {
    return (
      <div className="aps-stack">
        <FieldGrid>
          <label className="aps-field-span-2">
            <span>Клиент</span>
            <select
              value={selectedTenantId ?? ""}
              onChange={(event) => onSelectTenant(event.target.value)}
            >
              <option disabled value="">
                Выберите клиента
              </option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.status})
                </option>
              ))}
            </select>
          </label>
        </FieldGrid>
        {tenantPolicyForm ? (
          <form className="aps-stack" onSubmit={handleSubmitTenantPolicy}>
            <FieldGrid>
              <label>
                <span>Наценка клиента (%)</span>
                <input
                  type="number"
                  step="0.0001"
                  value={tenantPolicyForm.custom_markup_percent ?? ""}
                  onChange={(event) =>
                    setTenantPolicyForm({
                      ...tenantPolicyForm,
                      custom_markup_percent:
                        event.target.value.trim() === "" ? null : event.target.value,
                    })
                  }
                />
              </label>
            </FieldGrid>
            <div className="aps-stack">
              <label className="aps-switch-card">
                <div>
                  <strong>Разрешить выплаты</strong>
                  <p className="muted-text">Локально включает выплаты для выбранного клиента.</p>
                </div>
                <input
                  type="checkbox"
                  checked={tenantPolicyForm.payouts_enabled}
                  onChange={(event) =>
                    setTenantPolicyForm({
                      ...tenantPolicyForm,
                      payouts_enabled: event.target.checked,
                    })
                  }
                />
              </label>
              <label className="aps-switch-card">
                <div>
                  <strong>Ручная проверка выплат</strong>
                  <p className="muted-text">Каждая выплата пойдёт через ручную модерацию.</p>
                </div>
                <input
                  type="checkbox"
                  checked={tenantPolicyForm.requires_manual_payout_review}
                  onChange={(event) =>
                    setTenantPolicyForm({
                      ...tenantPolicyForm,
                      requires_manual_payout_review: event.target.checked,
                    })
                  }
                />
              </label>
            </div>
            <div className="aps-inline-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={loading || !selectedTenantId}
              >
                {loading ? "Сохраняем..." : "Сохранить правила клиента"}
              </button>
            </div>
          </form>
        ) : (
          <div className="aps-empty-state">
            <p className="muted-text">
              Выберите клиента, чтобы открыть его индивидуальные правила.
            </p>
          </div>
        )}
      </div>
    );
  }

  const renderSectionContent: Record<SettingsSectionKey, () => ReactNode> = {
    fees: renderFeesSection,
    rates: renderRatesSection,
    payouts: renderPayoutsSection,
    brand: renderBrandSection,
    seo: renderSeoSection,
    email: renderEmailSection,
    telegram: renderTelegramSection,
    "ops-chat": renderOpsChatSection,
    templates: renderTemplatesSection,
    events: renderEventsSection,
    tenant: renderTenantSection,
  };

  function handleDiscardSection(section: SettingsSectionKey) {
    if (!platformBillingSettings) return;
    setSectionDrafts((prev) => ({
      ...prev,
      [section]: createSectionDrafts(platformBillingSettings, [section])[section],
    }));
    if (section === "email") setSmtpBzApiKey("");
    if (section === "telegram") setTelegramBotToken("");
  }

  function renderSectionActions(section: SettingsSectionKey) {
    if (section === "tenant") {
      return null;
    }

    const dirty = sectionIsDirty(section);
    const isSaving = savingSection === section;
    const isInitialLoading = loading && !platformBillingSettings;

    return (
      <div className="aps-inline-actions">
        <button
          className="primary-button"
          type="button"
          onClick={() => void handleSaveSection(section)}
          disabled={isInitialLoading || isSaving || !dirty}
        >
          {isSaving ? "Сохраняем..." : getSaveButtonLabel(section)}
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={() => handleDiscardSection(section)}
          disabled={isInitialLoading || isSaving || !dirty}
        >
          Сбросить
        </button>
        <p className="muted-text aps-save-hint">
          Сохраняется только этот раздел — остальные настройки не затрагиваются.
        </p>
      </div>
    );
  }

  return (
    <div className="pw-platform-settings platform-settings-page aps-page">
      <div className="pw-platform-settings-top">
        <p className="muted-text pw-platform-settings-intro">
          Настройки сгруппированы по четырём блокам: комиссии, тарификация, уведомления и интеграции.
          Каждый подраздел сохраняется отдельно — можно менять Email, не трогая комиссии и шаблоны.
        </p>
        <div className="pw-platform-settings-stats aps-hero-stats">
          {overviewStats.map((item) => (
            <StatPill
              key={item.label}
              label={item.label}
              value={item.value}
              tone={item.tone}
            />
          ))}
        </div>
      </div>

      {sectionSaveMessage ? (
        <p className="aps-section-save-message muted-text" role="status">
          {sectionSaveMessage}
        </p>
      ) : null}

      <div className="aps-layout">
        <aside className="aps-sidebar">
          <div className="aps-sidebar-card">
            <p className="eyebrow">Категории</p>
            <nav className="aps-nav aps-nav-grouped" aria-label="Навигация по настройкам">
              {visibleGroups.map((group) => (
                <div key={group.key} className="aps-nav-group">
                  <button
                    type="button"
                    className={`aps-nav-group-trigger ${activeGroup === group.key ? "active" : ""}`}
                    onClick={() => {
                      setActiveGroup(group.key);
                      const firstSection = group.sections[0];
                      if (firstSection) handleSelectSection(firstSection);
                    }}
                  >
                    <strong>{group.label}</strong>
                    <span>{group.description}</span>
                  </button>
                  <div className="aps-nav-group-items">
                    {group.sections.map((sectionKey) => {
                      const section = getSectionMeta(sectionKey);
                      const dirty = sectionIsDirty(sectionKey);
                      return (
                        <button
                          key={section.key}
                          type="button"
                          className={`aps-nav-link ${activeSection === section.key ? "active" : ""}`}
                          onClick={() => handleSelectSection(section.key)}
                        >
                          <span className="aps-nav-index">{section.icon}</span>
                          <span className="aps-nav-copy">
                            <strong>
                              {section.label}
                              {dirty ? <span className="aps-nav-dirty" aria-hidden /> : null}
                            </strong>
                            <span>{section.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
            <p className="muted-text aps-sidebar-note">
              Несохранённые разделы отмечены точкой. «Сбросить» возвращает значения с сервера.
            </p>
          </div>
        </aside>

        <div className="aps-main">
          <div className="aps-mobile-sections">
            {visibleGroups.map((group) => (
              <div key={group.key} className="aps-mobile-group">
                <p className="aps-mobile-group-label">{group.label}</p>
                {group.sections.map((sectionKey) => {
                  const section = getSectionMeta(sectionKey);
                  return (
                    <div key={section.key} className="aps-mobile-item">
                      <button
                        type="button"
                        className="aps-mobile-trigger"
                        aria-expanded={expandedSections.has(section.key)}
                        onClick={() => toggleMobileSection(section.key)}
                      >
                        <span className="aps-mobile-trigger-copy">
                          <span className="aps-section-mark">{section.icon}</span>
                          <span>
                            <strong>
                              {section.label}
                              {sectionIsDirty(section.key) ? (
                                <span className="aps-section-dirty">Изменено</span>
                              ) : null}
                            </strong>
                            <small>{section.description}</small>
                          </span>
                        </span>
                        <span className="aps-mobile-chevron">⌄</span>
                      </button>
                      {expandedSections.has(section.key) ? (
                        <div className="aps-mobile-body">
                          <SectionShell
                            meta={section}
                            dirty={sectionIsDirty(section.key)}
                            actions={renderSectionActions(section.key)}
                          >
                            {renderSectionContent[section.key]()}
                          </SectionShell>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="aps-desktop-sections">
            {visibleSections
              .filter((section) => section.key === activeSection)
              .map((section) => (
                <SectionShell
                  key={section.key}
                  meta={section}
                  dirty={sectionIsDirty(section.key)}
                  actions={renderSectionActions(section.key)}
                >
                  {renderSectionContent[section.key]()}
                </SectionShell>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}


import { FormEvent, useEffect, useMemo, useState } from "react";

import type {
  AssetAvailabilityPayload,
  NotificationTemplateItem,
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
import { AssetAvailabilityPanel } from "./AssetAvailabilityPanel";

type AdminPlatformSettingsSectionProps = {
  loading: boolean;
  platformBillingSettings: PlatformBillingSettings | null;
  selectedTenantBillingPolicy: TenantBillingPolicy | null;
  selectedTenantId: string | null;
  tenants: TenantItem[];
  adminAssetRates: RateItem[];
  onSelectTenant: (tenantId: string) => void;
  onUpdatePlatformSettings: (payload: PlatformBillingSettings) => void;
  onInspectPlatformTelegramBot: (
    payload: TelegramBotInspectPayload,
  ) => Promise<TelegramBotIdentity>;
  onSendPlatformTelegramTest: (
    payload: TelegramAdminTestPayload,
  ) => Promise<TelegramAdminTestResponse>;
  onSendPlatformSmtpBzTest: (
    payload: SmtpBzTestPayload,
  ) => Promise<SmtpBzTestResponse>;
  onUpdateTenantPolicy: (payload: Omit<TenantBillingPolicy, "tenant_id">) => void;
  onUpdateAssetAvailability: (payload: AssetAvailabilityPayload) => void;
};

export function AdminPlatformSettingsSection({
  loading,
  platformBillingSettings,
  selectedTenantBillingPolicy,
  selectedTenantId,
  tenants,
  adminAssetRates,
  onSelectTenant,
  onUpdatePlatformSettings,
  onInspectPlatformTelegramBot,
  onSendPlatformTelegramTest,
  onSendPlatformSmtpBzTest,
  onUpdateTenantPolicy,
  onUpdateAssetAvailability,
}: AdminPlatformSettingsSectionProps) {
  const [platformSettingsForm, setPlatformSettingsForm] =
    useState<PlatformBillingSettings | null>(platformBillingSettings);
  const [smtpBzApiKey, setSmtpBzApiKey] = useState("");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramBotInfo, setTelegramBotInfo] = useState<TelegramBotIdentity | null>(null);
  const [adminTelegramChatId, setAdminTelegramChatId] = useState("");
  const [telegramTestResult, setTelegramTestResult] =
    useState<TelegramAdminTestResponse | null>(null);
  const [checkingTelegramBot, setCheckingTelegramBot] = useState(false);
  const [sendingTelegramTest, setSendingTelegramTest] = useState(false);
  const [smtpTestRecipient, setSmtpTestRecipient] = useState("");
  const [smtpTestResult, setSmtpTestResult] = useState<SmtpBzTestResponse | null>(null);
  const [sendingSmtpTest, setSendingSmtpTest] = useState(false);
  const [tenantPolicyForm, setTenantPolicyForm] = useState<Omit<
    TenantBillingPolicy,
    "tenant_id"
  > | null>(null);
  const [templateEventCode, setTemplateEventCode] = useState("");

  useEffect(() => {
    setPlatformSettingsForm(platformBillingSettings);
    setSmtpBzApiKey("");
    setTelegramBotToken("");
    setAdminTelegramChatId("");
    setTelegramTestResult(null);
    setSmtpTestRecipient("");
    setSmtpTestResult(null);
    if (platformBillingSettings) {
      setTemplateEventCode(platformBillingSettings.notification_templates[0]?.code ?? "");
      setTelegramBotInfo({
        token_configured: platformBillingSettings.telegram_bot_token_configured,
        token_masked: platformBillingSettings.telegram_bot_token_masked ?? null,
        api_base_url: platformBillingSettings.telegram_api_base_url,
        bot_id: null,
        username: null,
        first_name: null,
        display_name: null,
        checked_with_override: false,
      });
    } else {
      setTemplateEventCode("");
      setTelegramBotInfo(null);
    }
  }, [platformBillingSettings]);

  useEffect(() => {
    if (!selectedTenantBillingPolicy) {
      setTenantPolicyForm(null);
      return;
    }
    setTenantPolicyForm({
      custom_markup_percent: selectedTenantBillingPolicy.custom_markup_percent,
      custom_turnover_fee_percent: selectedTenantBillingPolicy.custom_turnover_fee_percent,
      payouts_enabled: selectedTenantBillingPolicy.payouts_enabled,
      requires_manual_payout_review: selectedTenantBillingPolicy.requires_manual_payout_review,
    });
  }, [selectedTenantBillingPolicy]);

  const selectedTemplate = useMemo(() => {
    if (!platformSettingsForm) {
      return null;
    }
    return (
      platformSettingsForm.notification_templates.find(
        (item) => item.code === templateEventCode,
      ) ?? platformSettingsForm.notification_templates[0] ?? null
    );
  }, [platformSettingsForm, templateEventCode]);

  function handleSubmitPlatformSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!platformSettingsForm) {
      return;
    }
    onUpdatePlatformSettings({
      ...platformSettingsForm,
      smtp_bz_api_key: smtpBzApiKey.trim() || null,
      telegram_bot_token: telegramBotToken.trim() || null,
    });
    setSmtpBzApiKey("");
    setTelegramBotToken("");
  }

  function handleSubmitTenantPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantPolicyForm) {
      return;
    }
    onUpdateTenantPolicy(tenantPolicyForm);
  }

  function handleToggleNotificationEvent(
    code: string,
    channel: "email_enabled" | "telegram_enabled",
    enabled: boolean,
  ) {
    if (!platformSettingsForm) {
      return;
    }
    setPlatformSettingsForm({
      ...platformSettingsForm,
      notification_events: (platformSettingsForm.notification_events ?? []).map((item) =>
        item.code === code ? { ...item, [channel]: enabled } : item,
      ),
    });
  }

  function handleTemplateFieldChange(
    code: string,
    field: keyof Pick<NotificationTemplateItem, "email_subject" | "email_body" | "telegram_body">,
    value: string,
  ) {
    if (!platformSettingsForm) {
      return;
    }
    setPlatformSettingsForm({
      ...platformSettingsForm,
      notification_templates: platformSettingsForm.notification_templates.map((template) =>
        template.code === code ? { ...template, [field]: value.trim() === "" ? null : value } : template,
      ),
    });
  }

  async function handleCheckTelegramBot() {
    if (!platformSettingsForm) return;
    setCheckingTelegramBot(true);
    setTelegramTestResult(null);
    try {
      const info = await onInspectPlatformTelegramBot({
        telegram_api_base_url: platformSettingsForm.telegram_api_base_url,
        telegram_bot_token: telegramBotToken.trim() || null,
      });
      setTelegramBotInfo(info);
    } finally {
      setCheckingTelegramBot(false);
    }
  }

  async function handleSendTelegramTest() {
    if (!platformSettingsForm || adminTelegramChatId.trim() === "") return;
    setSendingTelegramTest(true);
    try {
      const result = await onSendPlatformTelegramTest({
        admin_telegram_chat_id: adminTelegramChatId.trim(),
        telegram_api_base_url: platformSettingsForm.telegram_api_base_url,
        telegram_bot_token: telegramBotToken.trim() || null,
      });
      setTelegramTestResult(result);
    } finally {
      setSendingTelegramTest(false);
    }
  }

  async function handleSendSmtpTest() {
    if (!platformSettingsForm || smtpTestRecipient.trim() === "") return;
    setSendingSmtpTest(true);
    try {
      const result = await onSendPlatformSmtpBzTest({
        test_recipient_email: smtpTestRecipient.trim(),
        smtp_bz_api_base_url: platformSettingsForm.smtp_bz_api_base_url,
        smtp_bz_sender_email: platformSettingsForm.smtp_bz_sender_email,
        smtp_bz_sender_name: platformSettingsForm.smtp_bz_sender_name,
        smtp_bz_reply_to: platformSettingsForm.smtp_bz_reply_to,
        smtp_bz_tag: platformSettingsForm.smtp_bz_tag,
        smtp_bz_api_key: smtpBzApiKey.trim() || null,
      });
      setSmtpTestResult(result);
    } finally {
      setSendingSmtpTest(false);
    }
  }

  return (
    <section className="dashboard-grid client-grid">
      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Комиссии и уведомления</p>
            <h2>Глобальные настройки платформы</h2>
          </div>
        </div>
        {platformSettingsForm ? (
          <form className="form" onSubmit={handleSubmitPlatformSettings}>
            <label>
              <span>Комиссия провайдера (%)</span>
              <input
                type="number"
                step="0.0001"
                value={platformSettingsForm.provider_fee_percent}
                onChange={(event) =>
                  setPlatformSettingsForm({
                    ...platformSettingsForm,
                    provider_fee_percent: event.target.value,
                  })
                }
              />
            </label>
            <label>
              <span>Наценка платформы (%)</span>
              <input
                type="number"
                step="0.0001"
                value={platformSettingsForm.default_markup_percent}
                onChange={(event) =>
                  setPlatformSettingsForm({
                    ...platformSettingsForm,
                    default_markup_percent: event.target.value,
                  })
                }
              />
            </label>
            <label>
              <span>Комиссия от оборота (%)</span>
              <input
                type="number"
                step="0.0001"
                value={platformSettingsForm.default_turnover_fee_percent}
                onChange={(event) =>
                  setPlatformSettingsForm({
                    ...platformSettingsForm,
                    default_turnover_fee_percent: event.target.value,
                  })
                }
              />
            </label>

            <label className="switch-row">
              <span>Разрешить клиентам менять наценку</span>
              <input
                type="checkbox"
                checked={platformSettingsForm.allow_tenant_markup_override}
                onChange={(event) =>
                  setPlatformSettingsForm({
                    ...platformSettingsForm,
                    allow_tenant_markup_override: event.target.checked,
                  })
                }
              />
            </label>
            <label className="switch-row">
              <span>Разрешить клиентам менять комиссию от оборота</span>
              <input
                type="checkbox"
                checked={platformSettingsForm.allow_tenant_turnover_fee_override}
                onChange={(event) =>
                  setPlatformSettingsForm({
                    ...platformSettingsForm,
                    allow_tenant_turnover_fee_override: event.target.checked,
                  })
                }
              />
            </label>
            <label className="switch-row">
              <span>Глобально разрешить выплаты</span>
              <input
                type="checkbox"
                checked={platformSettingsForm.payouts_enabled}
                onChange={(event) =>
                  setPlatformSettingsForm({
                    ...platformSettingsForm,
                    payouts_enabled: event.target.checked,
                  })
                }
              />
            </label>
            <div className="notification-settings-box">
              <p className="eyebrow">Бренд уведомлений</p>
              <label>
                <span>Название бренда</span>
                <input
                  type="text"
                  placeholder="NorenCash"
                  value={platformSettingsForm.notification_brand_name}
                  onChange={(event) =>
                    setPlatformSettingsForm({
                      ...platformSettingsForm,
                      notification_brand_name: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>URL логотипа (для email)</span>
                <input
                  type="url"
                  placeholder="https://noren.digital/logo.png"
                  value={platformSettingsForm.notification_logo_url ?? ""}
                  onChange={(event) =>
                    setPlatformSettingsForm({
                      ...platformSettingsForm,
                      notification_logo_url:
                        event.target.value.trim() === "" ? null : event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Основная ссылка бренда</span>
                <input
                  type="url"
                  placeholder="https://noren.digital"
                  value={platformSettingsForm.notification_primary_url ?? ""}
                  onChange={(event) =>
                    setPlatformSettingsForm({
                      ...platformSettingsForm,
                      notification_primary_url:
                        event.target.value.trim() === "" ? null : event.target.value,
                    })
                  }
                />
              </label>
            </div>

            <div className="notification-settings-box">
              <p className="eyebrow">Шаблоны сообщений по событиям</p>
              <label>
                <span>Событие</span>
                <select
                  value={selectedTemplate?.code ?? ""}
                  onChange={(event) => setTemplateEventCode(event.target.value)}
                >
                  {platformSettingsForm.notification_templates.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              {selectedTemplate ? (
                <div className="notification-settings-box">
                  <p className="muted-text">
                    Доступные переменные: {platformSettingsForm.notification_template_variables.join(", ")}
                  </p>
                  <label>
                    <span>Email subject</span>
                    <input
                      type="text"
                      value={selectedTemplate.email_subject ?? ""}
                      onChange={(event) =>
                        handleTemplateFieldChange(
                          selectedTemplate.code,
                          "email_subject",
                          event.target.value,
                        )
                      }
                      placeholder="{{event_title}}"
                    />
                  </label>
                  <label>
                    <span>Email body (HTML поддерживается)</span>
                    <textarea
                      rows={7}
                      value={selectedTemplate.email_body ?? ""}
                      onChange={(event) =>
                        handleTemplateFieldChange(
                          selectedTemplate.code,
                          "email_body",
                          event.target.value,
                        )
                      }
                      placeholder="<p>Здравствуйте, {{user_full_name}}</p><p>{{message_lines_html}}</p>"
                    />
                  </label>
                  <label>
                    <span>Telegram message</span>
                    <textarea
                      rows={6}
                      value={selectedTemplate.telegram_body ?? ""}
                      onChange={(event) =>
                        handleTemplateFieldChange(
                          selectedTemplate.code,
                          "telegram_body",
                          event.target.value,
                        )
                      }
                      placeholder="{{event_subject}}\n\n{{message_lines}}"
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="notification-settings-box">
              <p className="eyebrow">Telegram</p>
              <label className="switch-row">
                <span>Глобально включить Telegram-уведомления</span>
                <input
                  type="checkbox"
                  checked={platformSettingsForm.telegram_notifications_enabled}
                  onChange={(event) =>
                    setPlatformSettingsForm({
                      ...platformSettingsForm,
                      telegram_notifications_enabled: event.target.checked,
                    })
                  }
                />
              </label>
              <p className="muted-text">
                {platformSettingsForm.telegram_bot_token_configured
                  ? "Bot token уже сохранен. Укажите новый, если хотите заменить."
                  : "Bot token пока не настроен."}
              </p>
              {telegramBotInfo?.token_masked ? (
                <p className="muted-text">Сохраненный token: {telegramBotInfo.token_masked}</p>
              ) : null}
              <label>
                <span>Telegram API URL</span>
                <input
                  type="text"
                  placeholder="https://api.telegram.org"
                  value={platformSettingsForm.telegram_api_base_url}
                  onChange={(event) =>
                    setPlatformSettingsForm({
                      ...platformSettingsForm,
                      telegram_api_base_url: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Telegram Bot Token (опционально)</span>
                <input
                  type="password"
                  autoComplete="off"
                  placeholder="Оставьте пустым, чтобы не менять"
                  value={telegramBotToken}
                  onChange={(event) => setTelegramBotToken(event.target.value)}
                />
              </label>
              <button
                className="ghost-button"
                type="button"
                disabled={loading || checkingTelegramBot}
                onClick={() => void handleCheckTelegramBot()}
              >
                {checkingTelegramBot ? "Проверяем..." : "Проверить бота"}
              </button>
              {telegramBotInfo ? (
                <div className="notification-settings-box">
                  <p className="eyebrow">Подключенный бот</p>
                  <p className="muted-text">
                    Username: {telegramBotInfo.username ? `@${telegramBotInfo.username}` : "-"}
                  </p>
                  <p className="muted-text">
                    Имя: {telegramBotInfo.display_name ?? telegramBotInfo.first_name ?? "-"}
                  </p>
                  <p className="muted-text">ID: {telegramBotInfo.bot_id ?? "-"}</p>
                </div>
              ) : null}
              <label>
                <span>Admin Chat ID для теста</span>
                <input
                  type="text"
                  placeholder="123456789 или -1001234567890"
                  value={adminTelegramChatId}
                  onChange={(event) => setAdminTelegramChatId(event.target.value)}
                />
              </label>
              <button
                className="ghost-button"
                type="button"
                disabled={loading || sendingTelegramTest || adminTelegramChatId.trim() === ""}
                onClick={() => void handleSendTelegramTest()}
              >
                {sendingTelegramTest ? "Отправляем..." : "Тест уведомления в Telegram"}
              </button>
              {telegramTestResult ? (
                <div className="notification-settings-box">
                  <p className="eyebrow">Telegram тест успешен</p>
                  <p className="muted-text">Chat ID: {telegramTestResult.chat_id}</p>
                  <p className="muted-text">Бот: {telegramTestResult.bot_display_name ?? "-"}</p>
                  <p className="muted-text">
                    Username: {telegramTestResult.bot_username ? `@${telegramTestResult.bot_username}` : "-"}
                  </p>
                  <p className="muted-text">
                    Message ID: {telegramTestResult.telegram_message_id ?? "-"}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="notification-settings-box">
              <p className="eyebrow">SMTP.bz</p>
              <label className="switch-row">
                <span>Глобально включить Email-уведомления</span>
                <input
                  type="checkbox"
                  checked={platformSettingsForm.email_notifications_enabled}
                  onChange={(event) =>
                    setPlatformSettingsForm({
                      ...platformSettingsForm,
                      email_notifications_enabled: event.target.checked,
                    })
                  }
                />
              </label>
              <label className="switch-row">
                <span>Отправка через SMTP.bz API</span>
                <input
                  type="checkbox"
                  checked={platformSettingsForm.smtp_bz_enabled}
                  onChange={(event) =>
                    setPlatformSettingsForm({
                      ...platformSettingsForm,
                      smtp_bz_enabled: event.target.checked,
                    })
                  }
                />
              </label>
              <label>
                <span>SMTP.bz API URL</span>
                <input
                  type="text"
                  placeholder="https://api.smtp.bz/v1"
                  value={platformSettingsForm.smtp_bz_api_base_url}
                  onChange={(event) =>
                    setPlatformSettingsForm({
                      ...platformSettingsForm,
                      smtp_bz_api_base_url: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Email отправителя (from)</span>
                <input
                  type="email"
                  placeholder="notify@noren.digital"
                  value={platformSettingsForm.smtp_bz_sender_email}
                  onChange={(event) =>
                    setPlatformSettingsForm({
                      ...platformSettingsForm,
                      smtp_bz_sender_email: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Имя отправителя (name)</span>
                <input
                  type="text"
                  placeholder="NorenCash"
                  value={platformSettingsForm.smtp_bz_sender_name}
                  onChange={(event) =>
                    setPlatformSettingsForm({
                      ...platformSettingsForm,
                      smtp_bz_sender_name: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Reply-To (опционально)</span>
                <input
                  type="email"
                  placeholder="support@noren.digital"
                  value={platformSettingsForm.smtp_bz_reply_to ?? ""}
                  onChange={(event) =>
                    setPlatformSettingsForm({
                      ...platformSettingsForm,
                      smtp_bz_reply_to:
                        event.target.value.trim() === "" ? null : event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Tag (опционально)</span>
                <input
                  type="text"
                  placeholder="merchant_notifications"
                  value={platformSettingsForm.smtp_bz_tag ?? ""}
                  onChange={(event) =>
                    setPlatformSettingsForm({
                      ...platformSettingsForm,
                      smtp_bz_tag:
                        event.target.value.trim() === "" ? null : event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>SMTP.bz API key (опционально)</span>
                <input
                  type="password"
                  autoComplete="off"
                  placeholder="Оставьте пустым, чтобы не менять"
                  value={smtpBzApiKey}
                  onChange={(event) => setSmtpBzApiKey(event.target.value)}
                />
              </label>
              <label>
                <span>Email для тестового письма</span>
                <input
                  type="email"
                  placeholder="admin@noren.digital"
                  value={smtpTestRecipient}
                  onChange={(event) => setSmtpTestRecipient(event.target.value)}
                />
              </label>
              <button
                className="ghost-button"
                type="button"
                disabled={loading || sendingSmtpTest || smtpTestRecipient.trim() === ""}
                onClick={() => void handleSendSmtpTest()}
              >
                {sendingSmtpTest ? "Отправляем..." : "Отправить тест SMTP.bz"}
              </button>

              <div className="notification-events-list">
                {(platformSettingsForm.notification_events ?? []).map((item) => (
                  <div className="notification-event-row" key={item.code}>
                    <div className="notification-event-meta">
                      <strong>{item.title}</strong>
                      <span>{item.mode === "confirm" ? "Подтверждение" : "Уведомление"}</span>
                    </div>
                    <label className="notification-channel">
                      <span>Email</span>
                      <input
                        type="checkbox"
                        checked={item.email_enabled}
                        onChange={(event) =>
                          handleToggleNotificationEvent(
                            item.code,
                            "email_enabled",
                            event.target.checked,
                          )
                        }
                      />
                    </label>
                    <label className="notification-channel">
                      <span>Telegram</span>
                      <input
                        type="checkbox"
                        checked={item.telegram_enabled}
                        onChange={(event) =>
                          handleToggleNotificationEvent(
                            item.code,
                            "telegram_enabled",
                            event.target.checked,
                          )
                        }
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Сохраняем..." : "Сохранить настройки платформы"}
            </button>
          </form>
        ) : (
          <p className="muted-text">Настройки пока не загружены.</p>
        )}
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Индивидуальные комиссии</p>
            <h2>Настройки выбранного клиента</h2>
          </div>
        </div>
        <div className="form-grid">
          <label>
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

          {tenantPolicyForm ? (
            <form className="form" onSubmit={handleSubmitTenantPolicy}>
              <label>
                <span>Наценка клиента (%)</span>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="пусто = глобальное значение"
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
              <label>
                <span>Комиссия от оборота клиента (%)</span>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="пусто = глобальное значение"
                  value={tenantPolicyForm.custom_turnover_fee_percent ?? ""}
                  onChange={(event) =>
                    setTenantPolicyForm({
                      ...tenantPolicyForm,
                      custom_turnover_fee_percent:
                        event.target.value.trim() === "" ? null : event.target.value,
                    })
                  }
                />
              </label>
              <label className="switch-row">
                <span>Разрешить выплаты клиенту</span>
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
              <label className="switch-row">
                <span>Ручная проверка выплат</span>
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
              <button className="primary-button" type="submit" disabled={loading || !selectedTenantId}>
                {loading ? "Сохраняем..." : "Сохранить правила клиента"}
              </button>
            </form>
          ) : (
            <p className="muted-text">Выберите клиента, чтобы открыть его индивидуальные правила.</p>
          )}
        </div>
      </article>

      <AssetAvailabilityPanel
        loading={loading}
        rates={adminAssetRates}
        onUpdateAssetAvailability={onUpdateAssetAvailability}
      />
    </section>
  );
}

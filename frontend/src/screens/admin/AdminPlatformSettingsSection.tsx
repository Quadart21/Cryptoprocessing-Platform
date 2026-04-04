import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import type {
  NotificationTemplateItem,
  PlatformBillingSettings,
  SmtpBzTestPayload,
  SmtpBzTestResponse,
  TelegramAdminTestPayload,
  TelegramAdminTestResponse,
  TelegramBotIdentity,
  TelegramBotInspectPayload,
  TenantBillingPolicy,
  TenantItem,
} from "../../api";

type AdminPlatformSettingsSectionProps = {
  loading: boolean;
  platformBillingSettings: PlatformBillingSettings | null;
  selectedTenantBillingPolicy: TenantBillingPolicy | null;
  selectedTenantId: string | null;
  tenants: TenantItem[];
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
};

type SettingsTab =
  | "fees"
  | "payouts"
  | "brand"
  | "email"
  | "telegram"
  | "templates"
  | "events"
  | "tenant";

const TABS: Array<{ key: SettingsTab; label: string; icon: string }> = [
  { key: "fees", label: "Комиссии", icon: "💰" },
  { key: "payouts", label: "Выплаты", icon: "💸" },
  { key: "brand", label: "Бренд", icon: "🏷" },
  { key: "email", label: "Email", icon: "✉" },
  { key: "telegram", label: "Telegram", icon: "✈" },
  { key: "templates", label: "Шаблоны", icon: "📝" },
  { key: "events", label: "События", icon: "🔔" },
  { key: "tenant", label: "Клиенты", icon: "👤" },
];

export function AdminPlatformSettingsSection({
  loading,
  platformBillingSettings,
  selectedTenantBillingPolicy,
  selectedTenantId,
  tenants,
  onSelectTenant,
  onUpdatePlatformSettings,
  onInspectPlatformTelegramBot,
  onSendPlatformTelegramTest,
  onSendPlatformSmtpBzTest,
  onUpdateTenantPolicy,
}: AdminPlatformSettingsSectionProps) {
  const formRef = useRef<HTMLFormElement>(null);
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
  const [activeTab, setActiveTab] = useState<SettingsTab>("fees");
  const [expandedAccordions, setExpandedAccordions] = useState<Set<SettingsTab>>(new Set(["fees"]));

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
    if (!platformSettingsForm) return null;
    return (
      platformSettingsForm.notification_templates.find(
        (item) => item.code === templateEventCode,
      ) ?? platformSettingsForm.notification_templates[0] ?? null
    );
  }, [platformSettingsForm, templateEventCode]);

  function handleSubmitPlatformSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!platformSettingsForm) return;
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
    if (!tenantPolicyForm) return;
    onUpdateTenantPolicy(tenantPolicyForm);
  }

  function handleToggleNotificationEvent(
    code: string,
    channel: "email_enabled" | "telegram_enabled",
    enabled: boolean,
  ) {
    if (!platformSettingsForm) return;
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
    if (!platformSettingsForm) return;
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

  function toggleAccordion(tab: SettingsTab) {
    setExpandedAccordions((prev) => {
      const next = new Set(prev);
      if (next.has(tab)) next.delete(tab);
      else next.add(tab);
      return next;
    });
  }

  const isAccordionExpanded = (tab: SettingsTab) => expandedAccordions.has(tab);

  function renderUnavailableState() {
    return <p className="muted-text">Настройки пока не загружены.</p>;
  }

  function renderFeesSection() {
    if (!platformSettingsForm) return renderUnavailableState();
    return (
      <section className="panel form">
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
          <span>Комиссия с оборота (%)</span>
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
      </section>
    );
  }

  function renderPayoutsSection() {
    if (!platformSettingsForm) return renderUnavailableState();
    return (
      <section className="panel form">
        <label className="switch-row">
          <span>Разрешить переопределение наценки клиентом</span>
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
          <span>Разрешить переопределение комиссии с оборота</span>
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
          <span>Выплаты включены</span>
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
      </section>
    );
  }

  function renderBrandSection() {
    if (!platformSettingsForm) return renderUnavailableState();
    return (
      <section className="panel form">
        <label>
          <span>Название бренда</span>
          <input
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
          <span>URL логотипа</span>
          <input
            value={platformSettingsForm.notification_logo_url ?? ""}
            onChange={(event) =>
              setPlatformSettingsForm({
                ...platformSettingsForm,
                notification_logo_url: event.target.value.trim() === "" ? null : event.target.value,
              })
            }
          />
        </label>
        <label>
          <span>Основной URL</span>
          <input
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
      </section>
    );
  }

  function renderEmailSection() {
    if (!platformSettingsForm) return renderUnavailableState();
    return (
      <section className="panel form">
        <label className="switch-row">
          <span>Email-уведомления включены</span>
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
          <span>SMTP.bz включён</span>
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
          <span>SMTP API URL</span>
          <input
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
          <span>Email отправителя</span>
          <input
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
          <span>Имя отправителя</span>
          <input
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
          <span>Reply-To</span>
          <input
            value={platformSettingsForm.smtp_bz_reply_to ?? ""}
            onChange={(event) =>
              setPlatformSettingsForm({
                ...platformSettingsForm,
                smtp_bz_reply_to: event.target.value.trim() === "" ? null : event.target.value,
              })
            }
          />
        </label>
        <label>
          <span>Тег</span>
          <input
            value={platformSettingsForm.smtp_bz_tag ?? ""}
            onChange={(event) =>
              setPlatformSettingsForm({
                ...platformSettingsForm,
                smtp_bz_tag: event.target.value.trim() === "" ? null : event.target.value,
              })
            }
          />
        </label>
        <label>
          <span>Новый SMTP API key</span>
          <input value={smtpBzApiKey} onChange={(event) => setSmtpBzApiKey(event.target.value)} />
        </label>
        <label>
          <span>Тестовый получатель</span>
          <input
            value={smtpTestRecipient}
            onChange={(event) => setSmtpTestRecipient(event.target.value)}
          />
        </label>
        <button
          className="ghost-button"
          type="button"
          onClick={handleSendSmtpTest}
          disabled={sendingSmtpTest || smtpTestRecipient.trim() === ""}
        >
          {sendingSmtpTest ? "Отправляем..." : "Отправить тестовое письмо"}
        </button>
        {smtpTestResult ? (
          <p className="muted-text">Тест отправлен на {smtpTestResult.recipient_email}.</p>
        ) : null}
      </section>
    );
  }

  function renderTelegramSection() {
    if (!platformSettingsForm) return renderUnavailableState();
    return (
      <section className="panel form">
        <label className="switch-row">
          <span>Telegram-уведомления включены</span>
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
        <label>
          <span>Telegram API URL</span>
          <input
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
          <span>Новый токен бота</span>
          <input
            value={telegramBotToken}
            onChange={(event) => setTelegramBotToken(event.target.value)}
          />
        </label>
        <div className="topbar-actions">
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
        {telegramBotInfo ? (
          <p className="muted-text">
            Бот: {telegramBotInfo.display_name ?? telegramBotInfo.username ?? "не определён"}
          </p>
        ) : null}
        {telegramTestResult ? (
          <p className="muted-text">Тестовое сообщение отправлено в чат {telegramTestResult.chat_id}.</p>
        ) : null}
      </section>
    );
  }

  function renderTemplatesSection() {
    if (!platformSettingsForm) return renderUnavailableState();
    return (
      <section className="panel form">
        <label>
          <span>Шаблон</span>
          <select value={templateEventCode} onChange={(event) => setTemplateEventCode(event.target.value)}>
            {platformSettingsForm.notification_templates.map((template) => (
              <option key={template.code} value={template.code}>
                {template.title}
              </option>
            ))}
          </select>
        </label>
        {selectedTemplate ? (
          <>
            <label>
              <span>Email subject</span>
              <input
                value={selectedTemplate.email_subject ?? ""}
                onChange={(event) =>
                  handleTemplateFieldChange(selectedTemplate.code, "email_subject", event.target.value)
                }
              />
            </label>
            <label>
              <span>Email body</span>
              <textarea
                rows={6}
                value={selectedTemplate.email_body ?? ""}
                onChange={(event) =>
                  handleTemplateFieldChange(selectedTemplate.code, "email_body", event.target.value)
                }
              />
            </label>
            <label>
              <span>Telegram body</span>
              <textarea
                rows={5}
                value={selectedTemplate.telegram_body ?? ""}
                onChange={(event) =>
                  handleTemplateFieldChange(selectedTemplate.code, "telegram_body", event.target.value)
                }
              />
            </label>
          </>
        ) : (
          <p className="muted-text">Шаблоны отсутствуют.</p>
        )}
      </section>
    );
  }

  function renderEventsSection() {
    if (!platformSettingsForm) return renderUnavailableState();
    return (
      <section className="panel form">
        {platformSettingsForm.notification_events.map((item) => (
          <div key={item.code} className="tenant-card">
            <div className="tenant-meta">
              <strong>{item.title}</strong>
              <span className="muted-text">{item.code}</span>
            </div>
            <label className="switch-row">
              <span>Email</span>
              <input
                type="checkbox"
                checked={item.email_enabled}
                onChange={(event) =>
                  handleToggleNotificationEvent(item.code, "email_enabled", event.target.checked)
                }
              />
            </label>
            <label className="switch-row">
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
        ))}
      </section>
    );
  }

  function renderTenantSection() {
    return (
      <section className="panel form">
        <label>
          <span>Клиент</span>
          <select value={selectedTenantId ?? ""} onChange={(event) => onSelectTenant(event.target.value)}>
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
              <span>Комиссия с оборота клиента (%)</span>
              <input
                type="number"
                step="0.0001"
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
              <span>Разрешить выплаты</span>
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
      </section>
    );
  }

  const tabContent: Record<SettingsTab, () => JSX.Element> = {
    fees: renderFeesSection,
    payouts: renderPayoutsSection,
    brand: renderBrandSection,
    email: renderEmailSection,
    telegram: renderTelegramSection,
    templates: renderTemplatesSection,
    events: renderEventsSection,
    tenant: renderTenantSection,
  };

  const renderContent = (tab: SettingsTab) => tabContent[tab]();

  return (
    <div className="platform-settings-page">
      <header className="page-header">
        <p className="eyebrow">Настройки</p>
        <h1>Глобальные настройки платформы</h1>
        <p className="page-description">Управление комиссиями, уведомлениями и брендом</p>
      </header>

      <nav className="settings-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`settings-tab-btn ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="settings-accordion">
        {TABS.map((tab) => (
          <div key={tab.key} className="accordion-item">
            <button
              className="accordion-header"
              onClick={() => toggleAccordion(tab.key)}
              aria-expanded={isAccordionExpanded(tab.key)}
            >
              <span className="accordion-icon">{tab.icon}</span>
              <span className="accordion-label">{tab.label}</span>
              <svg className="accordion-chevron" viewBox="0 0 24 24" fill="none">
                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div
              className={`accordion-body ${isAccordionExpanded(tab.key) ? "open" : ""}`}
            >
              <div className="accordion-body-inner">
                {renderContent(tab.key)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="settings-tab-content">
        {renderContent(activeTab)}
      </div>

      {(activeTab !== "tenant") && (
        <div className="settings-save-bar">
          <button className="primary-button" onClick={() => formRef.current?.requestSubmit()} disabled={loading}>
            {loading ? "Сохраняем..." : "Сохранить настройки"}
          </button>
        </div>
      )}

      <form ref={formRef} style={{ display: "none" }} onSubmit={handleSubmitPlatformSettings}>
        <input type="hidden" />
      </form>
    </div>
  );
}

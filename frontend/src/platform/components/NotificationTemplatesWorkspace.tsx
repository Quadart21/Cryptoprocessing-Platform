import { useEffect, useMemo, useRef, useState } from "react";

import type {
  NotificationEventToggle,
  NotificationTemplateItem,
  NotificationTemplatePreview,
  NotificationTemplatePreviewPayload,
  NotificationTemplateTestPayload,
  NotificationTemplateTestResponse,
  PlatformBillingSettings,
} from "../../api";
import {
  NotificationTemplateWysiwygEditor,
  type NotificationTemplateWysiwygHandle,
} from "./NotificationTemplateWysiwygEditor";
import { TEMPLATE_VARIABLE_HINTS } from "./notificationTemplateGuide";
import {
  getEventChannels,
  groupTemplatesByCategory,
  hasConfiguredTemplateContent,
  matchesTemplateFilter,
  matchesTemplateSearch,
  TEMPLATE_EVENT_HINTS,
  TEMPLATE_MODE_LABELS,
  TEMPLATE_VARIABLE_GROUPS,
  type TemplateListFilter,
} from "./notificationTemplateCatalog";
import {
  emailEditorHtmlToStorage,
  isTelegramAutoBody,
  resolveEmailEditorHtml,
  resolveTelegramEditorHtml,
  telegramEditorHtmlToStorage,
} from "./notificationTemplateEditorUtils";
import { useNotificationTemplateSubjectInput } from "./NotificationTemplateSubjectInput";

type EditorTab = "email" | "telegram" | "preview";

type NotificationTemplatesWorkspaceProps = {
  platformSettings: PlatformBillingSettings;
  loadedSettings: PlatformBillingSettings | null;
  setPlatformSettings: React.Dispatch<React.SetStateAction<PlatformBillingSettings | null>>;
  smtpBzApiKey: string;
  telegramBotToken: string;
  onPreviewNotificationTemplate: (
    payload: NotificationTemplatePreviewPayload,
  ) => Promise<NotificationTemplatePreview>;
  onSendNotificationTemplateTest: (
    payload: NotificationTemplateTestPayload,
  ) => Promise<NotificationTemplateTestResponse>;
};

function ChannelDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`ntw-channel-dot${active ? " is-on" : ""}`}
      title={`${label}: ${active ? "включён" : "выключен"} в разделе «События»`}
      aria-label={`${label} ${active ? "включён" : "выключен"}`}
    >
      {label === "Email" ? "✉" : "TG"}
    </span>
  );
}

export function NotificationTemplatesWorkspace({
  platformSettings,
  loadedSettings,
  setPlatformSettings,
  smtpBzApiKey,
  telegramBotToken,
  onPreviewNotificationTemplate,
  onSendNotificationTemplateTest,
}: NotificationTemplatesWorkspaceProps) {
  const [selectedCode, setSelectedCode] = useState("");
  const [editorTab, setEditorTab] = useState<EditorTab>("email");
  const [listFilter, setListFilter] = useState<TemplateListFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [variableSearch, setVariableSearch] = useState("");
  const [preview, setPreview] = useState<NotificationTemplatePreview | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testTelegramChatId, setTestTelegramChatId] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const richEditorRef = useRef<NotificationTemplateWysiwygHandle | null>(null);
  const telegramEditorRef = useRef<NotificationTemplateWysiwygHandle | null>(null);

  const templates = platformSettings.notification_templates;
  const notificationEvents = platformSettings.notification_events;

  useEffect(() => {
    if (!loadedSettings) return;
    const nextTemplates = loadedSettings.notification_templates;
    const firstConfigured = nextTemplates.find(hasConfiguredTemplateContent);
    setSelectedCode(firstConfigured?.code ?? nextTemplates[0]?.code ?? "");
    setPreview(null);
    setTestEmail("");
    setTestTelegramChatId("");
  }, [loadedSettings]);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.code === selectedCode) ?? templates[0] ?? null,
    [selectedCode, templates],
  );

  const configuredCount = useMemo(
    () => templates.filter(hasConfiguredTemplateContent).length,
    [templates],
  );

  const groupedTemplates = useMemo(() => {
    const filtered = templates.filter(
      (template) =>
        matchesTemplateFilter(template, listFilter) &&
        matchesTemplateSearch(template, searchQuery),
    );
    return groupTemplatesByCategory(filtered);
  }, [listFilter, searchQuery, templates]);

  const visibleTemplateCount = useMemo(
    () => groupedTemplates.reduce((sum, group) => sum + group.items.length, 0),
    [groupedTemplates],
  );

  const selectedChannels = selectedTemplate
    ? getEventChannels(notificationEvents, selectedTemplate.code)
    : { email: false, telegram: false };

  const telegramUsesAuto =
    selectedTemplate == null || isTelegramAutoBody(selectedTemplate.telegram_body);

  const subjectValue = selectedTemplate?.email_subject ?? "";

  const subjectInput = useNotificationTemplateSubjectInput({
    value: subjectValue,
    onChange: (value) => {
      if (!selectedTemplate) return;
      updateTemplateField(selectedTemplate.code, "email_subject", value);
    },
  });

  const emailEditorHtml = useMemo(() => {
    if (!selectedTemplate) return "<p></p>";
    return resolveEmailEditorHtml(
      selectedTemplate.message_lines,
      selectedTemplate.email_body,
      selectedTemplate.default_message_lines,
    );
  }, [selectedTemplate]);

  const telegramEditorHtml = useMemo(() => {
    if (!selectedTemplate) return "<p></p>";
    return resolveTelegramEditorHtml(
      selectedTemplate.telegram_body,
      selectedTemplate.default_telegram_body,
    );
  }, [selectedTemplate]);

  function updateTemplateField(
    code: string,
    field: keyof Pick<
      NotificationTemplateItem,
      "email_subject" | "message_lines" | "email_body" | "telegram_body"
    >,
    value: string,
  ) {
    setPlatformSettings((current) => {
      if (!current) return current;
      return {
        ...current,
        notification_templates: current.notification_templates.map((template) =>
          template.code === code
            ? { ...template, [field]: value.trim() === "" ? null : value }
            : template,
        ),
      };
    });
    setPreview(null);
  }

  function updateTemplateBody(
    code: string,
    payload: { message_lines: string | null; email_body: string | null },
  ) {
    setPlatformSettings((current) => {
      if (!current) return current;
      return {
        ...current,
        notification_templates: current.notification_templates.map((template) =>
          template.code === code
            ? { ...template, message_lines: payload.message_lines, email_body: payload.email_body }
            : template,
        ),
      };
    });
    setPreview(null);
  }

  function handleResetTemplate(code: string) {
    setPreview(null);
    setPlatformSettings((current) => {
      if (!current) return current;
      return {
        ...current,
        notification_templates: current.notification_templates.map((template) =>
          template.code === code
            ? {
                ...template,
                email_subject: null,
                message_lines: template.default_message_lines,
                email_body: null,
                telegram_body: null,
              }
            : template,
        ),
      };
    });
  }

  function insertVariable(variable: string) {
    const active = document.activeElement;
    if (active === subjectInput.inputRef.current) {
      subjectInput.insertVariable(variable);
      return;
    }
    const activeShell = active?.closest(".nte-shell");
    if (activeShell?.classList.contains("nte-shell-telegram")) {
      telegramEditorRef.current?.insertVariable(variable);
      return;
    }
    richEditorRef.current?.insertVariable(variable);
  }

  async function handlePreview() {
    if (!selectedTemplate) return;
    setPreviewing(true);
    try {
      const result = await onPreviewNotificationTemplate({
        code: selectedTemplate.code,
        email_subject: selectedTemplate.email_subject,
        message_lines: selectedTemplate.message_lines,
        email_body: selectedTemplate.email_body,
        telegram_body: selectedTemplate.telegram_body,
      });
      setPreview(result);
      setEditorTab("preview");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSendTest() {
    if (!selectedTemplate) return;
    setSendingTest(true);
    try {
      const result = await onSendNotificationTemplateTest({
        code: selectedTemplate.code,
        email_subject: selectedTemplate.email_subject,
        message_lines: selectedTemplate.message_lines,
        email_body: selectedTemplate.email_body,
        telegram_body: selectedTemplate.telegram_body,
        test_recipient_email: testEmail.trim() || null,
        telegram_chat_id: testTelegramChatId.trim() || null,
        smtp_bz_api_key: smtpBzApiKey.trim() || null,
        telegram_bot_token: telegramBotToken.trim() || null,
      });
      setPreview(result);
      setEditorTab("preview");
    } finally {
      setSendingTest(false);
    }
  }

  function selectTemplate(code: string) {
    setSelectedCode(code);
    setPreview(null);
    setEditorTab("email");
  }

  const filteredVariableGroups = useMemo(() => {
    const query = variableSearch.trim().toLowerCase();
    return TEMPLATE_VARIABLE_GROUPS.map((group) => ({
      ...group,
      variables: group.variables.filter((variable) => {
        if (!platformSettings.notification_template_variables.includes(variable)) {
          return false;
        }
        if (!query) return true;
        const hint = TEMPLATE_VARIABLE_HINTS[variable] ?? "";
        return (
          variable.toLowerCase().includes(query) || hint.toLowerCase().includes(query)
        );
      }),
    })).filter((group) => group.variables.length > 0);
  }, [platformSettings.notification_template_variables, variableSearch]);

  if (!selectedTemplate) {
    return <p className="muted-text">Шаблоны уведомлений недоступны.</p>;
  }

  const modeMeta = TEMPLATE_MODE_LABELS[selectedTemplate.mode] ?? {
    label: selectedTemplate.mode,
    hint: "",
  };
  const eventHint = TEMPLATE_EVENT_HINTS[selectedTemplate.code];

  return (
    <div className="ntw-root">
      <header className="ntw-header">
        <div className="ntw-header-copy">
          <h3 className="ntw-title">Шаблоны уведомлений</h3>
          <p className="muted-text">
            Для каждого события задайте тему и текст письма и Telegram. Пустые поля подставят значения по
            умолчанию. Включение каналов — в разделе «События».
          </p>
        </div>
        <div className="ntw-header-stats">
          <div className="ntw-stat">
            <span>Всего</span>
            <strong>{templates.length}</strong>
          </div>
          <div className="ntw-stat">
            <span>Настроено</span>
            <strong>{configuredCount}</strong>
          </div>
        </div>
      </header>

      <div className="ntw-layout">
        <aside className="ntw-sidebar" aria-label="Список событий">
          <div className="ntw-sidebar-tools">
            <input
              className="ntw-search"
              type="search"
              placeholder="Поиск по названию или коду…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <div className="ntw-filter-row" role="tablist" aria-label="Фильтр шаблонов">
              {(
                [
                  ["all", "Все"],
                  ["configured", "Настроены"],
                  ["default", "По умолчанию"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={listFilter === key}
                  className={`ntw-filter-chip${listFilter === key ? " is-active" : ""}`}
                  onClick={() => setListFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="ntw-event-list">
            {visibleTemplateCount === 0 ? (
              <p className="muted-text ntw-empty">Ничего не найдено. Сбросьте фильтр или поиск.</p>
            ) : (
              groupedTemplates.map((group) => (
                <section key={group.category?.id ?? "other"} className="ntw-event-group">
                  <h4 className="ntw-event-group-title">
                    {group.category?.label ?? "Прочее"}
                  </h4>
                  <ul className="ntw-event-group-list">
                    {group.items.map((template) => {
                      const configured = hasConfiguredTemplateContent(template);
                      const channels = getEventChannels(notificationEvents, template.code);
                      return (
                        <li key={template.code}>
                          <button
                            type="button"
                            className={`ntw-event-item${selectedCode === template.code ? " is-active" : ""}`}
                            onClick={() => selectTemplate(template.code)}
                          >
                            <span className="ntw-event-item-main">
                              <strong>{template.title}</strong>
                              <code>{template.code}</code>
                            </span>
                            <span className="ntw-event-item-meta">
                              <span
                                className={`ntw-status-badge${configured ? " is-custom" : " is-default"}`}
                              >
                                {configured ? "Свой текст" : "Дефолт"}
                              </span>
                              <ChannelDot active={channels.email} label="Email" />
                              <ChannelDot active={channels.telegram} label="Telegram" />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </div>
        </aside>

        <div className="ntw-main">
          <div className="ntw-event-head">
            <div>
              <div className="ntw-event-head-badges">
                <span className="ntw-mode-badge">{modeMeta.label}</span>
                {hasConfiguredTemplateContent(selectedTemplate) ? (
                  <span className="ntw-status-badge is-custom">Свой текст</span>
                ) : (
                  <span className="ntw-status-badge is-default">Текст по умолчанию</span>
                )}
              </div>
              <h3>{selectedTemplate.title}</h3>
              <p className="muted-text">{eventHint ?? modeMeta.hint}</p>
            </div>
            <div className="ntw-channel-summary">
              <span className={selectedChannels.email ? "is-on" : "is-off"}>
                Email {selectedChannels.email ? "вкл." : "выкл."}
              </span>
              <span className={selectedChannels.telegram ? "is-on" : "is-off"}>
                Telegram {selectedChannels.telegram ? "вкл." : "выкл."}
              </span>
            </div>
          </div>

          <div className="ntw-tabs" role="tablist" aria-label="Редактор шаблона">
            {(
              [
                ["email", "Email"],
                ["telegram", "Telegram"],
                ["preview", "Предпросмотр"],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={editorTab === tab}
                className={`ntw-tab${editorTab === tab ? " is-active" : ""}`}
                onClick={() => setEditorTab(tab)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="ntw-editor-layout">
            <div className="ntw-editor-panel">
              {editorTab === "email" ? (
                <div className="ntw-tab-panel">
                  <label className="ntw-field">
                    <span className="ntw-field-label">Тема письма</span>
                    <span className="ntw-field-hint muted-text">
                      Заголовок во входящих. Пусто — подставится: «
                      {selectedTemplate.default_email_subject}»
                    </span>
                    <input
                      ref={subjectInput.inputRef}
                      value={subjectValue}
                      placeholder={selectedTemplate.default_email_subject}
                      onChange={(event) =>
                        updateTemplateField(
                          selectedTemplate.code,
                          "email_subject",
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <div className="ntw-field">
                    <span className="ntw-field-label">Текст письма (HTML)</span>
                    <span className="ntw-field-hint muted-text">
                      Основное содержимое email с форматированием. Plain-текст для почтовых клиентов
                      формируется автоматически.
                    </span>
                    <NotificationTemplateWysiwygEditor
                      ref={richEditorRef}
                      variant="email"
                      html={emailEditorHtml}
                      placeholder={selectedTemplate.default_message_lines}
                      onChange={(html) =>
                        updateTemplateBody(
                          selectedTemplate.code,
                          emailEditorHtmlToStorage(html),
                        )
                      }
                    />
                  </div>
                </div>
              ) : null}

              {editorTab === "telegram" ? (
                <div className="ntw-tab-panel">
                  <label className="ntw-toggle-row">
                    <input
                      type="checkbox"
                      checked={telegramUsesAuto}
                      onChange={(event) => {
                        if (event.target.checked) {
                          updateTemplateField(selectedTemplate.code, "telegram_body", "");
                        } else {
                          updateTemplateField(
                            selectedTemplate.code,
                            "telegram_body",
                            resolveTelegramEditorHtml(
                              selectedTemplate.default_telegram_body,
                              selectedTemplate.default_telegram_body,
                            ),
                          );
                        }
                      }}
                    />
                    <span>
                      <strong>Как email</strong>
                      <small className="muted-text">
                        Отправить тему письма и текстовую версию без отдельного шаблона (рекомендуется).
                      </small>
                    </span>
                  </label>

                  {telegramUsesAuto ? (
                    <div className="ntw-auto-hint">
                      <p>
                        Telegram получит тему и plain-текст из вкладки Email. Чтобы задать отдельное
                        сообщение — снимите галочку выше.
                      </p>
                    </div>
                  ) : (
                    <div className="ntw-field">
                      <span className="ntw-field-label">Текст Telegram</span>
                      <span className="ntw-field-hint muted-text">
                        Отдельное сообщение: жирный, курсив, ссылки; первая картинка — как фото.
                      </span>
                      <NotificationTemplateWysiwygEditor
                        ref={telegramEditorRef}
                        variant="telegram"
                        html={telegramEditorHtml}
                        placeholder={selectedTemplate.default_telegram_body}
                        onChange={(html) =>
                          updateTemplateField(
                            selectedTemplate.code,
                            "telegram_body",
                            telegramEditorHtmlToStorage(html) ?? "",
                          )
                        }
                      />
                    </div>
                  )}
                </div>
              ) : null}

              {editorTab === "preview" ? (
                <div className="ntw-tab-panel ntw-preview-panel">
                  {!preview ? (
                    <div className="ntw-preview-empty">
                      <p className="muted-text">
                        Нажмите «Предпросмотр», чтобы увидеть итоговое письмо и текст Telegram с
                        подставленными переменными.
                      </p>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={previewing}
                        onClick={() => void handlePreview()}
                      >
                        {previewing ? "Строим preview…" : "Предпросмотр"}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="ntw-preview-grid">
                        <article className="ntw-preview-card">
                          <h4>Email</h4>
                          <p className="ntw-preview-subject">
                            <span className="muted-text">Тема:</span> {preview.email_subject}
                          </p>
                          <iframe
                            className="ntw-preview-frame"
                            title="Предпросмотр email"
                            sandbox=""
                            srcDoc={preview.email_html}
                          />
                          <details className="ntw-preview-details">
                            <summary>Plain-текст</summary>
                            <pre>{preview.email_text}</pre>
                          </details>
                        </article>
                        <article className="ntw-preview-card">
                          <h4>Telegram</h4>
                          <pre className="ntw-preview-telegram">{preview.telegram_text}</pre>
                        </article>
                      </div>
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={previewing}
                        onClick={() => void handlePreview()}
                      >
                        {previewing ? "Обновляем…" : "Обновить предпросмотр"}
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>

            <aside className={`ntw-variables${variablesOpen ? " is-open" : ""}`}>
              <button
                type="button"
                className="ntw-variables-toggle"
                aria-expanded={variablesOpen}
                onClick={() => setVariablesOpen((open) => !open)}
              >
                {variablesOpen ? "Скрыть переменные" : "Переменные"}
              </button>
              {variablesOpen ? (
                <div className="ntw-variables-body">
                  <input
                    className="ntw-search"
                    type="search"
                    placeholder="Поиск переменной…"
                    value={variableSearch}
                    onChange={(event) => setVariableSearch(event.target.value)}
                  />
                  <p className="muted-text ntw-variables-hint">
                    Клик вставляет <code>{`{{ имя }}`}</code> в активное поле (тема, email или Telegram).
                  </p>
                  <div className="ntw-variable-groups">
                    {filteredVariableGroups.map((group) => (
                      <section key={group.label} className="ntw-variable-group">
                        <h5>{group.label}</h5>
                        <div className="ntw-variable-list">
                          {group.variables.map((variable) => (
                            <button
                              key={variable}
                              type="button"
                              className="ntw-variable-item"
                              onClick={() => insertVariable(variable)}
                            >
                              <code>{`{{ ${variable} }}`}</code>
                              <span>{TEMPLATE_VARIABLE_HINTS[variable] ?? "Значение из контекста."}</span>
                            </button>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              ) : null}
            </aside>
          </div>

          <footer className="ntw-footer">
            <div className="ntw-footer-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => handleResetTemplate(selectedTemplate.code)}
              >
                Сбросить к дефолту
              </button>
              {editorTab !== "preview" ? (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={previewing}
                  onClick={() => void handlePreview()}
                >
                  {previewing ? "Preview…" : "Предпросмотр"}
                </button>
              ) : null}
            </div>

            <div className="ntw-test-block">
              <p className="ntw-test-title">Тестовая отправка</p>
              <div className="ntw-test-fields">
                <label>
                  <span>Email</span>
                  <input
                    value={testEmail}
                    placeholder="admin@example.com"
                    onChange={(event) => setTestEmail(event.target.value)}
                  />
                </label>
                <label>
                  <span>Telegram chat ID</span>
                  <input
                    value={testTelegramChatId}
                    placeholder="123456789"
                    onChange={(event) => setTestTelegramChatId(event.target.value)}
                  />
                </label>
              </div>
              <button
                type="button"
                className="primary-button"
                disabled={
                  sendingTest || (!testEmail.trim() && !testTelegramChatId.trim())
                }
                onClick={() => void handleSendTest()}
              >
                {sendingTest ? "Отправляем…" : "Отправить тест"}
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

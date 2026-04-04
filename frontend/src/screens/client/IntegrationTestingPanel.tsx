import { FormEvent, useMemo, useState } from "react";

import type { ProjectItem } from "../../api";

type WebhookFormState = {
  project_id: string;
  webhook_url: string;
  webhook_secret: string;
};

type IntegrationTestingPanelProps = {
  apiBaseUrl: string;
  activeApiKeyPublic: string | null;
  activeWebhookUrl: string | null;
  selectedRoute: string;
  integrationCurl: string;
  projects: ProjectItem[];
  webhookForm: WebhookFormState;
  loading: boolean;
  onWebhookFormChange: (next: WebhookFormState) => void;
  onSaveWebhook: (event: FormEvent<HTMLFormElement>) => void;
  onSendWebhookTest: () => void;
};

type IntegrationTab = "sandbox" | "webhook" | "swagger";
type SandboxScenarioId = "health" | "rates" | "invoice" | "sync";

type SandboxScenario = {
  id: SandboxScenarioId;
  title: string;
  endpoint: string;
  description: string;
  command: string;
  expected: string;
};

export function IntegrationTestingPanel({
  apiBaseUrl,
  activeApiKeyPublic,
  activeWebhookUrl,
  selectedRoute,
  integrationCurl,
  projects,
  webhookForm,
  loading,
  onWebhookFormChange,
  onSaveWebhook,
  onSendWebhookTest,
}: IntegrationTestingPanelProps) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<IntegrationTab>("sandbox");
  const [scenarioId, setScenarioId] = useState<SandboxScenarioId>("health");

  const backendOrigin = useMemo(() => {
    try {
      const url = new URL(apiBaseUrl);
      return `${url.protocol}//${url.host}`;
    } catch {
      return "";
    }
  }, [apiBaseUrl]);

  const docsUrl = backendOrigin ? `${backendOrigin}/docs` : "/docs";
  const openApiUrl = backendOrigin ? `${backendOrigin}/openapi.json` : "/openapi.json";
  const isSandbox = /localhost|127\.0\.0\.1/i.test(apiBaseUrl);

  const hasApiKey = Boolean(activeApiKeyPublic);
  const hasProject = projects.length > 0;
  const hasWebhook = Boolean(activeWebhookUrl);

  const healthCurl = `curl -X GET "${apiBaseUrl}/health"`;
  const ratesCurl = activeApiKeyPublic
    ? `curl -X GET "${apiBaseUrl}/rates" \\
  -H "X-API-Key: ${activeApiKeyPublic}" \\
  -H "X-API-Secret: <secret_key>"`
    : "Сначала получите активный API-ключ, чтобы проверить endpoint /rates.";
  const syncCurl = activeApiKeyPublic
    ? `curl -X POST "${apiBaseUrl}/invoices/<invoice_id>/sync" \\
  -H "X-API-Key: ${activeApiKeyPublic}" \\
  -H "X-API-Secret: <secret_key>"`
    : "Сначала получите активный API-ключ, чтобы проверить синхронизацию инвойса.";

  const scenarios = useMemo<SandboxScenario[]>(
    () => [
      {
        id: "health",
        title: "Доступность API",
        endpoint: "GET /health",
        description: "Проверка того, что ваш backend запущен и отвечает без авторизации.",
        command: healthCurl,
        expected: "HTTP 200 и статус сервиса без ошибок.",
      },
      {
        id: "rates",
        title: "Список токенов и сетей",
        endpoint: "GET /rates",
        description:
          "Проверка активных валют/сетей и лимитов. Здесь сразу видно, что отключено в админке.",
        command: ratesCurl,
        expected: "Массив доступных токенов с min/max и сетями для оплаты.",
      },
      {
        id: "invoice",
        title: "Создание тестового инвойса",
        endpoint: "POST /invoices",
        description:
          "Базовый smoke-тест интеграции: генерация инвойса и проверка того, что он появляется в списке.",
        command: integrationCurl,
        expected: "ID инвойса, статус pending и данные для оплаты.",
      },
      {
        id: "sync",
        title: "Синхронизация статуса",
        endpoint: "POST /invoices/{invoice_id}/sync",
        description:
          "Ручная синхронизация полезна для отладки: обновляет статус из провайдера без ожидания webhook.",
        command: syncCurl,
        expected: "Актуальный статус инвойса после запроса к провайдеру.",
      },
    ],
    [healthCurl, integrationCurl, ratesCurl, syncCurl]
  );

  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];

  const readinessItems = [
    {
      title: "API-ключ активирован",
      ok: hasApiKey,
      detail: hasApiKey ? "Готово: ключ можно использовать в тестовых запросах." : "Нужно создать/активировать ключ.",
    },
    {
      title: "Проект создан",
      ok: hasProject,
      detail: hasProject ? "Готово: можно назначать webhook и выпускать инвойсы." : "Добавьте хотя бы один проект в кабинете.",
    },
    {
      title: "Webhook настроен",
      ok: hasWebhook,
      detail: hasWebhook ? "Готово: уведомления о статусе будут отправляться автоматически." : "Укажите URL и secret для webhook.",
    },
    {
      title: "Маршрут клиента",
      ok: Boolean(selectedRoute),
      detail: selectedRoute ? `Используется контур ${selectedRoute}.` : "Маршрут не выбран.",
    },
  ];

  const webhookPayloadExample = useMemo(
    () =>
      JSON.stringify(
        {
          event: "invoice.status_changed",
          event_id: "evt_test_001",
          invoice_id: "inv_test_001",
          status: "confirmed",
          amount: "100.00",
          currency: "USDT",
          network: "TRC20",
          paid_at: "2026-03-30T10:15:00Z",
        },
        null,
        2
      ),
    []
  );

  async function handleCopy(value: string | null, title: string) {
    if (!value) {
      setCopyMessage(`Нет значения для «${title}».`);
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`Скопировано: ${title}.`);
    } catch {
      setCopyMessage(`Не удалось скопировать «${title}».`);
    }
  }

  return (
    <article className="panel panel-span-2">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Тестирование интеграции</p>
          <h2>Центр интеграции API</h2>
        </div>
        <span
          className={`integration-env-badge ${isSandbox ? "integration-env-badge-sandbox" : "integration-env-badge-live"}`}
        >
          {isSandbox ? "Песочница / тестнет" : "Боевая среда"}
        </span>
      </div>

      <div className="detail-summary detail-summary-compact integration-summary">
        <div className="detail-chip">
          <span>Base URL</span>
          <code className="detail-tech-value">{apiBaseUrl}</code>
        </div>
        <div className="detail-chip">
          <span>Активный API key</span>
          <code className="detail-tech-value">{activeApiKeyPublic ?? "Нет активного ключа"}</code>
        </div>
        <div className="detail-chip">
          <span>Webhook URL</span>
          <code className="detail-tech-value">{activeWebhookUrl ?? "Не задан"}</code>
        </div>
        <div className="detail-chip">
          <span>Клиентский контур</span>
          <code className="detail-tech-value">{selectedRoute}</code>
        </div>
      </div>

      <div className="integration-tabs">
        <button
          className={`segment-button ${tab === "sandbox" ? "segment-button-active" : ""}`}
          onClick={() => setTab("sandbox")}
          type="button"
        >
          Песочница
        </button>
        <button
          className={`segment-button ${tab === "webhook" ? "segment-button-active" : ""}`}
          onClick={() => setTab("webhook")}
          type="button"
        >
          Webhook
        </button>
        <button
          className={`segment-button ${tab === "swagger" ? "segment-button-active" : ""}`}
          onClick={() => setTab("swagger")}
          type="button"
        >
          Swagger
        </button>
      </div>

      {tab === "sandbox" ? (
        <div className="integration-tab-pane">
          <div className="integration-grid">
            <section className="result-box integration-card">
              <div className="integration-card-head">
                <strong>Сценарии тестирования</strong>
                <span>Пошаговый запуск API</span>
              </div>
              <p className="integration-inline-note">
                Выберите сценарий. Для каждого есть готовая команда и ожидаемый результат.
              </p>

              <div className="integration-scenario-list">
                {scenarios.map((item) => (
                  <button
                    key={item.id}
                    className={`integration-scenario-button ${item.id === scenario.id ? "integration-scenario-button-active" : ""}`}
                    onClick={() => setScenarioId(item.id)}
                    type="button"
                  >
                    {item.title}
                  </button>
                ))}
              </div>

              <div className="integration-scenario-body">
                <p className="integration-endpoint-line">
                  Endpoint: <code>{scenario.endpoint}</code>
                </p>
                <p>{scenario.description}</p>
                <pre className="json-box">{scenario.command}</pre>
                <p className="integration-expected">Ожидаемо: {scenario.expected}</p>
                <div className="action-row-inline">
                  <button
                    className="ghost-button"
                    onClick={() => void handleCopy(scenario.command, `${scenario.title} curl`)}
                    type="button"
                  >
                    Копировать команду
                  </button>
                </div>
              </div>
            </section>

            <section className="result-box integration-card">
              <div className="integration-card-head">
                <strong>Чек-лист готовности</strong>
                <span>Что проверить перед продом</span>
              </div>

              <div className="integration-readiness-list">
                {readinessItems.map((item) => (
                  <article className="integration-readiness-item" key={item.title}>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <span
                      className={`status-pill ${item.ok ? "status-pill-ok" : "status-pill-bad"}`}
                      title={item.ok ? "Готово" : "Нужно действие"}
                    >
                      {item.ok ? "OK" : "Нужно"}
                    </span>
                  </article>
                ))}
              </div>

              <div className="integration-divider" />

              <strong className="integration-subtitle">Рекомендуемый порядок проверки</strong>
              <ol className="integration-steps">
                <li>Проверить `GET /health`, что backend стабильно отвечает.</li>
                <li>Проверить `GET /rates`, что видны только разрешенные токены/сети.</li>
                <li>Создать тестовый инвойс и сверить его в списке инвойсов.</li>
                <li>Запустить ручной sync и убедиться, что статус обновляется.</li>
                <li>Отправить тестовый webhook и проверить подпись на стороне мерчанта.</li>
              </ol>
            </section>
          </div>
        </div>
      ) : null}

      {tab === "webhook" ? (
        <div className="integration-tab-pane">
          <div className="integration-grid">
            <section className="result-box integration-card">
              <div className="integration-card-head">
                <strong>Webhook: формат и отладка</strong>
                <span>Тест доставки событий</span>
              </div>
              <p className="integration-inline-note">
                Заголовки: `X-Merset-Event`, `X-Merset-Event-Id`, `X-Merset-Timestamp`,
                `X-Merset-Signature` (если задан secret).
              </p>
              <p className="integration-inline-note">
                Для первой проверки удобно использовать RequestBin или ngrok, затем переключиться на production URL.
              </p>

              <div className="copy-grid">
                <div className="copy-row">
                  <code className="copy-row-value">{activeApiKeyPublic ?? "Нет активного ключа"}</code>
                  <button
                    className="ghost-button"
                    onClick={() => void handleCopy(activeApiKeyPublic, "API key")}
                    type="button"
                  >
                    Копировать ключ
                  </button>
                </div>
                <div className="copy-row">
                  <code className="copy-row-value">{activeWebhookUrl ?? "Webhook URL не задан"}</code>
                  <button
                    className="ghost-button"
                    onClick={() => void handleCopy(activeWebhookUrl, "Webhook URL")}
                    type="button"
                  >
                    Копировать URL
                  </button>
                </div>
              </div>

              <strong className="integration-subtitle">Пример payload</strong>
              <pre className="json-box">{webhookPayloadExample}</pre>
              <div className="action-row-inline">
                <button
                  className="ghost-button"
                  onClick={() => void handleCopy(webhookPayloadExample, "Webhook payload")}
                  type="button"
                >
                  Копировать payload
                </button>
              </div>
            </section>

            <form className="form integration-form" onSubmit={onSaveWebhook}>
              <label>
                <span>Проект для webhook</span>
                <select
                  value={webhookForm.project_id}
                  onChange={(event) => onWebhookFormChange({ ...webhookForm, project_id: event.target.value })}
                >
                  <option value="">Выберите проект</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Webhook URL</span>
                <input
                  value={webhookForm.webhook_url}
                  onChange={(event) => onWebhookFormChange({ ...webhookForm, webhook_url: event.target.value })}
                  placeholder="https://merchant.example.com/webhooks/crypto"
                />
              </label>
              <label>
                <span>Webhook secret</span>
                <input
                  value={webhookForm.webhook_secret}
                  onChange={(event) => onWebhookFormChange({ ...webhookForm, webhook_secret: event.target.value })}
                  placeholder="merchant-webhook-secret"
                />
              </label>
              <div className="action-row-inline">
                <button className="primary-button" disabled={loading} type="submit">
                  {loading ? "Сохраняем..." : "Сохранить webhook"}
                </button>
                <button
                  className="ghost-button"
                  disabled={loading || !webhookForm.project_id}
                  onClick={onSendWebhookTest}
                  type="button"
                >
                  Отправить тестовый webhook
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {tab === "swagger" ? (
        <div className="integration-tab-pane">
          <div className="integration-doc-grid">
            <a className="integration-link-card" href={docsUrl} rel="noreferrer" target="_blank">
              <strong>Swagger UI</strong>
              <span>{docsUrl}</span>
            </a>
            <a className="integration-link-card" href={openApiUrl} rel="noreferrer" target="_blank">
              <strong>OpenAPI JSON</strong>
              <span>{openApiUrl}</span>
            </a>
          </div>

          <div className="integration-endpoints-grid">
            <article className="result-box integration-card">
              <strong className="integration-subtitle">Ключевые endpoint'ы для интеграции</strong>
              <ul className="integration-list">
                <li>`POST /api/v1/client/invoices` - создать инвойс.</li>
                <li>`GET /api/v1/client/invoices` - список инвойсов.</li>
                <li>`POST /api/v1/client/invoices/{`{invoice_id}`}/sync` - синхронизировать статус.</li>
                <li>`GET /api/v1/client/transactions` - проверить net и комиссии.</li>
                <li>`POST /api/v1/client/webhooks/test` - отправить тестовый webhook.</li>
              </ul>
            </article>

            <article className="result-box integration-card">
              <strong className="integration-subtitle">Что тестировать в Swagger в первую очередь</strong>
              <ul className="integration-list">
                <li>Ошибки лимитов сумм (min/max) при создании инвойса.</li>
                <li>Корректность токена и сети в `/rates` после переключений в админке.</li>
                <li>Переход статусов `pending -&gt; confirmed` после sync.</li>
                <li>Корректность структуры ошибок в `detail`.</li>
                <li>Доставку webhook с подписью при заданном secret.</li>
              </ul>
            </article>
          </div>
        </div>
      ) : null}

      {copyMessage ? <p className="muted-text integration-copy-note">{copyMessage}</p> : null}
    </article>
  );
}

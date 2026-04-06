import { useMemo, useState } from "react";

type ApiDocumentationPanelProps = {
  apiBaseUrl: string;
  activeApiKeyPublic: string | null;
  selectedRoute: string;
  activeWebhookUrl: string | null;
  integrationCurl: string;
};

type EndpointReference = {
  id: string;
  method: "GET" | "POST";
  path: string;
  title: string;
  purpose: string;
  auth: string;
  notes?: string[];
  requestExample?: string;
  successExample: string;
  errorExample: string;
};

const FAQ_ITEMS = [
  {
    title: "Где клиенту взять public и secret?",
    body:
      "В клиентском кабинете откройте раздел API / API-ключи, создайте или перевыпустите активный ключ и сохраните пару значений: public key и secret key. Secret обычно показывается только в момент выпуска, поэтому его нужно сразу записать в backend или секрет-хранилище.",
  },
  {
    title: "Куда сохранять ключи в проекте?",
    body:
      "Храните public и secret только на backend стороне. Не вставляйте secret в frontend, браузерный код, мобильное приложение или публичные репозитории. Оптимально использовать env-переменные или менеджер секретов.",
  },
  {
    title: "Что делать при 4xx и 5xx?",
    body:
      "Ошибки 4xx обычно означают проблему в payload, ключах доступа или параметрах маршрута. Ошибки 5xx и 502/504 нужно обрабатывать через retry с backoff и логирование correlation/event identifiers.",
  },
];

export function ApiDocumentationPanel({
  apiBaseUrl,
  activeApiKeyPublic,
  selectedRoute,
  activeWebhookUrl,
  integrationCurl,
}: ApiDocumentationPanelProps) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

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
  const publicKey = activeApiKeyPublic ?? "<public_key>";
  const authHeadersExample = `X-API-Key: ${publicKey}\nX-API-Secret: <secret_key>`;

  const endpointReferences = useMemo<EndpointReference[]>(
    () => [
      {
        id: "health",
        method: "GET",
        path: "/api/v1/client/health",
        title: "Проверка доступности API",
        purpose: "Быстрый ping backend без авторизации и бизнес-логики.",
        auth: "Без авторизации",
        requestExample: `curl -X GET "${apiBaseUrl}/health"`,
        successExample: `{
  "status": "ok",
  "scope": "client"
}`,
        errorExample: `HTTP 503
{
  "detail": "Service unavailable.",
  "code": "service_unavailable"
}`,
      },
      {
        id: "login",
        method: "POST",
        path: "/api/v1/client/auth/login",
        title: "Логин в кабинет мерчанта",
        purpose: "Получить JWT-токены для доступа к cabinet-only endpoints.",
        auth: "Без авторизации",
        requestExample: `curl -X POST "${apiBaseUrl}/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "owner@noren.demo",
    "password": "StrongPass123!",
    "otp_code": "123456"
  }'`,
        successExample: `{
  "access_token": "<jwt_access>",
  "refresh_token": "<jwt_refresh>",
  "token_type": "bearer"
}`,
        errorExample: `HTTP 401
{
  "detail": "Неверный email или пароль.",
  "code": "request_error"
}`,
      },
      {
        id: "create-invoice",
        method: "POST",
        path: "/api/v1/client/invoices",
        title: "Создать инвойс",
        purpose: "Создать счёт на оплату с crypto route и payment address.",
        auth: "X-API-Key + X-API-Secret",
        notes: [
          "project_id должен принадлежать API-ключу.",
          "Перед созданием инвойса лучше вызывать GET /rates для проверки доступной сети и min/max.",
        ],
        requestExample: integrationCurl,
        successExample: `{
  "id": "inv_01J_DOCS_EXAMPLE",
  "project_id": "<project_id>",
  "merchant_order_id": "order_1001",
  "provider_order_id": "cc_992211",
  "amount_fiat": "100.00",
  "fiat_currency": "USD",
  "amount_crypto": "100.25",
  "crypto_currency": "USDT",
  "network": "TRC20",
  "payment_address": "TG9...example",
  "qr_url": "https://example.com/qr/inv_01J_DOCS_EXAMPLE",
  "status": "pending",
  "expires_at": "2026-04-06T11:45:00Z",
  "created_at": "2026-04-06T11:30:00Z"
}`,
        errorExample: `HTTP 400
{
  "detail": {
    "code": "amount_out_of_range",
    "message": "Сумма 1.00 для USDT/TRC20 вне допустимого диапазона (min 5, max 5000).",
    "currency": "USDT",
    "network": "TRC20",
    "amount": "1",
    "min_amount": "5",
    "max_amount": "5000"
  }
}`,
      },
      {
        id: "list-invoices",
        method: "GET",
        path: "/api/v1/client/invoices",
        title: "Получить список инвойсов",
        purpose: "Вернуть список инвойсов по tenant/project с пагинацией.",
        auth: "X-API-Key + X-API-Secret",
        requestExample: `curl -X GET "${apiBaseUrl}/invoices?limit=20&offset=0" \\
  -H "X-API-Key: ${publicKey}" \\
  -H "X-API-Secret: <secret_key>"`,
        successExample: `[
  {
    "id": "inv_01J_DOCS_EXAMPLE",
    "project_id": "<project_id>",
    "merchant_order_id": "order_1001",
    "provider_order_id": "cc_992211",
    "amount_fiat": "100.00",
    "fiat_currency": "USD",
    "amount_crypto": "100.25",
    "crypto_currency": "USDT",
    "network": "TRC20",
    "payment_address": "TG9...example",
    "qr_url": "https://example.com/qr/inv_01J_DOCS_EXAMPLE",
    "status": "confirmed",
    "expires_at": "2026-04-06T11:45:00Z",
    "created_at": "2026-04-06T11:30:00Z"
  }
]`,
        errorExample: `HTTP 403
{
  "detail": "Недостаточно прав: client.invoices.read.",
  "code": "request_error"
}`,
      },
      {
        id: "get-invoice",
        method: "GET",
        path: "/api/v1/client/invoices/{invoice_id}",
        title: "Получить один инвойс",
        purpose: "Вернуть текущий статус и реквизиты конкретного инвойса.",
        auth: "X-API-Key + X-API-Secret",
        requestExample: `curl -X GET "${apiBaseUrl}/invoices/<invoice_id>" \\
  -H "X-API-Key: ${publicKey}" \\
  -H "X-API-Secret: <secret_key>"`,
        successExample: `{
  "id": "inv_01J_DOCS_EXAMPLE",
  "project_id": "<project_id>",
  "merchant_order_id": "order_1001",
  "provider_order_id": "cc_992211",
  "amount_fiat": "100.00",
  "fiat_currency": "USD",
  "amount_crypto": "100.25",
  "crypto_currency": "USDT",
  "network": "TRC20",
  "payment_address": "TG9...example",
  "qr_url": "https://example.com/qr/inv_01J_DOCS_EXAMPLE",
  "status": "paid",
  "expires_at": "2026-04-06T11:45:00Z",
  "created_at": "2026-04-06T11:30:00Z"
}`,
        errorExample: `HTTP 404
{
  "detail": "Инвойс не найден.",
  "code": "request_error"
}`,
      },
      {
        id: "sync-invoice",
        method: "POST",
        path: "/api/v1/client/invoices/{invoice_id}/sync",
        title: "Синхронизировать статус инвойса",
        purpose: "Принудительно обновить статус инвойса у провайдера.",
        auth: "X-API-Key + X-API-Secret",
        requestExample: `curl -X POST "${apiBaseUrl}/invoices/<invoice_id>/sync" \\
  -H "X-API-Key: ${publicKey}" \\
  -H "X-API-Secret: <secret_key>"`,
        successExample: `{
  "id": "inv_01J_DOCS_EXAMPLE",
  "project_id": "<project_id>",
  "merchant_order_id": "order_1001",
  "provider_order_id": "cc_992211",
  "amount_fiat": "100.00",
  "fiat_currency": "USD",
  "amount_crypto": "100.25",
  "crypto_currency": "USDT",
  "network": "TRC20",
  "payment_address": "TG9...example",
  "qr_url": "https://example.com/qr/inv_01J_DOCS_EXAMPLE",
  "status": "confirmed",
  "expires_at": "2026-04-06T11:45:00Z",
  "created_at": "2026-04-06T11:30:00Z"
}`,
        errorExample: `HTTP 502
{
  "detail": "Provider temporarily unavailable.",
  "code": "request_error"
}`,
      },
      {
        id: "rates",
        method: "GET",
        path: "/api/v1/client/rates",
        title: "Получить доступные rates",
        purpose: "Вернуть список доступных токенов, сетей и лимитов.",
        auth: "X-API-Key + X-API-Secret",
        requestExample: `curl -X GET "${apiBaseUrl}/rates" \\
  -H "X-API-Key: ${publicKey}" \\
  -H "X-API-Secret: <secret_key>"`,
        successExample: `{
  "items": [
    {
      "asset": "USDT",
      "networks": [
        {
          "network": "TRC20",
          "min_amount": "5",
          "max_amount": "5000",
          "rate": "1.0000"
        }
      ]
    }
  ]
}`,
        errorExample: `HTTP 401
{
  "detail": "Invalid API credentials.",
  "code": "request_error"
}`,
      },
      {
        id: "balance",
        method: "GET",
        path: "/api/v1/client/balance",
        title: "Получить баланс",
        purpose: "Вернуть доступный баланс мерчанта в расчётной валюте.",
        auth: "X-API-Key + X-API-Secret",
        requestExample: `curl -X GET "${apiBaseUrl}/balance" \\
  -H "X-API-Key: ${publicKey}" \\
  -H "X-API-Secret: <secret_key>"`,
        successExample: `{
  "currency": "USDT",
  "amount": "9821.34"
}`,
        errorExample: `HTTP 403
{
  "detail": "Недостаточно прав: client.balance.read.",
  "code": "request_error"
}`,
      },
      {
        id: "transactions",
        method: "GET",
        path: "/api/v1/client/transactions",
        title: "Получить список транзакций",
        purpose: "История транзакций по tenant/project с breakdown комиссий.",
        auth: "X-API-Key + X-API-Secret",
        requestExample: `curl -X GET "${apiBaseUrl}/transactions?limit=20&offset=0" \\
  -H "X-API-Key: ${publicKey}" \\
  -H "X-API-Secret: <secret_key>"`,
        successExample: `[
  {
    "id": "tx_01J_DOCS_EXAMPLE",
    "tenant_id": "<tenant_id>",
    "project_id": "<project_id>",
    "invoice_id": "inv_01J_DOCS_EXAMPLE",
    "gross_amount": "100.00",
    "provider_fee": "0.20",
    "platform_fee": "0.80",
    "turnover_fee": "0.10",
    "net_amount": "98.90",
    "currency": "USDT",
    "status": "confirmed",
    "paid_at": "2026-04-06T11:41:00Z",
    "created_at": "2026-04-06T11:30:00Z"
  }
]`,
        errorExample: `HTTP 401
{
  "detail": "Invalid API credentials.",
  "code": "request_error"
}`,
      },
      {
        id: "transaction",
        method: "GET",
        path: "/api/v1/client/transactions/{transaction_id}",
        title: "Получить одну транзакцию",
        purpose: "Вернуть детали конкретной транзакции по id.",
        auth: "X-API-Key + X-API-Secret",
        requestExample: `curl -X GET "${apiBaseUrl}/transactions/<transaction_id>" \\
  -H "X-API-Key: ${publicKey}" \\
  -H "X-API-Secret: <secret_key>"`,
        successExample: `{
  "id": "tx_01J_DOCS_EXAMPLE",
  "tenant_id": "<tenant_id>",
  "project_id": "<project_id>",
  "invoice_id": "inv_01J_DOCS_EXAMPLE",
  "gross_amount": "100.00",
  "provider_fee": "0.20",
  "platform_fee": "0.80",
  "turnover_fee": "0.10",
  "net_amount": "98.90",
  "currency": "USDT",
  "status": "confirmed",
  "paid_at": "2026-04-06T11:41:00Z",
  "created_at": "2026-04-06T11:30:00Z"
}`,
        errorExample: `HTTP 404
{
  "detail": "Транзакция не найдена.",
  "code": "request_error"
}`,
      },
    ],
    [apiBaseUrl, integrationCurl, publicKey],
  );

  const webhookConfigExample = `curl -X POST "${apiBaseUrl}/webhooks" \\
  -H "Authorization: Bearer <jwt_access>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "<project_id>",
    "webhook_url": "https://merchant.example.com/webhooks/noren",
    "webhook_secret": "merchant-webhook-secret"
  }'`;

  const webhookTestExample = `curl -X POST "${apiBaseUrl}/webhooks/test" \\
  -H "Authorization: Bearer <jwt_access>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "<project_id>"
  }'`;

  const webhookPayloadExample = `{
  "event": "invoice.confirmed",
  "event_id": "evt_01J_DOCS_EXAMPLE",
  "sent_at": "2026-03-30T12:45:00Z",
  "invoice": {
    "id": "inv_01J_DOCS_EXAMPLE",
    "merchant_order_id": "order_102394",
    "provider_order_id": "cc_992211",
    "status": "confirmed",
    "amount_fiat": "100.00",
    "fiat_currency": "USD",
    "amount_crypto": "100.25",
    "crypto_currency": "USDT",
    "network": "TRC20",
    "payment_address": "TG9...example"
  },
  "transaction": {
    "id": "tx_01J_DOCS_EXAMPLE",
    "status": "confirmed",
    "gross_amount": "100.00",
    "provider_fee": "0.20",
    "platform_fee": "0.80",
    "turnover_fee": "0.10",
    "net_amount": "98.90",
    "currency": "USDT"
  }
}`;

  async function handleCopy(value: string, title: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`Скопировано: ${title}`);
    } catch {
      setCopyMessage(`Не удалось скопировать: ${title}`);
    }
  }

  return (
    <article className="panel panel-span-2 api-docs-panel api-docs-landing">
      <section className="api-docs-hero">
        <div className="api-docs-hero-copy">
          <p className="eyebrow">Merchant API Reference</p>
          <h2>Noren для приёма криптооплат</h2>
          <p className="muted-text">
            Полная документация по merchant-endpoint’ам: авторизация, примеры запросов, success
            payloads и типовые ошибки для каждого доступного метода.
          </p>
          <div className="api-docs-actions">
            <a className="ghost-button" href={docsUrl} rel="noreferrer" target="_blank">
              Swagger UI
            </a>
            <a className="ghost-button" href={openApiUrl} rel="noreferrer" target="_blank">
              OpenAPI JSON
            </a>
          </div>
        </div>

        <div className="api-docs-kpi-grid">
          <article className="detail-chip">
            <span>Base URL</span>
            <code className="detail-tech-value">{apiBaseUrl}</code>
          </article>
          <article className="detail-chip">
            <span>Рекомендуемый маршрут</span>
            <code className="detail-tech-value">{selectedRoute}</code>
          </article>
          <article className="detail-chip">
            <span>Webhook URL</span>
            <code className="detail-tech-value">{activeWebhookUrl ?? "Ещё не настроен"}</code>
          </article>
          <article className="detail-chip">
            <span>Основная auth-схема</span>
            <code className="detail-tech-value">X-API-Key + X-API-Secret</code>
          </article>
        </div>
      </section>

      <section className="api-docs-quicknav">
        <a href="#docs-start">Старт</a>
        <a href="#docs-auth">Авторизация</a>
        <a href="#docs-reference">Endpoint Reference</a>
        <a href="#docs-webhooks">Webhook</a>
        <a href="#docs-faq">FAQ</a>
      </section>

      <section className="api-docs-grid api-docs-grid-feature" id="docs-start">
        <article className="api-docs-section api-docs-feature-card">
          <div className="api-docs-section-head">
            <p className="eyebrow">Быстрый старт</p>
            <h3>Пошаговое подключение</h3>
          </div>
          <ol className="api-docs-steps">
            <li>В кабинете клиента откройте раздел `API-ключи` и получите `public key` + `secret key`.</li>
            <li>Сохраните оба значения только на backend стороне вашего проекта.</li>
            <li>Вызовите `GET /rates`, чтобы выбрать доступный токен и сеть.</li>
            <li>Создайте тестовый инвойс через `POST /invoices`.</li>
            <li>Проверьте статус через `GET /invoices/{`{invoice_id}`}` и `POST /sync`.</li>
            <li>Настройте webhook и проверьте доставку через `POST /webhooks/test`.</li>
          </ol>
        </article>

        <article className="api-docs-section api-docs-feature-card">
          <div className="api-docs-section-head">
            <p className="eyebrow">Ключи доступа</p>
            <h3>Где взять public и secret</h3>
          </div>
          <div className="integration-list">
            <p>Public key виден в кабинете клиента в разделе `API-ключи`.</p>
            <p>Secret key показывается при создании или перевыпуске ключа и должен быть сохранён сразу.</p>
            <p>Secret нельзя хранить в frontend, браузере или публичном репозитории.</p>
          </div>
        </article>
      </section>

      <section className="api-docs-section" id="docs-auth">
        <div className="api-docs-section-head">
          <p className="eyebrow">Авторизация</p>
          <h3>Заголовки для server-to-server интеграции</h3>
        </div>
        <pre className="json-box">{authHeadersExample}</pre>
        <ul className="integration-list">
          <li>`X-API-Key` и `X-API-Secret` используются для merchant API методов оплаты.</li>
          <li>`Authorization: Bearer &lt;jwt&gt;` используется для cabinet-only методов, например webhooks.</li>
          <li>После ротации ключей нужно обновить backend-конфигурацию немедленно.</li>
        </ul>
        <div className="action-row-inline">
          <button
            className="ghost-button"
            onClick={() => void handleCopy(authHeadersExample, "Заголовки авторизации")}
            type="button"
          >
            Копировать заголовки
          </button>
        </div>
      </section>

      <section className="api-docs-section" id="docs-reference">
        <div className="api-docs-section-head">
          <p className="eyebrow">Endpoint Reference</p>
          <h3>Запросы, ответы и ошибки по каждому merchant endpoint</h3>
        </div>

        <div className="api-docs-endpoint-list">
          {endpointReferences.map((endpoint) => (
            <article key={endpoint.id} className="api-docs-endpoint-card">
              <div className="api-docs-endpoint-head">
                <div>
                  <p className="eyebrow">{endpoint.title}</p>
                  <h3>{endpoint.path}</h3>
                </div>
                <span
                  className={`status-pill ${
                    endpoint.method === "GET" ? "status-pill-neutral" : "status-pill-ok"
                  }`}
                >
                  {endpoint.method}
                </span>
              </div>

              <div className="api-docs-endpoint-meta">
                <div>
                  <span>Назначение</span>
                  <strong>{endpoint.purpose}</strong>
                </div>
                <div>
                  <span>Авторизация</span>
                  <strong>{endpoint.auth}</strong>
                </div>
              </div>

              {endpoint.notes?.length ? (
                <ul className="integration-list">
                  {endpoint.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}

              <div className="api-docs-endpoint-grid">
                {endpoint.requestExample ? (
                  <article className="result-box api-docs-code-card">
                    <div className="api-docs-section-head">
                      <p className="eyebrow">Request</p>
                      <h3>Пример запроса</h3>
                    </div>
                    <pre className="json-box">{endpoint.requestExample}</pre>
                    <button
                      className="ghost-button"
                      onClick={() => void handleCopy(endpoint.requestExample ?? "", `${endpoint.id} request`)}
                      type="button"
                    >
                      Копировать запрос
                    </button>
                  </article>
                ) : null}

                <article className="result-box api-docs-code-card">
                  <div className="api-docs-section-head">
                    <p className="eyebrow">Success</p>
                    <h3>Успешный ответ</h3>
                  </div>
                  <pre className="json-box">{endpoint.successExample}</pre>
                  <button
                    className="ghost-button"
                    onClick={() => void handleCopy(endpoint.successExample, `${endpoint.id} success`)}
                    type="button"
                  >
                    Копировать success
                  </button>
                </article>

                <article className="result-box api-docs-code-card">
                  <div className="api-docs-section-head">
                    <p className="eyebrow">Error</p>
                    <h3>Типовая ошибка</h3>
                  </div>
                  <pre className="json-box">{endpoint.errorExample}</pre>
                  <button
                    className="ghost-button"
                    onClick={() => void handleCopy(endpoint.errorExample, `${endpoint.id} error`)}
                    type="button"
                  >
                    Копировать ошибку
                  </button>
                </article>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="api-docs-grid" id="docs-webhooks">
        <article className="result-box api-docs-code-card">
          <div className="api-docs-section-head">
            <p className="eyebrow">Webhook config</p>
            <h3>Настроить webhook</h3>
          </div>
          <pre className="json-box">{webhookConfigExample}</pre>
          <p className="muted-text">Этот endpoint относится к cabinet-only потоку и требует JWT.</p>
        </article>

        <article className="result-box api-docs-code-card">
          <div className="api-docs-section-head">
            <p className="eyebrow">Webhook test</p>
            <h3>Отправить тестовую доставку</h3>
          </div>
          <pre className="json-box">{webhookTestExample}</pre>
          <p className="muted-text">Используйте его после сохранения webhook URL и secret.</p>
        </article>

        <article className="result-box api-docs-code-card">
          <div className="api-docs-section-head">
            <p className="eyebrow">Payload</p>
            <h3>Формат входящего webhook</h3>
          </div>
          <pre className="json-box">{webhookPayloadExample}</pre>
          <ul className="integration-list">
            <li>Проверяйте подпись в `X-Merset-Signature` и timestamp заголовок.</li>
            <li>Сохраняйте `event_id`, чтобы исключить повторную обработку.</li>
            <li>Отвечайте `2xx` только после успешной записи события во внутреннюю систему.</li>
          </ul>
        </article>
      </section>

      <section className="api-docs-section" id="docs-faq">
        <div className="api-docs-section-head">
          <p className="eyebrow">FAQ</p>
          <h3>Частые вопросы команды интеграции</h3>
        </div>
        <div className="api-docs-faq">
          {FAQ_ITEMS.map((item) => (
            <article key={item.title} className="api-docs-faq-item">
              <h4>{item.title}</h4>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {copyMessage ? <p className="muted-text integration-copy-note">{copyMessage}</p> : null}
    </article>
  );
}

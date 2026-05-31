import { useEffect, useMemo, useState } from "react";

import { ApiCodePanel } from "./ApiCodePanel";

export type MerchantApiReferenceProps = {
  apiBaseUrl: string;
  activeApiKeyPublic: string | null;
  selectedRoute: string;
  activeWebhookUrl: string | null;
  integrationCurl: string;
  presentation?: "cabinet" | "docs";
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

const TOC_MAIN = [
  { href: "#docs-start", label: "Быстрый старт" },
  { href: "#docs-auth", label: "Авторизация" },
  { href: "#docs-endpoints-table", label: "Сводка методов" },
  { href: "#docs-reference", label: "Примеры запросов" },
  { href: "#docs-cabinet", label: "Кабинет (JWT)" },
  { href: "#docs-webhooks", label: "Webhook" },
  { href: "#docs-faq", label: "FAQ" },
];

const API_FLOW_STEPS = [
  {
    key: "keys",
    title: "Ключи",
    text: "Получите public/secret и храните secret только на backend.",
  },
  {
    key: "rates",
    title: "Rates",
    text: "Проверьте доступные валюты, сети и лимиты перед созданием платежа.",
  },
  {
    key: "invoice",
    title: "Инвойс",
    text: "Создайте счет с merchant_order_id и сохраните id ответа.",
  },
  {
    key: "webhook",
    title: "Webhook",
    text: "Принимайте события, проверяйте подпись и дедуплицируйте event_id.",
  },
];

const ENDPOINT_GROUP_LABELS: Record<string, string> = {
  smoke: "Проверка",
  auth: "Доступ",
  payments: "Оплаты",
  accounting: "Финансы",
};

function endpointGroup(id: string) {
  if (id === "health") return "smoke";
  if (id === "login") return "auth";
  if (["balance", "transactions", "transaction"].includes(id)) return "accounting";
  return "payments";
}

export function MerchantApiReference({
  apiBaseUrl,
  activeApiKeyPublic,
  selectedRoute,
  activeWebhookUrl,
  integrationCurl,
  presentation = "cabinet",
}: MerchantApiReferenceProps) {
  const isDocsPresentation = presentation === "docs";
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
        auth: "Нет",
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
        auth: "Нет",
        requestExample: `curl -X POST "${apiBaseUrl}/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "owner@example.com",
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
        purpose: "Создать счёт на оплату с crypto route, payment address и ссылкой на checkout-страницу.",
        auth: "X-API-Key + X-API-Secret",
        notes: [
          "project_id должен принадлежать API-ключу.",
          "Перед созданием инвойса вызывайте GET /rates: min_deposit — в криптовалюте (как у CryptoCash list-in), min_deposit_fiat — ориентир в USD.",
          "payment_page_url — готовая страница для клиента (QR, таймер, статус). H2H-реквизиты остаются в payment_address.",
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
  "payment_page_url": "https://noren.digital/pay/abc123example",
  "qr_url": "https://example.com/qr/inv_01J_DOCS_EXAMPLE",
  "status": "pending",
  "expires_at": "2026-04-06T11:45:00Z",
  "created_at": "2026-04-06T11:30:00Z"
}`,
        errorExample: `HTTP 400
{
  "detail": {
    "code": "amount_out_of_range",
    "message": "Сумма 1 USDT для USDT/TRC20 вне допустимого диапазона (min 5 USDT, max 5000 USDT). Запрошено ≈ 1 USD.",
    "currency": "USDT",
    "network": "TRC20",
    "amount": "1",
    "amount_unit": "USDT",
    "amount_fiat": "1",
    "fiat_currency": "USD",
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
    "payment_page_url": "https://noren.digital/pay/abc123example",
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
  "payment_page_url": "https://noren.digital/pay/abc123example",
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
        purpose:
          "Принудительно обновить статус инвойса у провайдера. Требуется право client.invoices.write и при авторизации по API-ключу, и при JWT.",
        auth: "X-API-Key + X-API-Secret (или Bearer JWT с client.invoices.write)",
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
  "payment_page_url": "https://noren.digital/pay/abc123example",
  "qr_url": "https://example.com/qr/inv_01J_DOCS_EXAMPLE",
  "status": "confirmed",
  "expires_at": "2026-04-06T11:45:00Z",
  "created_at": "2026-04-06T11:30:00Z"
}`,
        errorExample: `HTTP 403
{
  "detail": "Недостаточно прав: client.invoices.write."
}`,
      },
      {
        id: "rates",
        method: "GET",
        path: "/api/v1/client/rates",
        title: "Получить доступные rates",
        purpose: "Список валют и сетей с лимитами депозита/вывода и флагами доступности (см. поля в ответе).",
        auth: "X-API-Key + X-API-Secret",
        requestExample: `curl -X GET "${apiBaseUrl}/rates" \\
  -H "X-API-Key: ${publicKey}" \\
  -H "X-API-Secret: <secret_key>"`,
        successExample: `{
  "items": [
    {
      "currency": "USDT",
      "networks": [
        {
          "network": "TRC20",
          "ticker": "USDTTRC",
          "min_deposit": "5",
          "max_deposit": "5000",
          "min_deposit_fiat": "5",
          "max_deposit_fiat": "5000",
          "min_withdraw": "10",
          "max_withdraw": "100000",
          "network_fee": "1",
          "availability": true,
          "provider_availability": true,
          "platform_enabled": true,
          "client_available": true,
          "availability_reason": null,
          "acquiring": true,
          "withdrawal": true,
          "memo_required": false
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
        purpose: "Доступный, замороженный и суммарный баланс в расчётной валюте тенанта.",
        auth: "X-API-Key + X-API-Secret",
        requestExample: `curl -X GET "${apiBaseUrl}/balance" \\
  -H "X-API-Key: ${publicKey}" \\
  -H "X-API-Secret: <secret_key>"`,
        successExample: `{
  "currency": "USDT",
  "amount": "9821.34",
  "available_amount": "9500.00",
  "locked_amount": "321.34",
  "total_amount": "9821.34"
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

  const endpointToc = useMemo(
    () => endpointReferences.map((e) => ({ href: `#endpoint-${e.id}`, label: e.title })),
    [endpointReferences],
  );
  const endpointStats = useMemo(
    () => ({
      total: endpointReferences.length,
      get: endpointReferences.filter((endpoint) => endpoint.method === "GET").length,
      post: endpointReferences.filter((endpoint) => endpoint.method === "POST").length,
      secure: endpointReferences.filter((endpoint) => endpoint.auth !== "Нет").length,
    }),
    [endpointReferences],
  );
  const endpointGroups = useMemo(
    () =>
      endpointReferences.reduce<Record<string, EndpointReference[]>>((acc, endpoint) => {
        const group = endpointGroup(endpoint.id);
        acc[group] = [...(acc[group] ?? []), endpoint];
        return acc;
      }, {}),
    [endpointReferences],
  );
  const readinessCards = [
    {
      title: "Base URL",
      value: apiBaseUrl,
      tone: "info",
    },
    {
      title: "API key",
      value: activeApiKeyPublic ? "Активный ключ найден" : "Ключ не выбран",
      tone: activeApiKeyPublic ? "ok" : "warn",
    },
    {
      title: "Webhook",
      value: activeWebhookUrl ?? "Ещё не настроен",
      tone: activeWebhookUrl ? "ok" : "warn",
    },
    {
      title: "Роут платежей",
      value: selectedRoute,
      tone: "info",
    },
  ];

  const cabinetMeExample = `curl -X GET "${apiBaseUrl}/me" \\
  -H "Authorization: Bearer <jwt_access>"`;

  const cabinetPingExample = `curl -X GET "${apiBaseUrl}/cabinet" \\
  -H "Authorization: Bearer <jwt_access>"`;

  const cabinetMeSuccess = `{
  "id": "<user_id>",
  "tenant_id": "<tenant_id>",
  "email": "owner@example.com",
  "full_name": "Owner",
  "role": "owner",
  "status": "active",
  "permissions": ["client.invoices.read", "client.invoices.write"],
  "totp_enabled": false
}`;

  const cabinetPingSuccess = `{
  "status": "ok",
  "message": "Добро пожаловать, Owner. Кабинет доступен."
}`;

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
    "payment_address": "TG9...example",
    "payment_page_url": "https://noren.digital/pay/abc123example"
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

  useEffect(() => {
    if (!copyMessage) {
      return;
    }
    const timer = window.setTimeout(() => setCopyMessage(null), 3200);
    return () => window.clearTimeout(timer);
  }, [copyMessage]);

  async function handleCopy(value: string, title: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`Скопировано: ${title}`);
    } catch {
      setCopyMessage(`Не удалось скопировать: ${title}`);
    }
  }

  return (
    <article
      className={`mc-surface mc-surface--docs api-docs-panel api-docs-landing${
        isDocsPresentation ? " api-docs-panel--docs" : ""
      }`}
    >
      <div className={isDocsPresentation ? "api-docs-layout-main" : "api-docs-layout"}>
        {!isDocsPresentation ? (
          <aside className="api-docs-toc" aria-label="Оглавление документации">
            <p className="api-docs-toc-title">На странице</p>
            <nav className="api-docs-toc-nav">
              {TOC_MAIN.map((item) => (
                <a href={item.href} key={item.href}>
                  {item.label}
                </a>
              ))}
              <p className="api-docs-toc-title api-docs-toc-title-sub">Эндпоинты</p>
              {endpointToc.map((item) => (
                <a href={item.href} key={item.href}>
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>
        ) : null}

        <div className="api-docs-layout-main">
          {isDocsPresentation ? (
            <section className="api-docs-docs-toolbar" id="docs-toolbar">
              <div className="api-docs-docs-toolbar-copy">
                <p className="eyebrow">Environment</p>
                <h3>Base URL и OpenAPI</h3>
                <p className="muted-text">
                  Все примеры ниже используют ваш production Base URL. Копируйте curl и JSON напрямую в
                  backend.
                </p>
              </div>
              <div className="api-docs-docs-toolbar-actions">
                <code className="api-docs-base-url">{apiBaseUrl}</code>
                <div className="api-docs-actions">
                  <button
                    className="ghost-button"
                    onClick={() => void handleCopy(apiBaseUrl, "Base URL")}
                    type="button"
                  >
                    Copy Base URL
                  </button>
                  <a className="ghost-button" href={docsUrl} rel="noreferrer" target="_blank">
                    Swagger
                  </a>
                  <a className="ghost-button" href={openApiUrl} rel="noreferrer" target="_blank">
                    openapi.json
                  </a>
                </div>
              </div>
            </section>
          ) : (
            <>
              <section className="api-docs-hero">
            <div className="api-docs-hero-copy">
              <p className="eyebrow">Merchant API Reference</p>
              <h2>Интеграция приёма криптооплат</h2>
              <p className="muted-text">
                Практический экран для backend-разработчика: статус окружения, путь подключения, быстрые копии
                и подробный контракт без необходимости открывать внешнюю документацию.
              </p>
              <div className="api-docs-actions">
                <a className="ghost-button" href={docsUrl} rel="noreferrer" target="_blank">
                  Swagger UI
                </a>
                <a className="ghost-button" href={openApiUrl} rel="noreferrer" target="_blank">
                  OpenAPI JSON
                </a>
                <button
                  className="ghost-button"
                  onClick={() => void handleCopy(apiBaseUrl, "Base URL")}
                  type="button"
                >
                  Копировать Base URL
                </button>
              </div>
            </div>

            <div className="api-docs-status-board" aria-label="Статус интеграции">
              {readinessCards.map((item) => (
                <article className={`api-docs-status-card api-docs-status-card-${item.tone}`} key={item.title}>
                  <span>{item.title}</span>
                  <code>{item.value}</code>
                </article>
              ))}
            </div>
          </section>

          <section className="api-docs-flow" aria-label="Основной путь подключения">
            {API_FLOW_STEPS.map((step, index) => (
              <article className="api-docs-flow-step" key={step.key}>
                <span className="api-docs-flow-index">{index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.text}</p>
                </div>
              </article>
            ))}
          </section>

          <section className="api-docs-metrics" aria-label="Сводка контракта API">
            <article>
              <span>Методов</span>
              <strong>{endpointStats.total}</strong>
              <p>Полный набор для оплат, баланса, транзакций и статуса.</p>
            </article>
            <article>
              <span>GET / POST</span>
              <strong>
                {endpointStats.get} / {endpointStats.post}
              </strong>
              <p>Чтение отделено от мутаций, удобно для прав и rate-limit.</p>
            </article>
            <article>
              <span>Защищены ключами</span>
              <strong>{endpointStats.secure}</strong>
              <p>Основная схема: X-API-Key + X-API-Secret.</p>
            </article>
          </section>

          <section className="api-docs-group-map" aria-label="Группы API-методов">
            {Object.entries(ENDPOINT_GROUP_LABELS).map(([group, label]) => (
              <article className="api-docs-group-card" key={group}>
                <span>{label}</span>
                <strong>{endpointGroups[group]?.length ?? 0}</strong>
                <div>
                  {(endpointGroups[group] ?? []).map((endpoint) => (
                    <a href={`#endpoint-${endpoint.id}`} key={endpoint.id}>
                      {endpoint.method} {endpoint.path.replace("/api/v1/client", "")}
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </section>
            </>
          )}

          <section className="api-docs-grid api-docs-grid-feature" id="docs-start">
            <article className="api-docs-section api-docs-feature-card">
              <div className="api-docs-section-head">
                <p className="eyebrow">Быстрый старт</p>
                <h3>Пошаговое подключение</h3>
              </div>
              <ol className="api-docs-steps">
                <li>В кабинете клиента откройте раздел «API-ключи» и получите public key и secret key.</li>
                <li>Сохраните оба значения только на backend стороне вашего проекта.</li>
                <li>Вызовите GET /rates, чтобы выбрать доступный токен и сеть.</li>
                <li>Создайте тестовый инвойс через POST /invoices.</li>
                <li>Проверьте статус через GET /invoices/&lt;invoice_id&gt; и при необходимости POST /sync.</li>
                <li>Настройте webhook (JWT) и проверьте доставку через POST /webhooks/test.</li>
              </ol>
            </article>

            <article className="api-docs-section api-docs-feature-card">
              <div className="api-docs-section-head">
                <p className="eyebrow">Ключи доступа</p>
                <h3>Где взять public и secret</h3>
              </div>
              <div className="integration-list">
                <p>Public key виден в кабинете клиента в разделе «API-ключи».</p>
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
              <li>X-API-Key и X-API-Secret — для оплатных и учётных методов merchant API.</li>
              <li>Authorization: Bearer &lt;jwt&gt; — для сценариев кабинета: webhooks, /me, /cabinet и др.</li>
              <li>После ротации ключей обновите конфигурацию backend без задержки.</li>
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

          <section className="api-docs-section" id="docs-endpoints-table">
            <div className="api-docs-section-head">
              <p className="eyebrow">Сводка</p>
              <h3>Все merchant-методы в одной таблице</h3>
            </div>
            <p className="muted-text">
              Полные пути соответствуют префиксу вашего Base URL (уже включает /api/v1/client). Ниже — канонический
              путь в OpenAPI.
            </p>
            <div className="api-docs-mobile-endpoints" aria-label="Краткая сводка методов">
              {endpointReferences.map((row) => (
                <a className="api-docs-mobile-endpoint-card" href={`#endpoint-${row.id}`} key={row.id}>
                  <span
                    className={`api-docs-method-tag ${
                      row.method === "GET" ? "api-docs-method-get" : "api-docs-method-post"
                    }`}
                  >
                    {row.method}
                  </span>
                  <strong>{row.title}</strong>
                  <code>{row.path}</code>
                  <small>{row.auth}</small>
                </a>
              ))}
            </div>
            <div className="api-docs-table-wrap">
              <table className="api-docs-table">
                <thead>
                  <tr>
                    <th>Метод</th>
                    <th>Путь</th>
                    <th>Авторизация</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {endpointReferences.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span
                          className={`api-docs-method-tag ${
                            row.method === "GET" ? "api-docs-method-get" : "api-docs-method-post"
                          }`}
                        >
                          {row.method}
                        </span>
                      </td>
                      <td>
                        <code>{row.path}</code>
                      </td>
                      <td>{row.auth}</td>
                      <td>
                        <a className="api-docs-table-link" href={`#endpoint-${row.id}`}>
                          Подробнее
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="api-docs-section" id="docs-reference">
            <div className="api-docs-section-head">
              <p className="eyebrow">Endpoint Reference</p>
              <h3>Запросы, ответы и ошибки</h3>
            </div>

            <div className="api-docs-endpoint-list">
              {endpointReferences.map((endpoint) => (
                <article
                  className={`api-docs-endpoint-card${
                    isDocsPresentation ? " api-docs-endpoint-card--split" : ""
                  }`}
                  id={`endpoint-${endpoint.id}`}
                  key={endpoint.id}
                >
                  <div className="api-docs-endpoint-copy">
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
                  </div>

                  <ApiCodePanel
                    endpointId={endpoint.id}
                    errorExample={endpoint.errorExample}
                    onCopy={handleCopy}
                    requestExample={endpoint.requestExample}
                    successExample={endpoint.successExample}
                  />
                </article>
              ))}
            </div>
          </section>

          <section className="api-docs-section" id="docs-cabinet">
            <div className="api-docs-section-head">
              <p className="eyebrow">Кабинет</p>
              <h3>JWT: профиль и проверка доступа</h3>
            </div>
            <p className="muted-text">
              После POST /auth/login используйте <code>access_token</code> в заголовке Authorization. Эти маршруты
              удобны для серверных BFF-прослоек рядом с кабинетом; массовые оплаты по-прежнему делаются через API-ключ.
            </p>
            <div className="api-docs-grid">
              <article className="result-box api-docs-code-card">
                <div className="api-docs-section-head">
                  <p className="eyebrow">GET /me</p>
                  <h3>Текущий пользователь и права</h3>
                </div>
                <pre className="json-box">{cabinetMeExample}</pre>
                <pre className="json-box">{cabinetMeSuccess}</pre>
                <div className="action-row-inline">
                  <button
                    className="ghost-button"
                    onClick={() => void handleCopy(`${cabinetMeExample}\n\n${cabinetMeSuccess}`, "GET /me")}
                    type="button"
                  >
                    Копировать пример
                  </button>
                </div>
              </article>
              <article className="result-box api-docs-code-card">
                <div className="api-docs-section-head">
                  <p className="eyebrow">GET /cabinet</p>
                  <h3>Проверка доступа к кабинету</h3>
                </div>
                <pre className="json-box">{cabinetPingExample}</pre>
                <pre className="json-box">{cabinetPingSuccess}</pre>
                <div className="action-row-inline">
                  <button
                    className="ghost-button"
                    onClick={() => void handleCopy(`${cabinetPingExample}\n\n${cabinetPingSuccess}`, "GET /cabinet")}
                    type="button"
                  >
                    Копировать пример
                  </button>
                </div>
              </article>
            </div>
          </section>

          <section className="api-docs-grid" id="docs-webhooks">
            <article className="result-box api-docs-code-card">
              <div className="api-docs-section-head">
                <p className="eyebrow">Webhook config</p>
                <h3>Настроить webhook</h3>
              </div>
              <pre className="json-box">{webhookConfigExample}</pre>
              <p className="muted-text">Требуется JWT и право client.webhooks.write.</p>
              <div className="action-row-inline">
                <button
                  className="ghost-button"
                  onClick={() => void handleCopy(webhookConfigExample, "Webhook config")}
                  type="button"
                >
                  Копировать
                </button>
              </div>
            </article>

            <article className="result-box api-docs-code-card">
              <div className="api-docs-section-head">
                <p className="eyebrow">Webhook test</p>
                <h3>Отправить тестовую доставку</h3>
              </div>
              <pre className="json-box">{webhookTestExample}</pre>
              <p className="muted-text">Используйте после сохранения webhook URL и secret.</p>
              <div className="action-row-inline">
                <button
                  className="ghost-button"
                  onClick={() => void handleCopy(webhookTestExample, "Webhook test")}
                  type="button"
                >
                  Копировать
                </button>
              </div>
            </article>

            <article className="result-box api-docs-code-card">
              <div className="api-docs-section-head">
                <p className="eyebrow">Payload</p>
                <h3>Формат входящего webhook</h3>
              </div>
              <pre className="json-box">{webhookPayloadExample}</pre>
              <ul className="integration-list">
                <li>Проверяйте подпись в заголовке X-Merset-Signature.</li>
                <li>Сохраняйте event_id, чтобы исключить повторную обработку.</li>
                <li>Отвечайте 2xx только после успешной записи события во внутреннюю систему.</li>
              </ul>
              <div className="action-row-inline">
                <button
                  className="ghost-button"
                  onClick={() => void handleCopy(webhookPayloadExample, "Webhook payload")}
                  type="button"
                >
                  Копировать payload
                </button>
              </div>
            </article>
          </section>

          <section className="api-docs-section" id="docs-faq">
            <div className="api-docs-section-head">
              <p className="eyebrow">FAQ</p>
              <h3>Частые вопросы команды интеграции</h3>
            </div>
            <div className="api-docs-faq">
              {FAQ_ITEMS.map((item) => (
                <article className="api-docs-faq-item" key={item.title}>
                  <h4>{item.title}</h4>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>

      {copyMessage ? (
        <div className="api-docs-copy-toast" role="status">
          {copyMessage}
        </div>
      ) : null}
    </article>
  );
}

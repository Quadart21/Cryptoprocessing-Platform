import { useEffect, useMemo, useState } from "react";

import {
  formatUsd,
  MERCHANT_COMMISSION_BREAK_EVEN_USD,
  MERCHANT_COMMISSION_EXAMPLES,
  MERCHANT_COMMISSION_MIN_USD,
  MERCHANT_COMMISSION_PERCENT,
} from "./merchantCommissionDocs";
import { docsShowsBlock } from "../../types/docsSection";
import type { DocsSectionKey } from "../../types/docsSection";
import { ApiCodePanel } from "./ApiCodePanel";

export type { DocsSectionKey };

export type MerchantApiReferenceProps = {
  apiBaseUrl: string;
  activeApiKeyPublic: string | null;
  selectedRoute: string;
  activeWebhookUrl: string | null;
  integrationCurl: string;
  presentation?: "cabinet" | "docs";
  docsSection?: DocsSectionKey;
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
    title: "Где взять public и secret?",
    body:
      "Кабинет → API-ключи. Secret показывается при создании или перевыпуске — сохраните сразу в backend или секрет-хранилище.",
  },
  {
    title: "Куда сохранять ключи?",
    body:
      "Только на backend. Не используйте secret во frontend, браузере, мобильном приложении или публичном репозитории.",
  },
  {
    title: "Payment page или H2H?",
    body:
      "checkout_delivery в настройках проекта: payment_page — только payment_page_url (/pay/{token}); h2h — payment_address и qr_url; both — оба. Правило одинаково для POST /invoices, GET /invoices и webhook.",
  },
  {
    title: "Что делать при 4xx и 5xx?",
    body:
      "4xx — ошибка в payload, ключах или параметрах. 5xx и 502/504 — retry с backoff, логируйте correlation/event id.",
  },
  {
    title: "Как считается комиссия?",
    body: `${MERCHANT_COMMISSION_PERCENT}% от суммы успешного платежа, но не менее ${formatUsd(
      MERCHANT_COMMISSION_MIN_USD,
    )}. Подробнее — раздел «Комиссии».`,
  },
];

const TOC_MAIN = [
  { href: "#docs-start", label: "Быстрый старт" },
  { href: "#docs-auth", label: "Авторизация" },
  { href: "#docs-checkout-delivery", label: "Checkout: page / H2H" },
  { href: "#docs-endpoints-table", label: "Сводка методов" },
  { href: "#docs-reference", label: "Примеры запросов" },
  { href: "#docs-cabinet", label: "Кабинет (JWT)" },
  { href: "#docs-webhooks", label: "Webhook" },
  { href: "#docs-commissions", label: "Комиссии" },
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
    text: "Проверьте доступные валюты, сети, лимиты и тариф: 0,4% (мин. $0,70) за платёж.",
  },
  {
    key: "invoice",
    title: "Инвойс",
    text: "Создайте счёт и отдайте клиенту payment_page_url или H2H-реквизиты — формат задаётся checkout_delivery проекта.",
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
  docsSection,
}: MerchantApiReferenceProps) {
  const isDocsPresentation = presentation === "docs";
  const show = (block: string) => docsShowsBlock(docsSection, block, isDocsPresentation);
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
        purpose: "Создать счёт на оплату. Формат реквизитов в ответе определяется checkout_delivery проекта.",
        auth: "X-API-Key + X-API-Secret",
        notes: [
          "project_id должен принадлежать API-ключу.",
          "Перед созданием инвойса вызывайте GET /rates: min_deposit — в криптовалюте (как у CryptoCash list-in), min_deposit_fiat — ориентир в USD.",
          "checkout_delivery проекта: payment_page → только payment_page_url; h2h → payment_address и qr_url; both → все поля.",
          "payment_page_url ведёт на hosted checkout (QR, таймер, статус). Для кастомного UI можно опрашивать GET /api/v1/public/pay/{token}.",
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
  "payment_page_url": "https://noren.digital/pay/abc123example",
  "checkout_delivery": "payment_page",
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
    "payment_page_url": "https://noren.digital/pay/abc123example",
    "checkout_delivery": "payment_page",
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
  "payment_page_url": "https://noren.digital/pay/abc123example",
  "checkout_delivery": "payment_page",
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
  "payment_page_url": "https://noren.digital/pay/abc123example",
  "checkout_delivery": "payment_page",
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
  "amount": "9500.00",
  "available_amount": "9500.00",
  "frozen_amount": "321.34",
  "pending_amount": "0.00",
  "locked_amount": "120.00",
  "total_amount": "9941.34",
  "hold_hours": 24,
  "next_release_at": "2026-06-05T12:00:00Z",
  "holds": []
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
    "webhook_secret": "merchant-webhook-secret",
    "checkout_delivery": "payment_page"
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
    "payment_page_url": "https://noren.digital/pay/abc123example",
    "checkout_delivery": "payment_page"
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
      className={`mc-surface mc-surface--docs api-docs-panel${
        isDocsPresentation ? " api-docs-panel--docs api-docs-panel--split" : " api-docs-landing"
      }`}
    >
      <div className={isDocsPresentation ? "api-docs-layout-main api-docs-layout-main--solo" : "api-docs-layout"}>
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

        <div className={isDocsPresentation ? "api-docs-layout-main api-docs-layout-main--solo" : "api-docs-layout-main"}>
          {show("toolbar") ? (
            <section className="api-docs-docs-toolbar" id="docs-toolbar">
              <div className="api-docs-docs-toolbar-copy">
                <p className="eyebrow">Environment</p>
                <h3>Base URL и OpenAPI</h3>
                <p className="muted-text">
                  Примеры используют ваш Base URL. Копируйте curl и JSON в backend.
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
                    Скопировать Base URL
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
          ) : null}

          {!isDocsPresentation ? (
            <>
              <section className="api-docs-hero">
                <div className="api-docs-hero-copy">
                  <p className="eyebrow">Merchant API Reference</p>
                  <h2>Интеграция приёма криптооплат</h2>
                  <p className="muted-text">
                    Практический экран для backend-разработчика: статус окружения, путь подключения, быстрые
                    копии и подробный контракт.
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
                  <p>Чтение отделено от мутаций.</p>
                </article>
                <article>
                  <span>Защищены ключами</span>
                  <strong>{endpointStats.secure}</strong>
                  <p>X-API-Key + X-API-Secret.</p>
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
          ) : null}

          {show("start") ? (
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
                <li>Формат checkout (payment page или H2H) задаёт администратор платформы для вашего проекта.</li>
                <li>Отправьте клиенту payment_page_url или покажите адрес/QR — в зависимости от режима.</li>
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
          ) : null}

          {show("auth") ? (
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
          ) : null}

          {show("checkout") ? (
          <section className="api-docs-section" id="docs-checkout-delivery">
            <div className="api-docs-section-head">
              <p className="eyebrow">Checkout</p>
              <h3>Платёжная страница или H2H-реквизиты</h3>
            </div>
            <p className="muted-text">
              Для каждого проекта администратор платформы задаёт <code>checkout_delivery</code>. Мерчант видит текущий режим
              в разделе «Интеграция → Webhook», но изменить его самостоятельно не может. Поле влияет на ответ POST /invoices,
              GET /invoices и payload входящих webhook.
            </p>
            <div className="api-docs-grid">
              <article className="result-box api-docs-code-card">
                <div className="api-docs-section-head">
                  <p className="eyebrow">payment_page</p>
                  <h3>Hosted checkout</h3>
                </div>
                <ul className="integration-list">
                  <li>В ответе API — только <code>payment_page_url</code> (поля payment_address и qr_url отсутствуют).</li>
                  <li>Клиент переходит на страницу вида <code>/pay/&#123;token&#125;</code> — QR, адрес, таймер и статус.</li>
                  <li>Webhook дублирует тот же набор полей в объекте invoice.</li>
                </ul>
                <pre className="json-box">{`{
  "payment_page_url": "https://noren.digital/pay/abc123example",
  "checkout_delivery": "payment_page"
}`}</pre>
              </article>
              <article className="result-box api-docs-code-card">
                <div className="api-docs-section-head">
                  <p className="eyebrow">h2h</p>
                  <h3>Head-to-head интеграция</h3>
                </div>
                <ul className="integration-list">
                  <li>В ответе — <code>payment_address</code> и <code>qr_url</code>; payment_page_url отсутствует.</li>
                  <li>Подходит, если вы сами рисуете экран оплаты в своём приложении.</li>
                </ul>
                <pre className="json-box">{`{
  "payment_address": "TG9...example",
  "qr_url": "https://example.com/qr/inv_01J",
  "checkout_delivery": "h2h"
}`}</pre>
              </article>
            </div>
            <p className="muted-text" style={{ marginTop: "1rem" }}>
              Режим <code>both</code> возвращает все поля (обратная совместимость). Для кастомной checkout-страницы
              можно опрашивать публичный API без ключей:{" "}
              <code>
                GET {backendOrigin ? `${backendOrigin}/api/v1/public/pay/{token}` : "/api/v1/public/pay/{token}"}
              </code>{" "}
              и{" "}
              <code>POST .../refresh</code> для синхронизации статуса.
            </p>
          </section>
          ) : null}

          {show("endpoints") ? (
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
          ) : null}

          {show("reference") ? (
          <section className="api-docs-section" id="docs-reference">
            <div className="api-docs-section-head">
              <p className="eyebrow">Endpoint Reference</p>
              <h3>Запросы, ответы и ошибки</h3>
            </div>

            <div className="api-docs-endpoint-list">
              {endpointReferences.map((endpoint) =>
                isDocsPresentation ? (
                  <details
                    className="api-docs-endpoint-disclosure"
                    id={`endpoint-${endpoint.id}`}
                    key={endpoint.id}
                  >
                    <summary className="api-docs-endpoint-disclosure-summary">
                      <span
                        className={`api-docs-method-tag ${
                          endpoint.method === "GET" ? "api-docs-method-get" : "api-docs-method-post"
                        }`}
                      >
                        {endpoint.method}
                      </span>
                      <span>
                        <strong>{endpoint.title}</strong>
                        <code>{endpoint.path.replace("/api/v1/client", "")}</code>
                      </span>
                    </summary>
                    <article className="api-docs-endpoint-card api-docs-endpoint-card--split">
                      <div className="api-docs-endpoint-copy">
                        <p className="muted-text">{endpoint.purpose}</p>
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
                  </details>
                ) : (
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
                ),
              )}
            </div>
          </section>
          ) : null}

          {!isDocsPresentation ? (
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
          ) : null}

          {show("webhooks") ? (
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
                <li>Поля invoice.payment_page_url / payment_address / qr_url зависят от checkout_delivery проекта.</li>
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
          ) : null}

          {show("commissions") ? (
          <section className="api-docs-section" id="docs-commissions">
            <div className="api-docs-section-head">
              <p className="eyebrow">Тариф</p>
              <h3>Комиссия за успешный платёж</h3>
            </div>
            <p className="muted-text">
              Стандартный тариф для мерчанта: <strong>{MERCHANT_COMMISSION_PERCENT}%</strong> от суммы
              проведённого платежа, но <strong>не ниже {formatUsd(MERCHANT_COMMISSION_MIN_USD)}</strong>{" "}
              (эквивалент в USDT по курсу на момент settlement). Комиссия удерживается из gross до
              зачисления на баланс; в кабинете и API отображается как сумма{" "}
              <code>provider_fee</code> + <code>platform_fee</code> в транзакции.
            </p>
            <pre className="json-box">{`комиссия = max(сумма_платежа × ${MERCHANT_COMMISSION_PERCENT / 100}, ${formatUsd(MERCHANT_COMMISSION_MIN_USD)})

нетто_мерчанту = сумма_платежа − комиссия`}</pre>
            <p className="muted-text">
              Порог, при котором 0,4% равно минимуму: платежи до{" "}
              <strong>{formatUsd(MERCHANT_COMMISSION_BREAK_EVEN_USD)}</strong> включительно попадают под
              фиксированный минимум {formatUsd(MERCHANT_COMMISSION_MIN_USD)}.
            </p>

            <div className="api-docs-table-wrap">
              <table className="api-docs-table">
                <thead>
                  <tr>
                    <th>Сумма платежа</th>
                    <th>0,4% от суммы</th>
                    <th>Комиссия к удержанию</th>
                    <th>Нетто мерчанту</th>
                    <th>Комментарий</th>
                  </tr>
                </thead>
                <tbody>
                  {MERCHANT_COMMISSION_EXAMPLES.map((row) => (
                    <tr key={row.paymentUsd}>
                      <td>{formatUsd(row.paymentUsd)}</td>
                      <td>{formatUsd(row.percentFeeUsd)}</td>
                      <td>
                        <strong>{formatUsd(row.commissionUsd)}</strong>
                      </td>
                      <td>{formatUsd(row.paymentUsd - row.commissionUsd)}</td>
                      <td>{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="integration-list">
              <li>
                Комиссия сети blockchain (<code>network_fee</code> / «Комиссия сети» в кабинете) — отдельно
                от тарифа платформы и зависит от выбранной сети (TRC20, ERC20 и т.д.).
              </li>
              <li>
                Детализация по каждому платежу: <code>GET /transactions</code> и{" "}
                <code>GET /transactions/&#123;transaction_id&#125;</code> — поля{" "}
                <code>gross_amount</code>, <code>provider_fee</code>, <code>platform_fee</code>,{" "}
                <code>net_amount</code>.
              </li>
              <li>
                Для крупных объёмов возможны индивидуальные условия — согласуйте с командой платформы до
                запуска в production.
              </li>
            </ul>
          </section>
          ) : null}

          {show("faq") ? (
          <section className="api-docs-section" id="docs-faq">
            <div className="api-docs-section-head">
              <p className="eyebrow">FAQ</p>
              <h3>Частые вопросы</h3>
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
          ) : null}
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

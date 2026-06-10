import { useEffect, useMemo, useState } from "react";

import { useApiTranslation } from "../../i18n";
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
  authKey: "none" | "apiKey" | "apiKeyOrJwt";
  notes?: string[];
  requestExample?: string;
  successExample: string;
  errorExample: string;
};

type FlowStepKey = "keys" | "rates" | "invoice" | "webhook";

const FLOW_STEP_KEYS: FlowStepKey[] = ["keys", "rates", "invoice", "webhook"];
const ENDPOINT_GROUP_KEYS = ["smoke", "auth", "payments", "accounting"] as const;

const ENDPOINT_REF_KEYS: Record<string, string> = {
  health: "health",
  login: "login",
  "create-invoice": "createInvoice",
  "list-invoices": "listInvoices",
  "get-invoice": "getInvoice",
  "sync-invoice": "syncInvoice",
  rates: "rates",
  balance: "balance",
  transactions: "transactions",
  transaction: "transaction",
};

function endpointAuthKey(id: string): EndpointReference["authKey"] {
  if (id === "health" || id === "login") {
    return "none";
  }
  if (id === "sync-invoice") {
    return "apiKeyOrJwt";
  }
  return "apiKey";
}

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
  const { t, ta } = useApiTranslation();
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
        title: "",
        purpose: "",
        auth: "",
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
        title: "",
        purpose: "",
        auth: "",
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
  "detail": "Invalid email or password.",
  "code": "request_error"
}`,
      },
      {
        id: "create-invoice",
        method: "POST",
        path: "/api/v1/client/invoices",
        title: "",
        purpose: "",
        auth: "",
        notes: [],
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
    "message": "Amount 1 USDT for USDT/TRC20 is outside the allowed range (min 5 USDT, max 5000 USDT). Requested ≈ 1 USD.",
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
        title: "",
        purpose: "",
        auth: "",
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
  "detail": "Insufficient permissions: client.invoices.read.",
  "code": "request_error"
}`,
      },
      {
        id: "get-invoice",
        method: "GET",
        path: "/api/v1/client/invoices/{invoice_id}",
        title: "",
        purpose: "",
        auth: "",
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
  "detail": "Invoice not found.",
  "code": "request_error"
}`,
      },
      {
        id: "sync-invoice",
        method: "POST",
        path: "/api/v1/client/invoices/{invoice_id}/sync",
        title: "",
        purpose: "",
        auth: "",
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
  "detail": "Insufficient permissions: client.invoices.write."
}`,
      },
      {
        id: "rates",
        method: "GET",
        path: "/api/v1/client/rates",
        title: "",
        purpose: "",
        auth: "",
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
        title: "",
        purpose: "",
        auth: "",
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
  "detail": "Insufficient permissions: client.balance.read.",
  "code": "request_error"
}`,
      },
      {
        id: "transactions",
        method: "GET",
        path: "/api/v1/client/transactions",
        title: "",
        purpose: "",
        auth: "",
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
        title: "",
        purpose: "",
        auth: "",
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
  "detail": "Transaction not found.",
  "code": "request_error"
}`,
      },
    ].map((ref): EndpointReference => {
      const refKey = ENDPOINT_REF_KEYS[ref.id] ?? ref.id;
      const authKey = endpointAuthKey(ref.id);
      return {
        ...ref,
        method: ref.method as EndpointReference["method"],
        title: t(`merchant.apiDocs.endpointRefs.${refKey}.title`),
        purpose: t(`merchant.apiDocs.endpointRefs.${refKey}.purpose`),
        auth: t(`merchant.apiDocs.authLabels.${authKey}`),
        authKey,
        notes:
          ref.id === "create-invoice"
            ? ta<string>(`merchant.apiDocs.endpointRefs.${refKey}.notes`)
            : undefined,
      };
    }),
    [t, ta, apiBaseUrl, integrationCurl, publicKey],
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
      secure: endpointReferences.filter((endpoint) => endpoint.authKey !== "none").length,
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
  const tocMain = useMemo(
    () => [
      { href: "#docs-start", label: t("merchant.apiDocs.toc.start") },
      { href: "#docs-auth", label: t("merchant.apiDocs.toc.auth") },
      { href: "#docs-checkout-delivery", label: t("merchant.apiDocs.toc.checkout") },
      { href: "#docs-endpoints-table", label: t("merchant.apiDocs.toc.endpointsTable") },
      { href: "#docs-reference", label: t("merchant.apiDocs.toc.reference") },
      { href: "#docs-cabinet", label: t("merchant.apiDocs.toc.cabinet") },
      { href: "#docs-webhooks", label: t("merchant.apiDocs.toc.webhooks") },
      { href: "#docs-commissions", label: t("merchant.apiDocs.toc.commissions") },
      { href: "#docs-faq", label: t("merchant.apiDocs.toc.faq") },
    ],
    [t],
  );

  const apiFlowSteps = useMemo(
    () =>
      FLOW_STEP_KEYS.map((key) => ({
        key,
        title: t(`merchant.apiDocs.flow.${key}.title`),
        text: t(`merchant.apiDocs.flow.${key}.text`),
      })),
    [t],
  );

  const endpointGroupLabels = useMemo(
    () =>
      Object.fromEntries(
        ENDPOINT_GROUP_KEYS.map((key) => [key, t(`merchant.apiDocs.endpointGroups.${key}`)]),
      ) as Record<(typeof ENDPOINT_GROUP_KEYS)[number], string>,
    [t],
  );

  const readinessCards = useMemo(
    () => [
      {
        title: t("merchant.apiDocs.statusBoard.baseUrl"),
        value: apiBaseUrl,
        tone: "info",
      },
      {
        title: t("merchant.apiDocs.statusBoard.apiKey"),
        value: activeApiKeyPublic
          ? t("merchant.apiDocs.statusBoard.apiKeyOk")
          : t("merchant.apiDocs.statusBoard.apiKeyMissing"),
        tone: activeApiKeyPublic ? "ok" : "warn",
      },
      {
        title: t("merchant.apiDocs.statusBoard.webhook"),
        value: activeWebhookUrl ?? t("merchant.apiDocs.statusBoard.webhookMissing"),
        tone: activeWebhookUrl ? "ok" : "warn",
      },
      {
        title: t("merchant.apiDocs.statusBoard.paymentRoute"),
        value: selectedRoute,
        tone: "info",
      },
    ],
    [activeApiKeyPublic, activeWebhookUrl, apiBaseUrl, selectedRoute, t],
  );

  const quickStartSteps = useMemo(() => ta<string>("merchant.apiDocs.quickStart.steps"), [ta]);
  const quickStartKeyItems = useMemo(() => ta<string>("merchant.apiDocs.quickStart.keysItems"), [ta]);
  const authItems = useMemo(() => ta<string>("merchant.apiDocs.auth.items"), [ta]);
  const paymentPageItems = useMemo(() => ta<string>("merchant.apiDocs.checkout.paymentPageItems"), [ta]);
  const h2hItems = useMemo(() => ta<string>("merchant.apiDocs.checkout.h2hItems"), [ta]);
  const webhookPayloadItems = useMemo(() => ta<string>("merchant.apiDocs.webhooks.payloadItems"), [ta]);
  const commissionNotes = useMemo(() => ta<string>("merchant.apiDocs.commissions.notes"), [ta]);

  const faqItems = useMemo(
    () =>
      ta<{ title: string; body: string }>("merchant.apiDocs.faq.items").map((item) => ({
        title: item.title,
        body: item.body
          .replace(/\{\{percent\}\}/g, String(MERCHANT_COMMISSION_PERCENT))
          .replace(/\{\{minUsd\}\}/g, formatUsd(MERCHANT_COMMISSION_MIN_USD)),
      })),
    [ta],
  );

  const commissionFormula = useMemo(
    () =>
      t("merchant.apiDocs.commissions.formula", {
        rate: MERCHANT_COMMISSION_PERCENT / 100,
        minUsd: formatUsd(MERCHANT_COMMISSION_MIN_USD),
      }),
    [t],
  );

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
  "message": "${t("merchant.apiDocs.cabinet.pingSuccessMessage")}"
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
      setCopyMessage(t("common.copiedTitle", { title }));
    } catch {
      setCopyMessage(t("common.copyFailedTitle", { title }));
    }
  }

  return (
    <article
      lang="en"
      dir="ltr"
      className={`mc-surface mc-surface--docs api-docs-panel${
        isDocsPresentation ? " api-docs-panel--docs api-docs-panel--split" : " api-docs-landing"
      }`}
    >
      <div className={isDocsPresentation ? "api-docs-layout-main api-docs-layout-main--solo" : "api-docs-layout"}>
        {!isDocsPresentation ? (
          <aside className="api-docs-toc" aria-label={t("merchant.apiDocs.tocAria")}>
            <p className="api-docs-toc-title">{t("merchant.apiDocs.onPage")}</p>
            <nav className="api-docs-toc-nav">
              {tocMain.map((item) => (
                <a href={item.href} key={item.href}>
                  {item.label}
                </a>
              ))}
              <p className="api-docs-toc-title api-docs-toc-title-sub">{t("merchant.apiDocs.endpoints")}</p>
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
                <p className="eyebrow">{t("merchant.apiDocs.environment")}</p>
                <h3>{t("merchant.apiDocs.baseUrlOpenApi")}</h3>
                <p className="muted-text">{t("merchant.apiDocs.examplesNote")}</p>
              </div>
              <div className="api-docs-docs-toolbar-actions">
                <code className="api-docs-base-url">{apiBaseUrl}</code>
                <div className="api-docs-actions">
                  <button
                    className="ghost-button"
                    onClick={() => void handleCopy(apiBaseUrl, t("merchant.apiDocs.statusBoard.baseUrl"))}
                    type="button"
                  >
                    {t("common.copyBaseUrl")}
                  </button>
                  <a className="ghost-button" href={docsUrl} rel="noreferrer" target="_blank">
                    {t("merchant.integration.tabSwagger")}
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
                  <p className="eyebrow">{t("merchant.apiDocs.heroEyebrow")}</p>
                  <h2>{t("merchant.apiDocs.heroTitle")}</h2>
                  <p className="muted-text">{t("merchant.apiDocs.heroLead")}</p>
                  <div className="api-docs-actions">
                    <a className="ghost-button" href={docsUrl} rel="noreferrer" target="_blank">
                      {t("merchant.integration.swagger.swaggerUi")}
                    </a>
                    <a className="ghost-button" href={openApiUrl} rel="noreferrer" target="_blank">
                      {t("merchant.integration.swagger.openApiJson")}
                    </a>
                    <button
                      className="ghost-button"
                      onClick={() => void handleCopy(apiBaseUrl, t("merchant.apiDocs.statusBoard.baseUrl"))}
                      type="button"
                    >
                      {t("common.copyBaseUrl")}
                    </button>
                  </div>
                </div>

                <div className="api-docs-status-board" aria-label={t("merchant.apiDocs.statusBoardAria")}>
                  {readinessCards.map((item) => (
                    <article className={`api-docs-status-card api-docs-status-card-${item.tone}`} key={item.title}>
                      <span>{item.title}</span>
                      <code>{item.value}</code>
                    </article>
                  ))}
                </div>
              </section>

              <section className="api-docs-flow" aria-label={t("merchant.apiDocs.flowAria")}>
                {apiFlowSteps.map((step, index) => (
                  <article className="api-docs-flow-step" key={step.key}>
                    <span className="api-docs-flow-index">{index + 1}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.text}</p>
                    </div>
                  </article>
                ))}
              </section>

              <section className="api-docs-metrics" aria-label={t("merchant.apiDocs.metricsAria")}>
                <article>
                  <span>{t("merchant.apiDocs.metrics.methods")}</span>
                  <strong>{endpointStats.total}</strong>
                  <p>{t("merchant.apiDocs.metrics.methodsDesc")}</p>
                </article>
                <article>
                  <span>{t("merchant.apiDocs.metrics.getPost")}</span>
                  <strong>
                    {endpointStats.get} / {endpointStats.post}
                  </strong>
                  <p>{t("merchant.apiDocs.metrics.getPostDesc")}</p>
                </article>
                <article>
                  <span>{t("merchant.apiDocs.metrics.secured")}</span>
                  <strong>{endpointStats.secure}</strong>
                  <p>{t("merchant.apiDocs.metrics.securedDesc")}</p>
                </article>
              </section>

              <section className="api-docs-group-map" aria-label={t("merchant.apiDocs.groupsAria")}>
                {Object.entries(endpointGroupLabels).map(([group, label]) => (
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
                <p className="eyebrow">{t("merchant.apiDocs.quickStart.eyebrow")}</p>
                <h3>{t("merchant.apiDocs.quickStart.title")}</h3>
              </div>
              <ol className="api-docs-steps">
                {quickStartSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </article>

            <article className="api-docs-section api-docs-feature-card">
              <div className="api-docs-section-head">
                <p className="eyebrow">{t("merchant.apiDocs.quickStart.keysEyebrow")}</p>
                <h3>{t("merchant.apiDocs.quickStart.keysTitle")}</h3>
              </div>
              <div className="integration-list">
                {quickStartKeyItems.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </article>
          </section>
          ) : null}

          {show("auth") ? (
          <section className="api-docs-section" id="docs-auth">
            <div className="api-docs-section-head">
              <p className="eyebrow">{t("merchant.apiDocs.auth.eyebrow")}</p>
              <h3>{t("merchant.apiDocs.auth.title")}</h3>
            </div>
            <pre className="json-box">{authHeadersExample}</pre>
            <ul className="integration-list">
              {authItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="action-row-inline">
              <button
                className="ghost-button"
                onClick={() => void handleCopy(authHeadersExample, t("merchant.apiDocs.auth.title"))}
                type="button"
              >
                {t("common.copyHeaders")}
              </button>
            </div>
          </section>
          ) : null}

          {show("checkout") ? (
          <section className="api-docs-section" id="docs-checkout-delivery">
            <div className="api-docs-section-head">
              <p className="eyebrow">{t("merchant.apiDocs.checkout.eyebrow")}</p>
              <h3>{t("merchant.apiDocs.checkout.title")}</h3>
            </div>
            <p className="muted-text">{t("merchant.apiDocs.checkout.intro")}</p>
            <div className="api-docs-grid">
              <article className="result-box api-docs-code-card">
                <div className="api-docs-section-head">
                  <p className="eyebrow">{t("merchant.apiDocs.checkout.paymentPageEyebrow")}</p>
                  <h3>{t("merchant.apiDocs.checkout.paymentPageTitle")}</h3>
                </div>
                <ul className="integration-list">
                  {paymentPageItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <pre className="json-box">{`{
  "payment_page_url": "https://noren.digital/pay/abc123example",
  "checkout_delivery": "payment_page"
}`}</pre>
              </article>
              <article className="result-box api-docs-code-card">
                <div className="api-docs-section-head">
                  <p className="eyebrow">{t("merchant.apiDocs.checkout.h2hEyebrow")}</p>
                  <h3>{t("merchant.apiDocs.checkout.h2hTitle")}</h3>
                </div>
                <ul className="integration-list">
                  {h2hItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <pre className="json-box">{`{
  "payment_address": "TG9...example",
  "qr_url": "https://example.com/qr/inv_01J",
  "checkout_delivery": "h2h"
}`}</pre>
              </article>
            </div>
            <p className="muted-text" style={{ marginTop: "1rem" }}>
              {t("merchant.apiDocs.checkout.bothNote")}
            </p>
          </section>
          ) : null}

          {show("endpoints") ? (
          <section className="api-docs-section" id="docs-endpoints-table">
            <div className="api-docs-section-head">
              <p className="eyebrow">{t("merchant.apiDocs.endpointsTable.eyebrow")}</p>
              <h3>{t("merchant.apiDocs.endpointsTable.title")}</h3>
            </div>
            <p className="muted-text">{t("merchant.apiDocs.endpointsTable.intro")}</p>
            <div className="api-docs-mobile-endpoints" aria-label={t("merchant.apiDocs.mobileSummaryAria")}>
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
                    <th>{t("merchant.apiDocs.endpointsTable.method")}</th>
                    <th>{t("merchant.apiDocs.endpointsTable.path")}</th>
                    <th>{t("merchant.apiDocs.endpointsTable.authorization")}</th>
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
                          {t("merchant.apiDocs.endpointsTable.more")}
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
              <p className="eyebrow">{t("merchant.apiDocs.reference.eyebrow")}</p>
              <h3>{t("merchant.apiDocs.reference.title")}</h3>
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
                        <span>{t("merchant.apiDocs.reference.purpose")}</span>
                        <strong>{endpoint.purpose}</strong>
                      </div>
                      <div>
                        <span>{t("merchant.apiDocs.reference.authorization")}</span>
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
              <p className="eyebrow">{t("merchant.apiDocs.cabinet.eyebrow")}</p>
              <h3>{t("merchant.apiDocs.cabinet.title")}</h3>
            </div>
            <p className="muted-text">{t("merchant.apiDocs.cabinet.intro")}</p>
            <div className="api-docs-grid">
              <article className="result-box api-docs-code-card">
                <div className="api-docs-section-head">
                  <p className="eyebrow">{t("merchant.apiDocs.cabinet.meEyebrow")}</p>
                  <h3>{t("merchant.apiDocs.cabinet.meTitle")}</h3>
                </div>
                <pre className="json-box">{cabinetMeExample}</pre>
                <pre className="json-box">{cabinetMeSuccess}</pre>
                <div className="action-row-inline">
                  <button
                    className="ghost-button"
                    onClick={() => void handleCopy(`${cabinetMeExample}\n\n${cabinetMeSuccess}`, t("merchant.apiDocs.cabinet.meEyebrow"))}
                    type="button"
                  >
                    {t("common.copyExample")}
                  </button>
                </div>
              </article>
              <article className="result-box api-docs-code-card">
                <div className="api-docs-section-head">
                  <p className="eyebrow">{t("merchant.apiDocs.cabinet.cabinetEyebrow")}</p>
                  <h3>{t("merchant.apiDocs.cabinet.cabinetTitle")}</h3>
                </div>
                <pre className="json-box">{cabinetPingExample}</pre>
                <pre className="json-box">{cabinetPingSuccess}</pre>
                <div className="action-row-inline">
                  <button
                    className="ghost-button"
                    onClick={() => void handleCopy(`${cabinetPingExample}\n\n${cabinetPingSuccess}`, t("merchant.apiDocs.cabinet.cabinetEyebrow"))}
                    type="button"
                  >
                    {t("common.copyExample")}
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
                <p className="eyebrow">{t("merchant.apiDocs.webhooks.configEyebrow")}</p>
                <h3>{t("merchant.apiDocs.webhooks.configTitle")}</h3>
              </div>
              <pre className="json-box">{webhookConfigExample}</pre>
              <p className="muted-text">{t("merchant.apiDocs.webhooks.configNote")}</p>
              <div className="action-row-inline">
                <button
                  className="ghost-button"
                  onClick={() => void handleCopy(webhookConfigExample, t("merchant.apiDocs.webhooks.configTitle"))}
                  type="button"
                >
                  {t("common.copy")}
                </button>
              </div>
            </article>

            <article className="result-box api-docs-code-card">
              <div className="api-docs-section-head">
                <p className="eyebrow">{t("merchant.apiDocs.webhooks.testEyebrow")}</p>
                <h3>{t("merchant.apiDocs.webhooks.testTitle")}</h3>
              </div>
              <pre className="json-box">{webhookTestExample}</pre>
              <p className="muted-text">{t("merchant.apiDocs.webhooks.testNote")}</p>
              <div className="action-row-inline">
                <button
                  className="ghost-button"
                  onClick={() => void handleCopy(webhookTestExample, t("merchant.apiDocs.webhooks.testTitle"))}
                  type="button"
                >
                  {t("common.copy")}
                </button>
              </div>
            </article>

            <article className="result-box api-docs-code-card">
              <div className="api-docs-section-head">
                <p className="eyebrow">{t("merchant.apiDocs.webhooks.payloadEyebrow")}</p>
                <h3>{t("merchant.apiDocs.webhooks.payloadTitle")}</h3>
              </div>
              <pre className="json-box">{webhookPayloadExample}</pre>
              <ul className="integration-list">
                {webhookPayloadItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="action-row-inline">
                <button
                  className="ghost-button"
                  onClick={() => void handleCopy(webhookPayloadExample, t("merchant.apiDocs.webhooks.payloadTitle"))}
                  type="button"
                >
                  {t("common.copyPayload")}
                </button>
              </div>
            </article>
          </section>
          ) : null}

          {show("commissions") ? (
          <section className="api-docs-section" id="docs-commissions">
            <div className="api-docs-section-head">
              <p className="eyebrow">{t("merchant.apiDocs.commissions.eyebrow")}</p>
              <h3>{t("merchant.apiDocs.commissions.title")}</h3>
            </div>
            <p className="muted-text">
              {t("merchant.apiDocs.commissions.intro", {
                percent: MERCHANT_COMMISSION_PERCENT,
                minUsd: formatUsd(MERCHANT_COMMISSION_MIN_USD),
              })}
            </p>
            <pre className="json-box">{commissionFormula}</pre>
            <p className="muted-text">
              {t("merchant.apiDocs.commissions.threshold", {
                breakEven: formatUsd(MERCHANT_COMMISSION_BREAK_EVEN_USD),
                minUsd: formatUsd(MERCHANT_COMMISSION_MIN_USD),
              })}
            </p>

            <div className="api-docs-table-wrap">
              <table className="api-docs-table">
                <thead>
                  <tr>
                    <th>{t("merchant.apiDocs.commissions.tablePayment")}</th>
                    <th>{t("merchant.apiDocs.commissions.tablePercent")}</th>
                    <th>{t("merchant.apiDocs.commissions.tableCommission")}</th>
                    <th>{t("merchant.apiDocs.commissions.tableNet")}</th>
                    <th>{t("merchant.apiDocs.commissions.tableComment")}</th>
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
                      <td>{t(`merchant.commission.${row.noteKey}`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="integration-list">
              {commissionNotes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          ) : null}

          {show("faq") ? (
          <section className="api-docs-section" id="docs-faq">
            <div className="api-docs-section-head">
              <p className="eyebrow">{t("merchant.apiDocs.faq.eyebrow")}</p>
              <h3>{t("merchant.apiDocs.faq.title")}</h3>
            </div>
            <div className="api-docs-faq">
              {faqItems.map((item) => (
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

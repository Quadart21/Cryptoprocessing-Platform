import { FormEvent, useEffect, useMemo, useState } from "react";

import type { ProjectItem } from "../../api";
import { useApiTranslation } from "../../i18n";

import type { WebhookFormState } from "../types";

export type IntegrationCommandCenterProps = {
  merchantId: string | null;
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

export function IntegrationCommandCenter({
  merchantId,
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
}: IntegrationCommandCenterProps) {
  const { t, ta } = useApiTranslation();
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
    : t("merchant.integration.scenarios.rates.noKey");
  const syncCurl = activeApiKeyPublic
    ? `curl -X POST "${apiBaseUrl}/invoices/<invoice_id>/sync" \\
  -H "X-API-Key: ${activeApiKeyPublic}" \\
  -H "X-API-Secret: <secret_key>"`
    : t("merchant.integration.scenarios.sync.noKey");

  const scenarios = useMemo<SandboxScenario[]>(
    () => [
      {
        id: "health",
        title: t("merchant.integration.scenarios.health.title"),
        endpoint: t("merchant.integration.scenarios.health.endpoint"),
        description: t("merchant.integration.scenarios.health.description"),
        command: healthCurl,
        expected: t("merchant.integration.scenarios.health.expected"),
      },
      {
        id: "rates",
        title: t("merchant.integration.scenarios.rates.title"),
        endpoint: t("merchant.integration.scenarios.rates.endpoint"),
        description: t("merchant.integration.scenarios.rates.description"),
        command: ratesCurl,
        expected: t("merchant.integration.scenarios.rates.expected"),
      },
      {
        id: "invoice",
        title: t("merchant.integration.scenarios.invoice.title"),
        endpoint: t("merchant.integration.scenarios.invoice.endpoint"),
        description: t("merchant.integration.scenarios.invoice.description"),
        command: integrationCurl,
        expected: t("merchant.integration.scenarios.invoice.expected"),
      },
      {
        id: "sync",
        title: t("merchant.integration.scenarios.sync.title"),
        endpoint: t("merchant.integration.scenarios.sync.endpoint"),
        description: t("merchant.integration.scenarios.sync.description"),
        command: syncCurl,
        expected: t("merchant.integration.scenarios.sync.expected"),
      },
    ],
    [healthCurl, integrationCurl, ratesCurl, syncCurl, t],
  );

  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];

  const readinessItems = useMemo(
    () => [
      {
        title: t("merchant.integration.checklist.apiKey.title"),
        ok: hasApiKey,
        detail: hasApiKey
          ? t("merchant.integration.checklist.apiKey.ok")
          : t("merchant.integration.checklist.apiKey.fail"),
      },
      {
        title: t("merchant.integration.checklist.project.title"),
        ok: hasProject,
        detail: hasProject
          ? t("merchant.integration.checklist.project.ok")
          : t("merchant.integration.checklist.project.fail"),
      },
      {
        title: t("merchant.integration.checklist.webhook.title"),
        ok: hasWebhook,
        detail: hasWebhook
          ? t("merchant.integration.checklist.webhook.ok")
          : t("merchant.integration.checklist.webhook.fail"),
      },
      {
        title: t("merchant.integration.checklist.route.title"),
        ok: Boolean(selectedRoute),
        detail: selectedRoute
          ? t("merchant.integration.checklist.route.ok", { route: selectedRoute })
          : t("merchant.integration.checklist.route.fail"),
      },
    ],
    [hasApiKey, hasProject, hasWebhook, selectedRoute, t],
  );

  const checklistSteps = useMemo(
    () => ta<string>("merchant.integration.checklistSteps"),
    [ta],
  );

  const swaggerEndpoints = useMemo(
    () => ta<string>("merchant.integration.swagger.endpoints"),
    [ta],
  );

  const swaggerTestItems = useMemo(
    () => ta<string>("merchant.integration.swagger.testItems"),
    [ta],
  );

  const checkoutDeliveryNote = useMemo(() => {
    if (webhookForm.checkout_delivery === "h2h") {
      return t("merchant.integration.webhookSection.checkoutH2h");
    }
    if (webhookForm.checkout_delivery === "both") {
      return t("merchant.integration.webhookSection.checkoutBoth");
    }
    return t("merchant.integration.webhookSection.checkoutPaymentPage");
  }, [t, webhookForm.checkout_delivery]);

  const webhookPayloadExample = useMemo(() => {
    const invoiceFields: Record<string, string> = {
      id: "inv_test_001",
      merchant_order_id: "order_102394",
      status: "confirmed",
      amount_crypto: "100.25",
      crypto_currency: "USDT",
      network: "TRC20",
      checkout_delivery: webhookForm.checkout_delivery,
    };
    if (webhookForm.checkout_delivery === "h2h") {
      invoiceFields.payment_address = "TG9...example";
      invoiceFields.qr_url = "https://example.com/qr/inv_test_001";
    } else if (webhookForm.checkout_delivery === "both") {
      invoiceFields.payment_page_url = "https://noren.digital/pay/abc123example";
      invoiceFields.payment_address = "TG9...example";
      invoiceFields.qr_url = "https://example.com/qr/inv_test_001";
    } else {
      invoiceFields.payment_page_url = "https://noren.digital/pay/abc123example";
    }
    return JSON.stringify(
      {
        event: "invoice.confirmed",
        event_id: "evt_test_001",
        sent_at: "2026-03-30T12:45:00Z",
        invoice: invoiceFields,
      },
      null,
      2,
    );
  }, [webhookForm.checkout_delivery]);

  async function handleCopy(value: string | null, title: string) {
    if (!value) {
      setCopyMessage(t("common.noValueToCopy", { title }));
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(t("common.copiedTitle", { title }));
    } catch {
      setCopyMessage(t("common.copyFailedTitle", { title }));
    }
  }

  useEffect(() => {
    if (!copyMessage) {
      return;
    }
    const timer = window.setTimeout(() => setCopyMessage(null), 2800);
    return () => window.clearTimeout(timer);
  }, [copyMessage]);

  return (
    <article className="mc-surface mc-surface--span" lang="en" dir="ltr">
      <header className="mc-surface-header mc-surface-header--row">
        <div>
          <p className="mc-surface-eyebrow">{t("merchant.integration.eyebrow")}</p>
          <h2 className="mc-surface-title">{t("merchant.integration.title")}</h2>
          <p className="mc-surface-desc" style={{ marginTop: 8, marginBottom: 0 }}>
            {t("merchant.integration.description")}
          </p>
        </div>
        <span className={`mc-env-pill ${isSandbox ? "mc-env-pill--sandbox" : "mc-env-pill--live"}`}>
          {isSandbox ? t("merchant.integration.sandbox") : t("merchant.integration.live")}
        </span>
      </header>

      <div className="mc-kv-strip">
        <div className="mc-kv">
          <span>{t("merchant.integration.merchantId")}</span>
          <code>{merchantId ?? t("common.dash")}</code>
        </div>
        <div className="mc-kv">
          <span>{t("merchant.integration.baseUrl")}</span>
          <code>{apiBaseUrl}</code>
        </div>
        <div className="mc-kv">
          <span>{t("merchant.integration.apiKey")}</span>
          <code>{activeApiKeyPublic ?? t("common.dash")}</code>
        </div>
        <div className="mc-kv">
          <span>{t("merchant.integration.webhookLabel")}</span>
          <code>{activeWebhookUrl ?? t("common.dash")}</code>
        </div>
        <div className="mc-kv">
          <span>{t("merchant.integration.route")}</span>
          <code>{selectedRoute}</code>
        </div>
      </div>

      <div className="mc-tabs" role="tablist" aria-label={t("merchant.integration.tabAria")}>
        <button
          className={`mc-tab ${tab === "sandbox" ? "mc-tab--active" : ""}`}
          onClick={() => setTab("sandbox")}
          type="button"
          role="tab"
          aria-selected={tab === "sandbox"}
        >
          {t("merchant.integration.sandbox")}
        </button>
        <button
          className={`mc-tab ${tab === "webhook" ? "mc-tab--active" : ""}`}
          onClick={() => setTab("webhook")}
          type="button"
          role="tab"
          aria-selected={tab === "webhook"}
        >
          {t("merchant.integration.webhook")}
        </button>
        <button
          className={`mc-tab ${tab === "swagger" ? "mc-tab--active" : ""}`}
          onClick={() => setTab("swagger")}
          type="button"
          role="tab"
          aria-selected={tab === "swagger"}
        >
          {t("merchant.integration.tabSwagger")}
        </button>
      </div>

      {tab === "sandbox" ? (
        <div className="integration-tab-pane">
          <div className="mc-integration-grid">
            <section className="mc-nested integration-card">
              <div className="integration-card-head">
                <strong>{t("merchant.integration.scenariosTitle")}</strong>
                <span>{t("merchant.integration.scenariosSubtitle")}</span>
              </div>
              <p className="integration-inline-note">{t("merchant.integration.scenariosNote")}</p>

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
                  {t("merchant.integration.endpoint")}: <code>{scenario.endpoint}</code>
                </p>
                <p>{scenario.description}</p>
                <pre className="json-box">{scenario.command}</pre>
                <p className="integration-expected">
                  {t("merchant.integration.expected")}: {scenario.expected}
                </p>
                <div className="action-row-inline">
                  <button
                    className="ghost-button"
                    onClick={() => void handleCopy(scenario.command, `${scenario.title} curl`)}
                    type="button"
                  >
                    {t("common.copyCommand")}
                  </button>
                </div>
              </div>
            </section>

            <section className="mc-nested integration-card">
              <div className="integration-card-head">
                <strong>{t("merchant.integration.checklistTitle")}</strong>
                <span>{t("merchant.integration.checklistSubtitle")}</span>
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
                      title={item.ok ? t("merchant.integration.ready") : t("merchant.integration.neededAction")}
                    >
                      {item.ok ? "OK" : t("merchant.integration.needed")}
                    </span>
                  </article>
                ))}
              </div>

              <div className="integration-divider" />

              <strong className="integration-subtitle">{t("merchant.integration.checklistOrderTitle")}</strong>
              <ol className="integration-steps">
                {checklistSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      ) : null}

      {tab === "webhook" ? (
        <div className="integration-tab-pane">
          <div className="mc-integration-grid">
            <section className="mc-nested integration-card">
              <div className="integration-card-head">
                <strong>{t("merchant.integration.webhookSection.title")}</strong>
                <span>{t("merchant.integration.webhookSection.subtitle")}</span>
              </div>
              <p className="integration-inline-note">{t("merchant.integration.webhookSection.headersNote")}</p>
              <p className="integration-inline-note">{t("merchant.integration.webhookSection.debugNote")}</p>

              <div className="copy-grid">
                <div className="copy-row">
                  <code className="copy-row-value">
                    {activeApiKeyPublic ?? t("merchant.integration.webhookSection.noActiveKey")}
                  </code>
                  <button
                    className="ghost-button"
                    onClick={() => void handleCopy(activeApiKeyPublic, t("merchant.integration.apiKey"))}
                    type="button"
                  >
                    {t("merchant.integration.webhookSection.copyKey")}
                  </button>
                </div>
                <div className="copy-row">
                  <code className="copy-row-value">
                    {activeWebhookUrl ?? t("merchant.integration.webhookSection.noWebhookUrl")}
                  </code>
                  <button
                    className="ghost-button"
                    onClick={() => void handleCopy(activeWebhookUrl, t("merchant.integration.webhookSection.webhookUrl"))}
                    type="button"
                  >
                    {t("merchant.integration.webhookSection.copyUrl")}
                  </button>
                </div>
              </div>

              <strong className="integration-subtitle">{t("merchant.integration.webhookSection.payloadExample")}</strong>
              <pre className="json-box">{webhookPayloadExample}</pre>
              <div className="action-row-inline">
                <button
                  className="ghost-button"
                  onClick={() => void handleCopy(webhookPayloadExample, "Webhook payload")}
                  type="button"
                >
                  {t("common.copyPayload")}
                </button>
              </div>
            </section>

            <form className="mc-form mc-nested" onSubmit={onSaveWebhook}>
              <label className="mc-field">
                <span>{t("merchant.integration.webhookSection.projectForWebhook")}</span>
                <select
                  value={webhookForm.project_id}
                  onChange={(event) => onWebhookFormChange({ ...webhookForm, project_id: event.target.value })}
                >
                  <option value="">{t("common.selectProject")}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mc-field">
                <span>{t("merchant.integration.webhookSection.webhookUrl")}</span>
                <input
                  value={webhookForm.webhook_url}
                  onChange={(event) => onWebhookFormChange({ ...webhookForm, webhook_url: event.target.value })}
                  placeholder="https://merchant.example.com/webhooks/crypto"
                />
              </label>
              <label className="mc-field">
                <span>{t("merchant.integration.webhookSection.webhookSecret")}</span>
                <input
                  value={webhookForm.webhook_secret}
                  onChange={(event) => onWebhookFormChange({ ...webhookForm, webhook_secret: event.target.value })}
                  placeholder={t("merchant.integration.webhookSection.webhookSecretPlaceholder")}
                />
              </label>
              <div className="integration-card-head" style={{ marginTop: "0.5rem" }}>
                <strong>{t("merchant.integration.webhookSection.checkoutFormat")}</strong>
                <span>{t("merchant.integration.webhookSection.checkoutAdminOnly")}</span>
              </div>
              <p className="integration-inline-note">
                {checkoutDeliveryNote} {t("merchant.integration.webhookSection.checkoutSupportNote")}
              </p>

              <div className="integration-card-head" style={{ marginTop: "1.25rem" }}>
                <strong>{t("merchant.integration.webhookSection.returnToShop")}</strong>
                <span>{t("merchant.integration.webhookSection.returnLinks")}</span>
              </div>
              <p className="integration-inline-note">{t("merchant.integration.webhookSection.returnNote")}</p>
              <label className="mc-field">
                <span>{t("merchant.integration.webhookSection.returnSuccess")}</span>
                <input
                  value={webhookForm.return_url_success}
                  onChange={(event) =>
                    onWebhookFormChange({ ...webhookForm, return_url_success: event.target.value })
                  }
                  placeholder={t("merchant.integration.webhookSection.returnSuccessPlaceholder")}
                />
              </label>
              <label className="mc-field">
                <span>{t("merchant.integration.webhookSection.returnFailed")}</span>
                <input
                  value={webhookForm.return_url_failed}
                  onChange={(event) =>
                    onWebhookFormChange({ ...webhookForm, return_url_failed: event.target.value })
                  }
                  placeholder={t("merchant.integration.webhookSection.returnFailedPlaceholder")}
                />
              </label>

              <p className="integration-inline-note">{t("merchant.integration.webhookSection.responseNote")}</p>
              <div className="action-row-inline">
                <button className="primary-button" disabled={loading} type="submit">
                  {loading
                    ? t("merchant.integration.webhookSection.savingWebhook")
                    : t("merchant.integration.webhookSection.saveWebhook")}
                </button>
                <button
                  className="ghost-button"
                  disabled={loading || !webhookForm.project_id}
                  onClick={onSendWebhookTest}
                  type="button"
                >
                  {t("merchant.integration.webhookSection.sendTestWebhook")}
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
              <strong>{t("merchant.integration.swagger.swaggerUi")}</strong>
              <span>{docsUrl}</span>
            </a>
            <a className="integration-link-card" href={openApiUrl} rel="noreferrer" target="_blank">
              <strong>{t("merchant.integration.swagger.openApiJson")}</strong>
              <span>{openApiUrl}</span>
            </a>
          </div>

          <div className="integration-endpoints-grid">
            <article className="mc-nested integration-card">
              <strong className="integration-subtitle">{t("merchant.integration.swagger.keyEndpoints")}</strong>
              <ul className="integration-list">
                {swaggerEndpoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="mc-nested integration-card">
              <strong className="integration-subtitle">{t("merchant.integration.swagger.testFirst")}</strong>
              <ul className="integration-list">
                {swaggerTestItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      ) : null}

      {copyMessage ? <p className="mc-inline-toast">{copyMessage}</p> : null}
    </article>
  );
}

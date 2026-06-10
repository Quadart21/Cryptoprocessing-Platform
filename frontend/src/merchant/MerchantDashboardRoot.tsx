import { useMemo, useState } from "react";

import { DashboardRail } from "../components/layout/DashboardRail";
import { CopyableIdentifier } from "../components/CopyableIdentifier";
import { DashboardStatusMessages } from "../components/layout/DashboardStatusMessages";
import { SectionContextChips } from "../components/layout/SectionContextChips";
import { ClientSectionHeader } from "../components/client/ClientSectionHeader";
import { useClientAnalytics } from "../hooks/useClientAnalytics";
import { TwoFactorPanel } from "../components/security/TwoFactorPanel";
import { formatDecimal, truncateMiddle } from "../utils/format";

import { useTranslation } from "../i18n";
import {
  useIsMerchantSection,
  useMerchantMenuGroups,
  useMerchantSectionCopy,
  useMerchantShortcuts,
} from "./useMerchantConfig";
import { IntegrationCommandCenter } from "./integration/IntegrationCommandCenter";
import { MerchantApiReference } from "./reference/MerchantApiReference";
import type { ClientDashboardProps, MerchantSection } from "./types";
import { AccountNotificationsForm } from "./widgets/AccountNotificationsForm";
import { AnalyticsPeriodStrip } from "./widgets/AnalyticsPeriodStrip";
import { BalanceHoldsPanel } from "./widgets/BalanceHoldsPanel";
import { InvoiceIssuanceWizard } from "./widgets/InvoiceIssuanceWizard";
import { KeysVault } from "./widgets/KeysVault";
import { MerchantInvoiceInspector } from "./widgets/MerchantInvoiceInspector";
import { OutboundLedger } from "./widgets/OutboundLedger";
import { PayoutDesk } from "./widgets/PayoutDesk";
import { ProjectDirectory } from "./widgets/ProjectDirectory";
import { ReceivableList } from "./widgets/ReceivableList";
import MerchantTradingViewChart from "./widgets/MerchantTradingViewChart";

export function MerchantDashboardRoot({
  user,
  onboarding,
  success,
  error,
  onDismissSuccess,
  onDismissError,
  newApiSecret,
  loading,
  projects,
  apiKeys,
  invoices,
  selectedClientInvoiceId,
  selectedClientInvoiceDetail,
  isClientInvoiceModalOpen,
  clientTransactions,
  payouts,
  clientAccounting,
  balance,
  invoiceForm,
  payoutForm,
  webhookForm,
  rates,
  availableNetworks,
  selectedNetwork,
  apiBaseUrl,
  activeApiKeyPublic,
  activeWebhookUrl,
  selectedRoute,
  integrationCurl,
  twoFactorStatus,
  twoFactorSetup,
  notificationSettings,
  onLogout,
  onCreateInvoice,
  onCreatePayout,
  onSaveWebhook,
  onSendWebhookTest,
  onInvoiceWebhookTest,
  onInvoiceFormChange,
  onPayoutFormChange,
  onWebhookFormChange,
  onClientRegenerateApiKey,
  onClientRevokeApiKey,
  onSelectClientInvoice,
  onClientInvoiceSync,
  onRefreshClientInvoices,
  onCloseClientInvoiceModal,
  onSetupTwoFactor,
  onEnableTwoFactor,
  onDisableTwoFactor,
  onSaveNotificationSettings,
  onChangePassword,
  onCloseSecretModal,
  onRefreshBalance,
}: ClientDashboardProps) {
  const { t } = useTranslation();
  const menuGroups = useMerchantMenuGroups();
  const sectionCopy = useMerchantSectionCopy();
  const shortcuts = useMerchantShortcuts();
  const isMerchantSection = useIsMerchantSection(menuGroups);

  const canSyncInvoices =
    user.permissions.includes("*") || user.permissions.includes("client.invoices.write");
  const canSendInvoiceWebhookTest =
    user.permissions.includes("*") || user.permissions.includes("client.webhooks.write");
  const [section, setSection] = useState<MerchantSection>("overview");

  const analytics = useClientAnalytics({
    transactions: clientTransactions,
    invoices,
    currencyFallback: balance?.currency ?? "USDT",
  });

  const accountingPureProfit = useMemo(() => {
    if (!clientAccounting) {
      return null;
    }
    const n =
      Number(clientAccounting.net_amount) + Number(clientAccounting.total_platform_revenue_amount);
    return Number.isFinite(n) ? formatDecimal(n) : null;
  }, [clientAccounting]);

  const sectionMeta = sectionCopy[section];

  const merchantId = user.tenant_id ?? onboarding?.tenant_id ?? null;

  const contextChips = useMemo(
    () => [
      {
        label: t("common.merchantId"),
        value: merchantId ? truncateMiddle(merchantId) : "—",
      },
      {
        label: t("common.project"),
        value: onboarding?.project_name ?? projects[0]?.name ?? "—",
      },
      {
        label: t("common.domain"),
        value: onboarding?.project_domain ?? projects[0]?.domain ?? "—",
      },
      {
        label: t("common.status"),
        value: onboarding?.tenant_status ?? "—",
      },
      {
        label: t("common.role"),
        value: user.role,
      },
    ],
    [merchantId, onboarding, projects, t, user.role],
  );

  return (
    <div className="app-frame merchant-app-frame mw-root">
      <a className="merchant-skip-link" href="#merchant-main">
        {t("merchant.skipLink")}
      </a>
      <DashboardRail
        activeKey={section}
        groups={menuGroups}
        topbarSubtitle={sectionMeta.title}
        onSelect={(key) => {
          if (isMerchantSection(key)) {
            setSection(key);
          }
        }}
        role="client"
        user={user}
        onLogout={onLogout}
      />

      <main className="dashboard-shell client-dashboard-shell merchant-shell-main mw-shell-main" id="merchant-main">
        <DashboardStatusMessages
          error={error}
          newApiSecret={newApiSecret}
          success={success}
          onDismissError={onDismissError}
          onDismissSuccess={onDismissSuccess}
          onCloseSecretModal={onCloseSecretModal}
        />

        <div className="client-cabinet mw-workspace">
          <ClientSectionHeader
            description={sectionMeta.description}
            group={sectionMeta.group}
            title={sectionMeta.title}
          />
          <SectionContextChips items={contextChips} />

          {(section === "overview" || section === "transactions") && (
            <AnalyticsPeriodStrip
              onPeriodChange={analytics.setPeriod}
              period={analytics.period}
              summary={analytics.summary}
            />
          )}

          {section === "overview" ? (
            <div className="console-section-stack mc-page-stack">
              <CopyableIdentifier
                label={t("common.merchantId")}
                value={merchantId}
                hint={t("merchant.merchantIdHint")}
              />
              <section className="mc-bento">
                <article className="mc-stat">
                  <span className="mc-stat-label">{t("common.status")}</span>
                  <strong className="mc-stat-value">{onboarding?.tenant_status ?? "—"}</strong>
                </article>
                <article className="mc-stat">
                  <span className="mc-stat-label">{t("merchant.stats.projects")}</span>
                  <strong className="mc-stat-value">{projects.length}</strong>
                </article>
                <article className="mc-stat">
                  <span className="mc-stat-label">{t("merchant.stats.invoices")}</span>
                  <strong className="mc-stat-value">{invoices.length}</strong>
                </article>
                <article className="mc-stat">
                  <span className="mc-stat-label">{t("merchant.stats.transactions")}</span>
                  <strong className="mc-stat-value">{analytics.summary.transactionCount}</strong>
                </article>
                <article className="mc-stat">
                  <span className="mc-stat-label">{t("merchant.stats.turnover")}</span>
                  <strong className="mc-stat-value">{analytics.summary.turnover}</strong>
                </article>
                <article className="mc-stat">
                  <span className="mc-stat-label">{t("merchant.stats.net")}</span>
                  <strong className="mc-stat-value">{analytics.summary.net}</strong>
                </article>
                <article className="mc-stat">
                  <span className="mc-stat-label">{t("merchant.stats.pureProfit")}</span>
                  <strong className="mc-stat-value">{analytics.summary.pureProfit}</strong>
                </article>
              </section>

              <MerchantTradingViewChart rates={rates} />

              <div className="mc-split mc-split--balanced">
                <article className="mc-surface">
                  <header className="mc-surface-header">
                    <p className="mc-surface-eyebrow">{t("merchant.overview.routesEyebrow")}</p>
                    <h2 className="mc-surface-title">{t("merchant.overview.routesTitle")}</h2>
                    <p className="mc-surface-desc">{t("merchant.overview.routesDesc")}</p>
                  </header>
                  <div className="mc-tiles">
                    {shortcuts.map((shortcut) => (
                      <button
                        className="mc-tile"
                        key={shortcut.section}
                        onClick={() => setSection(shortcut.section)}
                        type="button"
                      >
                        <span className="mc-tile-title">{shortcut.label}</span>
                        <span className="mc-tile-desc">{shortcut.hint}</span>
                      </button>
                    ))}
                  </div>
                </article>

                <article className="mc-surface">
                  <header className="mc-surface-header">
                    <p className="mc-surface-eyebrow">{t("merchant.overview.readinessEyebrow")}</p>
                    <h2 className="mc-surface-title">{t("merchant.overview.readinessTitle")}</h2>
                    <p className="mc-surface-desc">{t("merchant.overview.readinessDesc")}</p>
                  </header>
                  <div className="mc-checklist">
                    <div className="mc-checklist-item">
                      <div>
                        <strong>{t("merchant.overview.apiKey")}</strong>
                        <p>{activeApiKeyPublic ?? t("merchant.overview.noActiveKey")}</p>
                      </div>
                      <span className={`mc-badge ${activeApiKeyPublic ? "mc-badge-ok" : "mc-badge-warn"}`}>
                        {activeApiKeyPublic ? t("common.ok") : t("merchant.overview.needed")}
                      </span>
                    </div>
                    <div className="mc-checklist-item">
                      <div>
                        <strong>{t("merchant.overview.webhook")}</strong>
                        <p>{activeWebhookUrl ?? t("merchant.overview.noWebhookUrl")}</p>
                      </div>
                      <span className={`mc-badge ${activeWebhookUrl ? "mc-badge-ok" : "mc-badge-warn"}`}>
                        {activeWebhookUrl ? t("common.ok") : t("merchant.overview.needed")}
                      </span>
                    </div>
                    <div className="mc-checklist-item">
                      <div>
                        <strong>{t("merchant.overview.twoFa")}</strong>
                        <p>
                          {twoFactorStatus?.enabled
                            ? t("merchant.overview.twoFaEnabled")
                            : t("merchant.overview.twoFaDisabled")}
                        </p>
                      </div>
                      <span className={`mc-badge ${twoFactorStatus?.enabled ? "mc-badge-ok" : "mc-badge-neutral"}`}>
                        {twoFactorStatus?.enabled ? t("common.ok") : t("merchant.overview.recommended")}
                      </span>
                    </div>
                    <div className="mc-checklist-item">
                      <div>
                        <strong>{t("merchant.overview.notifications")}</strong>
                        <p>
                          Email{" "}
                          {notificationSettings?.notify_email_enabled ? t("common.on") : t("common.off")} · Telegram{" "}
                          {notificationSettings?.notify_telegram_enabled ? t("common.on") : t("common.off")}
                        </p>
                      </div>
                      <span className="mc-badge mc-badge-neutral">{t("merchant.overview.notificationsHint")}</span>
                    </div>
                  </div>
                </article>
              </div>

              {clientAccounting ? (
                <section className="mc-bento">
                  <article className="mc-stat">
                    <span className="mc-stat-label">{t("merchant.stats.totalInvoices")}</span>
                    <strong className="mc-stat-value">{clientAccounting.invoices_total_count}</strong>
                  </article>
                  <article className="mc-stat">
                    <span className="mc-stat-label">{t("merchant.stats.paid")}</span>
                    <strong className="mc-stat-value">{formatDecimal(clientAccounting.invoices_paid_amount)}</strong>
                  </article>
                  <article className="mc-stat">
                    <span className="mc-stat-label">{t("merchant.stats.confirmed")}</span>
                    <strong className="mc-stat-value">
                      {formatDecimal(clientAccounting.invoices_confirmed_amount)}
                    </strong>
                  </article>
                  <article className="mc-stat">
                    <span className="mc-stat-label">{t("merchant.stats.net")}</span>
                    <strong className="mc-stat-value">{formatDecimal(clientAccounting.net_amount)}</strong>
                  </article>
                  <article className="mc-stat">
                    <span className="mc-stat-label">{t("merchant.stats.pureProfit")}</span>
                    <strong className="mc-stat-value">{accountingPureProfit ?? "—"}</strong>
                  </article>
                </section>
              ) : null}
            </div>
          ) : null}

          {section === "docs" ? (
            <div className="console-section-stack mc-page-stack">
              <MerchantApiReference
                apiBaseUrl={apiBaseUrl}
                activeApiKeyPublic={activeApiKeyPublic}
                selectedRoute={selectedRoute}
                activeWebhookUrl={activeWebhookUrl}
                integrationCurl={integrationCurl}
              />
            </div>
          ) : null}

          {section === "projects" ? (
            <div className="console-section-stack">
              <div className="mc-split mc-split--balanced">
              <ProjectDirectory projects={projects} />
              <IntegrationCommandCenter
                merchantId={merchantId}
                activeApiKeyPublic={activeApiKeyPublic}
                activeWebhookUrl={activeWebhookUrl}
                apiBaseUrl={apiBaseUrl}
                integrationCurl={integrationCurl}
                loading={loading}
                onSaveWebhook={onSaveWebhook}
                onSendWebhookTest={onSendWebhookTest}
                onWebhookFormChange={onWebhookFormChange}
                projects={projects}
                selectedRoute={selectedRoute}
                webhookForm={webhookForm}
              />
              </div>
            </div>
          ) : null}

          {section === "keys" ? (
            <div className="console-section-stack">
              <div className="mc-split mc-split--balanced">
              <KeysVault
                apiKeys={apiKeys}
                activeApiKeyPublic={activeApiKeyPublic}
                onRegenerate={onClientRegenerateApiKey}
                onRevoke={onClientRevokeApiKey}
              />
              <IntegrationCommandCenter
                merchantId={merchantId}
                activeApiKeyPublic={activeApiKeyPublic}
                activeWebhookUrl={activeWebhookUrl}
                apiBaseUrl={apiBaseUrl}
                integrationCurl={integrationCurl}
                loading={loading}
                onSaveWebhook={onSaveWebhook}
                onSendWebhookTest={onSendWebhookTest}
                onWebhookFormChange={onWebhookFormChange}
                projects={projects}
                selectedRoute={selectedRoute}
                webhookForm={webhookForm}
              />
              </div>
            </div>
          ) : null}

          {section === "invoices" ? (
            <div className="console-section-stack mc-page-stack mw-invoices-page">
              <div className="mc-split mc-split--chart">
                <InvoiceIssuanceWizard
                  availableNetworks={availableNetworks}
                  invoiceForm={invoiceForm}
                  loading={loading}
                  onCreateInvoice={onCreateInvoice}
                  onInvoiceFormChange={onInvoiceFormChange}
                  projects={projects}
                  rates={rates}
                  selectedNetwork={selectedNetwork}
                />
                <MerchantTradingViewChart
                  compact
                  defaultCurrency={invoiceForm.crypto_currency}
                  rates={rates}
                />
              </div>
              <ReceivableList
                invoices={invoices}
                onSelectInvoice={onSelectClientInvoice}
                onSyncInvoice={onClientInvoiceSync}
                onRefreshInvoices={onRefreshClientInvoices}
                selectedClientInvoiceId={selectedClientInvoiceId}
                canSyncInvoices={canSyncInvoices}
                webhookConfigured={Boolean(activeWebhookUrl)}
                canSendInvoiceWebhookTest={canSendInvoiceWebhookTest}
                onInvoiceWebhookTest={onInvoiceWebhookTest}
              />
            </div>
          ) : null}

          {section === "transactions" ? (
            <div className="console-section-stack mc-page-stack">
              <OutboundLedger
                currencyFilter={analytics.currencyFilter}
                currencyOptions={analytics.currencyOptions}
                exportRows={analytics.filteredTransactions}
                onCurrencyFilterChange={analytics.setCurrencyFilter}
                onPageChange={analytics.setPage}
                onSearchChange={analytics.setSearchTerm}
                onStatusFilterChange={analytics.setStatusFilter}
                page={analytics.page}
                pageSize={analytics.pageSize}
                searchTerm={analytics.searchTerm}
                statusFilter={analytics.statusFilter}
                statusOptions={analytics.statusOptions}
                totalCount={analytics.filteredTransactions.length}
                totalPages={analytics.totalPages}
                transactions={analytics.pagedTransactions}
              />
            </div>
          ) : null}

          {section === "balance" ? (
            <div className="console-section-stack mc-page-stack">
              <section className="mc-bento">
                <article className="mc-stat">
                  <span className="mc-stat-label">{t("merchant.stats.available")}</span>
                  <strong className="mc-stat-value">
                    {formatDecimal(balance?.available_amount ?? balance?.amount ?? "0")}{" "}
                    {balance?.currency ?? "USDT"}
                  </strong>
                </article>
                <article className="mc-stat">
                  <span className="mc-stat-label">{t("merchant.stats.frozen")}</span>
                  <strong className="mc-stat-value">
                    {formatDecimal(balance?.frozen_amount ?? "0")} {balance?.currency ?? "USDT"}
                  </strong>
                </article>
                <article className="mc-stat">
                  <span className="mc-stat-label">{t("merchant.stats.inPayout")}</span>
                  <strong className="mc-stat-value">
                    {formatDecimal(balance?.locked_amount ?? "0")} {balance?.currency ?? "USDT"}
                  </strong>
                </article>
                {Number(balance?.pending_amount ?? 0) > 0 ? (
                  <article className="mc-stat">
                    <span className="mc-stat-label">{t("merchant.stats.processing")}</span>
                    <strong className="mc-stat-value">
                      {formatDecimal(balance?.pending_amount ?? "0")} {balance?.currency ?? "USDT"}
                    </strong>
                  </article>
                ) : null}
                <article className="mc-stat">
                  <span className="mc-stat-label">{t("merchant.stats.total")}</span>
                  <strong className="mc-stat-value">
                    {formatDecimal(balance?.total_amount ?? balance?.amount ?? "0")}{" "}
                    {balance?.currency ?? "USDT"}
                  </strong>
                </article>
                <article className="mc-stat">
                  <span className="mc-stat-label">{t("merchant.stats.netPeriod")}</span>
                  <strong className="mc-stat-value">{analytics.summary.net}</strong>
                </article>
                <article className="mc-stat">
                  <span className="mc-stat-label">{t("merchant.stats.pureProfitPeriod")}</span>
                  <strong className="mc-stat-value">{analytics.summary.pureProfit}</strong>
                </article>
              </section>

              <BalanceHoldsPanel balance={balance} onRefresh={onRefreshBalance} />

              <PayoutDesk
                loading={loading}
                onCreatePayout={onCreatePayout}
                onPayoutFormChange={onPayoutFormChange}
                payoutForm={payoutForm}
                payouts={payouts}
                projects={projects}
              />
            </div>
          ) : null}

          {section === "security" ? (
            <div className="console-section-stack">
              <div className="mc-split mc-split--balanced">
              <TwoFactorPanel
                status={twoFactorStatus}
                setupData={twoFactorSetup}
                loading={loading}
                onSetup={onSetupTwoFactor}
                onEnable={onEnableTwoFactor}
                onDisable={onDisableTwoFactor}
              />
              <AccountNotificationsForm
                loading={loading}
                settings={notificationSettings}
                onSaveNotificationSettings={onSaveNotificationSettings}
                onChangePassword={onChangePassword}
              />
              </div>
            </div>
          ) : null}

          <MerchantInvoiceInspector
            invoice={selectedClientInvoiceDetail}
            isOpen={isClientInvoiceModalOpen}
            loading={loading}
            onClose={onCloseClientInvoiceModal}
            onSync={onClientInvoiceSync}
            canSyncInvoices={canSyncInvoices}
          />
        </div>
      </main>

    </div>
  );
}

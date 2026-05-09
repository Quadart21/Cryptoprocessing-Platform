import { useMemo, useState } from "react";

import { DashboardRail, type DashboardRailGroup } from "../components/layout/DashboardRail";
import { DashboardStatusMessages } from "../components/layout/DashboardStatusMessages";
import { SectionContextChips } from "../components/layout/SectionContextChips";
import { ClientSectionHeader } from "../components/client/ClientSectionHeader";
import { useClientAnalytics } from "../hooks/useClientAnalytics";
import { TwoFactorPanel } from "../components/security/TwoFactorPanel";
import { formatDecimal } from "../utils/format";

import {
  MERCHANT_MENU_GROUPS,
  MERCHANT_SECTION_COPY,
  MERCHANT_SHORTCUTS,
  isMerchantSection,
} from "./config";
import { IntegrationCommandCenter } from "./integration/IntegrationCommandCenter";
import { MerchantApiReference } from "./reference/MerchantApiReference";
import type { ClientDashboardProps, MerchantSection } from "./types";
import { AccountNotificationsForm } from "./widgets/AccountNotificationsForm";
import { AnalyticsPeriodStrip } from "./widgets/AnalyticsPeriodStrip";
import { InvoiceIssuanceWizard } from "./widgets/InvoiceIssuanceWizard";
import { KeysVault } from "./widgets/KeysVault";
import { MerchantInvoiceInspector } from "./widgets/MerchantInvoiceInspector";
import { OutboundLedger } from "./widgets/OutboundLedger";
import { PayoutDesk } from "./widgets/PayoutDesk";
import { ProjectDirectory } from "./widgets/ProjectDirectory";
import { ReceivableList } from "./widgets/ReceivableList";

export function MerchantDashboardRoot({
  user,
  onboarding,
  success,
  error,
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
  onCloseClientInvoiceModal,
  onSetupTwoFactor,
  onEnableTwoFactor,
  onDisableTwoFactor,
  onSaveNotificationSettings,
  onChangePassword,
  onCloseSecretModal,
}: ClientDashboardProps) {
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

  const sectionMeta = MERCHANT_SECTION_COPY[section];

  const contextChips = useMemo(
    () => [
      {
        label: "Проект",
        value: onboarding?.project_name ?? projects[0]?.name ?? "—",
      },
      {
        label: "Домен",
        value: onboarding?.project_domain ?? projects[0]?.domain ?? "—",
      },
      {
        label: "Тенант",
        value: onboarding?.tenant_status ?? "—",
      },
      {
        label: "Роль",
        value: user.role,
      },
    ],
    [onboarding, projects, user.role],
  );

  const menuGroups: DashboardRailGroup[] = MERCHANT_MENU_GROUPS;

  return (
    <div className="app-frame merchant-app-frame mw-root">
      <a className="merchant-skip-link" href="#merchant-main">
        К содержимому
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
              <section className="mc-bento">
                <article className="mc-stat">
                  <span className="mc-stat-label">Тенант</span>
                  <strong className="mc-stat-value">{onboarding?.tenant_status ?? "—"}</strong>
                </article>
                <article className="mc-stat">
                  <span className="mc-stat-label">Проекты</span>
                  <strong className="mc-stat-value">{projects.length}</strong>
                </article>
                <article className="mc-stat">
                  <span className="mc-stat-label">Инвойсы</span>
                  <strong className="mc-stat-value">{invoices.length}</strong>
                </article>
                <article className="mc-stat">
                  <span className="mc-stat-label">Операции</span>
                  <strong className="mc-stat-value">{analytics.summary.transactionCount}</strong>
                </article>
                <article className="mc-stat">
                  <span className="mc-stat-label">Оборот (оплач.)</span>
                  <strong className="mc-stat-value">{analytics.summary.turnover}</strong>
                </article>
                <article className="mc-stat">
                  <span className="mc-stat-label">К зачислению</span>
                  <strong className="mc-stat-value">{analytics.summary.net}</strong>
                </article>
                <article className="mc-stat">
                  <span className="mc-stat-label">Чистая прибыль</span>
                  <strong className="mc-stat-value">{analytics.summary.pureProfit}</strong>
                </article>
              </section>

              <div className="mc-split mc-split--balanced">
                <article className="mc-surface">
                  <header className="mc-surface-header">
                    <p className="mc-surface-eyebrow">Маршруты</p>
                    <h2 className="mc-surface-title">Быстрые переходы</h2>
                    <p className="mc-surface-desc">Секции кабинета в один тап.</p>
                  </header>
                  <div className="mc-tiles">
                    {MERCHANT_SHORTCUTS.map((shortcut) => (
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
                    <p className="mc-surface-eyebrow">Готовность</p>
                    <h2 className="mc-surface-title">Интеграция</h2>
                    <p className="mc-surface-desc">Ключ, webhook и защита входа.</p>
                  </header>
                  <div className="mc-checklist">
                    <div className="mc-checklist-item">
                      <div>
                        <strong>API-ключ</strong>
                        <p>{activeApiKeyPublic ?? "Активный ключ не найден"}</p>
                      </div>
                      <span className={`mc-badge ${activeApiKeyPublic ? "mc-badge-ok" : "mc-badge-warn"}`}>
                        {activeApiKeyPublic ? "OK" : "Нужен"}
                      </span>
                    </div>
                    <div className="mc-checklist-item">
                      <div>
                        <strong>Webhook</strong>
                        <p>{activeWebhookUrl ?? "URL не задан"}</p>
                      </div>
                      <span className={`mc-badge ${activeWebhookUrl ? "mc-badge-ok" : "mc-badge-warn"}`}>
                        {activeWebhookUrl ? "OK" : "Нужен"}
                      </span>
                    </div>
                    <div className="mc-checklist-item">
                      <div>
                        <strong>2FA</strong>
                        <p>{twoFactorStatus?.enabled ? "Включена" : "Отключена"}</p>
                      </div>
                      <span className={`mc-badge ${twoFactorStatus?.enabled ? "mc-badge-ok" : "mc-badge-neutral"}`}>
                        {twoFactorStatus?.enabled ? "OK" : "Рекомендуем"}
                      </span>
                    </div>
                    <div className="mc-checklist-item">
                      <div>
                        <strong>Уведомления</strong>
                        <p>
                          Email {notificationSettings?.notify_email_enabled ? "вкл." : "выкл."} · Telegram{" "}
                          {notificationSettings?.notify_telegram_enabled ? "вкл." : "выкл."}
                        </p>
                      </div>
                      <span className="mc-badge mc-badge-neutral">См. «Доступ»</span>
                    </div>
                  </div>
                </article>
              </div>

              {clientAccounting ? (
                <section className="mc-bento">
                  <article className="mc-stat">
                    <span className="mc-stat-label">Всего инвойсов</span>
                    <strong className="mc-stat-value">{clientAccounting.invoices_total_count}</strong>
                  </article>
                  <article className="mc-stat">
                    <span className="mc-stat-label">Оплачено</span>
                    <strong className="mc-stat-value">{formatDecimal(clientAccounting.invoices_paid_amount)}</strong>
                  </article>
                  <article className="mc-stat">
                    <span className="mc-stat-label">Подтверждено</span>
                    <strong className="mc-stat-value">
                      {formatDecimal(clientAccounting.invoices_confirmed_amount)}
                    </strong>
                  </article>
                  <article className="mc-stat">
                    <span className="mc-stat-label">К зачислению</span>
                    <strong className="mc-stat-value">{formatDecimal(clientAccounting.net_amount)}</strong>
                  </article>
                  <article className="mc-stat">
                    <span className="mc-stat-label">Чистая прибыль</span>
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
            <div className="console-section-stack">
              <div className="mc-split mc-split--balanced mw-invoices-split">
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
              <ReceivableList
                invoices={invoices}
                onSelectInvoice={onSelectClientInvoice}
                onSyncInvoice={onClientInvoiceSync}
                selectedClientInvoiceId={selectedClientInvoiceId}
                canSyncInvoices={canSyncInvoices}
                webhookConfigured={Boolean(activeWebhookUrl)}
                canSendInvoiceWebhookTest={canSendInvoiceWebhookTest}
                onInvoiceWebhookTest={onInvoiceWebhookTest}
              />
              </div>
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
                  <span className="mc-stat-label">Доступно</span>
                  <strong className="mc-stat-value">
                    {formatDecimal(balance?.available_amount ?? balance?.amount ?? "0")}{" "}
                    {balance?.currency ?? "USDT"}
                  </strong>
                </article>
                <article className="mc-stat">
                  <span className="mc-stat-label">Заморожено</span>
                  <strong className="mc-stat-value">
                    {formatDecimal(balance?.locked_amount ?? "0")} {balance?.currency ?? "USDT"}
                  </strong>
                </article>
                <article className="mc-stat">
                  <span className="mc-stat-label">Всего</span>
                  <strong className="mc-stat-value">
                    {formatDecimal(balance?.total_amount ?? balance?.amount ?? "0")}{" "}
                    {balance?.currency ?? "USDT"}
                  </strong>
                </article>
                <article className="mc-stat">
                  <span className="mc-stat-label">К зачислению (период)</span>
                  <strong className="mc-stat-value">{analytics.summary.net}</strong>
                </article>
                <article className="mc-stat">
                  <span className="mc-stat-label">Чистая прибыль (период)</span>
                  <strong className="mc-stat-value">{analytics.summary.pureProfit}</strong>
                </article>
              </section>

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

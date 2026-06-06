import { Suspense, useEffect, useMemo, useState } from "react";

import { AppRouteFallback } from "../components/AppRouteFallback";
import {
  DashboardRail,
  type DashboardRailGroup,
} from "../components/layout/DashboardRail";
import { DashboardStatusMessages } from "../components/layout/DashboardStatusMessages";
import { SectionContextChips } from "../components/layout/SectionContextChips";
import { ClientSectionHeader } from "../components/client/ClientSectionHeader";
import { TwoFactorPanel } from "../components/security/TwoFactorPanel";
import { ADMIN_SECTION_META, ADMIN_HUB_DEFAULT_SECTION, buildAdminMenuGroups, isAdminHub } from "./config";
import {
  AdminClientDetailSectionLazy,
  AdminClientsSectionLazy,
  AdminOverviewSectionLazy,
  AdminPlatformApiUsageSectionLazy,
  AdminPlatformPayoutsPanelLazy,
  AdminPlatformSettingsSectionLazy,
  AdminPublicPagesSectionLazy,
  AdminSandboxSectionLazy,
  AdminUsersPanelLazy,
  AssetManagementPageLazy,
  PlatformEventsPanelLazy,
  PlatformInvoicesPanelLazy,
  PlatformTransactionsPanelLazy,
} from "./lazySections";
import { type AdminDashboardProps, type AdminSection, isAdminSection } from "./types";
import { AdminSectionSubNav } from "./sections/AdminSectionSubNav";

export function PlatformDashboardRoot(props: AdminDashboardProps) {
  const {
    adminToken,
    user,
    loading,
    success,
    error,
    onDismissSuccess,
    onDismissError,
    newApiSecret,
    tenantForm,
    createdTenant,
    tenants,
    selectedTenantId,
    selectedTenantDetail,
    selectedTenantInvoices,
    selectedTenantTransactions,
    selectedTenantPayouts,
    selectedTenantAccounting,
    platformAccounting,
    platformAccountingOverview,
    platformInvoices,
    platformTransactions,
    platformPayouts,
    platformEvents,
    platformBillingSettings,
    publicPages,
    selectedTenantBillingPolicy,
    adminAssetRates,
    adminUsers,
    roleDefinitions,
    twoFactorStatus,
    twoFactorSetup,
    selectedInvoiceId,
    selectedInvoiceDetail,
    selectedInvoiceEvents,
    heroRows,
    heroPrimaryValue,
    heroPrimaryLabel,
    heroSecondaryValue,
    heroSecondaryLabel,
    onLogout,
    onCreateTenant,
    onTenantFormChange,
    onSelectTenant,
    onApproveTenant,
    onRejectTenant,
    onUpdateAdminTenant,
    onUpdateAdminProject,
    onDeleteAdminTenant,
    onResetTenantOwnerPassword,
    onResetTenantOwnerTwoFactor,
    onAdminRegenerateApiKey,
    onAdminRevokeApiKey,
    onSelectInvoice,
    onUpdateInvoiceStatus,
    onSyncInvoice,
    onRepairInvoiceSettlement,
    onUpdatePlatformSettings,
    onReloadPlatformSettings,
    onFetchPlatformExchangeRate,
    onRefreshPlatformExchangeRate,
    onInspectPlatformTelegramBot,
    onSendPlatformTelegramTest,
    onProvisionOpsTelegramTopics,
    onSendOpsTelegramTopicTest,
    onSendPlatformSmtpBzTest,
    onPreviewNotificationTemplate,
    onSendNotificationTemplateTest,
    onUpdateTenantPolicy,
    onUpdateAssetAvailability,
    onCreatePublicPage,
    onUpdatePublicPage,
    onDeletePublicPage,
    onCreateAdminUser,
    onUpdateAdminUser,
    onDeleteAdminUser,
    onSetupTwoFactor,
    onEnableTwoFactor,
    onDisableTwoFactor,
    onApprovePayout,
    onRejectPayout,
    onRecordPlatformWithdrawal,
    onLoadPlatformInvoices,
    onLoadPlatformTransactions,
    onCloseSecretModal,
    sandboxConsoleEnabled,
    merchantSandboxes,
    sandboxPlatformSettings,
    lastMerchantSandboxCreate,
    onRefreshMerchantSandboxes,
    onCreateMerchantSandbox,
    onUpdateSandboxPlatformSettings,
    onProvisionMerchantSandboxDns,
    onDestroyMerchantSandbox,
    onDismissMerchantSandboxCreate,
  } = props;

  const [section, setSection] = useState<AdminSection>("overview");

  useEffect(() => {
    if (section === "invoices") {
      void onLoadPlatformInvoices();
    }
  }, [section, onLoadPlatformInvoices]);

  useEffect(() => {
    if (section === "transactions") {
      void onLoadPlatformTransactions();
    }
  }, [section, onLoadPlatformTransactions]);

  useEffect(() => {
    if (section === "client-detail" && !selectedTenantId) {
      setSection("clients");
    }
  }, [section, selectedTenantId]);

  useEffect(() => {
    if (section === "sandbox" && !sandboxConsoleEnabled) {
      setSection("overview");
    }
  }, [sandboxConsoleEnabled, section]);

  useEffect(() => {
    if (section !== "platform-settings" || platformBillingSettings || !onReloadPlatformSettings) {
      return;
    }
    void onReloadPlatformSettings();
  }, [section, platformBillingSettings, onReloadPlatformSettings]);

  const adminMenuGroups = useMemo<DashboardRailGroup[]>(
    () =>
      buildAdminMenuGroups(selectedTenantId, {
        sandboxConsole: sandboxConsoleEnabled,
      }),
    [sandboxConsoleEnabled, selectedTenantId],
  );

  const selectedTenantName =
    selectedTenantDetail?.tenant.name ??
    tenants.find((tenant) => tenant.id === selectedTenantId)?.name ??
    "Клиент";

  const sectionMeta = ADMIN_SECTION_META[section];

  const contextChips = useMemo(
    () => [
      { label: "Роль консоли", value: user.role },
      { label: "Клиентов", value: String(tenants.length) },
      { label: "Фокус", value: selectedTenantId ? selectedTenantName : "—" },
      { label: "Событий (буфер)", value: String(platformEvents.length) },
    ],
    [platformEvents.length, selectedTenantId, selectedTenantName, tenants.length, user.role],
  );

  function handleOpenTenant(tenantId: string) {
    onSelectTenant(tenantId);
    setSection("client-detail");
  }

  return (
    <div className="app-frame pw-console-root">
      <a className="merchant-skip-link" href="#pw-console-main">
        К содержимому
      </a>
      <DashboardRail
        activeKey={section}
        groups={adminMenuGroups}
        navVariant="hubs"
        topbarSubtitle={sectionMeta.title}
        onSelect={(key) => {
          if (isAdminHub(key)) {
            setSection(ADMIN_HUB_DEFAULT_SECTION[key]);
            return;
          }
          if (key === "client-detail") {
            if (selectedTenantId) {
              setSection("client-detail");
            }
            return;
          }
          if (isAdminSection(key)) {
            setSection(key);
          }
        }}
        role="admin"
        user={user}
        onLogout={onLogout}
      />

      <main className="dashboard-shell pw-console-main" id="pw-console-main">
        <DashboardStatusMessages
          error={error}
          newApiSecret={newApiSecret}
          success={success}
          onDismissError={onDismissError}
          onDismissSuccess={onDismissSuccess}
          onCloseSecretModal={onCloseSecretModal}
        />

        <div className="pw-console-workspace">
          <ClientSectionHeader
            description={sectionMeta.description}
            group={sectionMeta.group}
            title={sectionMeta.title}
          />
          <AdminSectionSubNav
            groups={adminMenuGroups}
            section={section}
            onSectionChange={(next) => {
              if (next === "client-detail" && !selectedTenantId) {
                return;
              }
              setSection(next);
            }}
          />
          <SectionContextChips items={contextChips} />

          <Suspense fallback={<AppRouteFallback />}>
            {section === "overview" ? (
              <div className="console-section-stack">
                <section className="stats-grid pw-console-stats">
                  <article className="stat-card">
                    <span>{heroPrimaryLabel ?? "Ваша комиссия (остаток)"}</span>
                    <strong>{heroPrimaryValue}</strong>
                  </article>
                  <article className="stat-card">
                    <span>{heroSecondaryLabel ?? "На счетах мерчантов"}</span>
                    <strong>{heroSecondaryValue}</strong>
                  </article>
                  <article className="stat-card">
                    <span>Клиентов</span>
                    <strong>{tenants.length}</strong>
                  </article>
                  <article className="stat-card">
                    <span>Заявок на вывод</span>
                    <strong>{platformAccountingOverview?.payouts_pending_count ?? 0}</strong>
                  </article>
                </section>

                <AdminOverviewSectionLazy
                  platformAccountingOverview={platformAccountingOverview}
                  isSuperadmin={user.role === "superadmin"}
                  loading={loading}
                  onRecordPlatformWithdrawal={onRecordPlatformWithdrawal}
                />
              </div>
            ) : null}

            {section === "invoices" ? (
              <div className="console-section-stack">
                <section className="dashboard-grid client-grid">
                  <PlatformInvoicesPanelLazy
                    className="panel panel-span-2"
                    invoices={platformInvoices}
                    onSyncInvoice={onSyncInvoice}
                  />
                </section>
              </div>
            ) : null}

            {section === "transactions" ? (
              <div className="console-section-stack">
                <section className="dashboard-grid client-grid">
                  <PlatformTransactionsPanelLazy
                    className="panel panel-span-2"
                    transactions={platformTransactions}
                  />
                </section>
              </div>
            ) : null}

            {section === "payouts" ? (
              <div className="console-section-stack">
                <section className="dashboard-grid client-grid">
                  <AdminPlatformPayoutsPanelLazy
                    payouts={platformPayouts}
                    loading={loading}
                    onApprove={onApprovePayout}
                    onReject={onRejectPayout}
                    onOpenTenant={(tenantId) => {
                      onSelectTenant(tenantId);
                      setSection("client-detail");
                    }}
                  />
                </section>
              </div>
            ) : null}

            {section === "events" ? (
              <div className="console-section-stack">
                <section className="dashboard-grid client-grid">
                  <PlatformEventsPanelLazy className="panel panel-span-2" events={platformEvents} />
                </section>
              </div>
            ) : null}

            {section === "api-traffic" ? (
              <div className="console-section-stack">
                <AdminPlatformApiUsageSectionLazy adminToken={adminToken} />
              </div>
            ) : null}

            {section === "clients" || section === "requests" ? (
              <div className="console-section-stack">
                <AdminClientsSectionLazy
                  key={tenants.length + tenants.map((t) => t.status).join(",")}
                  createdTenant={createdTenant}
                  loading={loading}
                  mode={section}
                  selectedTenantId={selectedTenantId}
                  tenantForm={tenantForm}
                  tenants={tenants}
                  onApproveTenant={onApproveTenant}
                  onCreateTenant={onCreateTenant}
                  onDeleteTenant={onDeleteAdminTenant}
                  onOpenTenant={handleOpenTenant}
                  onRejectTenant={onRejectTenant}
                  onTenantFormChange={onTenantFormChange}
                />
              </div>
            ) : null}

            {section === "client-detail" ? (
              <div className="console-section-stack">
                <AdminClientDetailSectionLazy
                  adminToken={adminToken}
                  loading={loading}
                  selectedInvoiceDetail={selectedInvoiceDetail}
                  selectedInvoiceEvents={selectedInvoiceEvents}
                  selectedInvoiceId={selectedInvoiceId}
                  selectedTenantAccounting={selectedTenantAccounting}
                  selectedTenantDetail={selectedTenantDetail}
                  selectedTenantInvoices={selectedTenantInvoices}
                  selectedTenantName={selectedTenantName}
                  selectedTenantPayouts={selectedTenantPayouts}
                  selectedTenantTransactions={selectedTenantTransactions}
                  onDeleteTenant={onDeleteAdminTenant}
                  onResetTenantOwnerPassword={onResetTenantOwnerPassword}
                  onResetTenantOwnerTwoFactor={onResetTenantOwnerTwoFactor}
                  onAdminRegenerateApiKey={onAdminRegenerateApiKey}
                  onAdminRevokeApiKey={onAdminRevokeApiKey}
                  onApprovePayout={onApprovePayout}
                  onBackToClients={() => setSection("clients")}
                  onRejectPayout={onRejectPayout}
                  onSelectInvoice={onSelectInvoice}
                  onUpdateAdminProject={onUpdateAdminProject}
                  onUpdateAdminTenant={onUpdateAdminTenant}
                  onUpdateInvoiceStatus={onUpdateInvoiceStatus}
                  onSyncInvoice={onSyncInvoice}
                  onRepairInvoiceSettlement={onRepairInvoiceSettlement}
                />
              </div>
            ) : null}

            {section === "team" ? (
              <div className="console-section-stack">
                <section className="dashboard-grid client-grid">
                  <AdminUsersPanelLazy
                    canManageUsers={
                      user.permissions.includes("*") ||
                      user.permissions.includes("admin.users.write")
                    }
                    currentUserId={user.id}
                    loading={loading}
                    roles={roleDefinitions}
                    users={adminUsers}
                    onCreate={onCreateAdminUser}
                    onDelete={onDeleteAdminUser}
                    onUpdate={onUpdateAdminUser}
                  />
                </section>
              </div>
            ) : null}

            {section === "security" ? (
              <div className="console-section-stack">
                <section className="dashboard-grid client-grid">
                  <TwoFactorPanel
                    loading={loading}
                    setupData={twoFactorSetup}
                    status={twoFactorStatus}
                    onDisable={onDisableTwoFactor}
                    onEnable={onEnableTwoFactor}
                    onSetup={onSetupTwoFactor}
                  />
                </section>
              </div>
            ) : null}

            {section === "platform-settings" ? (
              <div className="console-section-stack">
                <AdminPlatformSettingsSectionLazy
                  adminAssetRates={adminAssetRates}
                  isSuperadmin={user.role === "superadmin"}
                  loading={loading}
                  platformBillingSettings={platformBillingSettings}
                  selectedTenantBillingPolicy={selectedTenantBillingPolicy}
                  selectedTenantId={selectedTenantId}
                  tenants={tenants}
                  onSelectTenant={onSelectTenant}
                  onFetchPlatformExchangeRate={onFetchPlatformExchangeRate}
                  onRefreshPlatformExchangeRate={onRefreshPlatformExchangeRate}
                  onInspectPlatformTelegramBot={onInspectPlatformTelegramBot}
                  onSendPlatformTelegramTest={onSendPlatformTelegramTest}
                  onProvisionOpsTelegramTopics={onProvisionOpsTelegramTopics}
                  onSendOpsTelegramTopicTest={onSendOpsTelegramTopicTest}
                  onSendPlatformSmtpBzTest={onSendPlatformSmtpBzTest}
                  onPreviewNotificationTemplate={onPreviewNotificationTemplate}
                  onSendNotificationTemplateTest={onSendNotificationTemplateTest}
                  onUpdatePlatformSettings={onUpdatePlatformSettings}
                  onReloadPlatformSettings={onReloadPlatformSettings}
                  onUpdateTenantPolicy={onUpdateTenantPolicy}
                />
              </div>
            ) : null}

            {section === "public-pages" ? (
              <div className="console-section-stack">
                <AdminPublicPagesSectionLazy
                  loading={loading}
                  pages={publicPages}
                  onCreate={onCreatePublicPage}
                  onUpdate={onUpdatePublicPage}
                  onDelete={onDeletePublicPage}
                />
              </div>
            ) : null}

            {section === "assets" ? (
              <div className="console-section-stack">
                <AssetManagementPageLazy
                  loading={loading}
                  adminAssetRates={adminAssetRates}
                  onUpdateAssetAvailability={onUpdateAssetAvailability}
                />
              </div>
            ) : null}

            {section === "sandbox" && sandboxConsoleEnabled ? (
              <div className="console-section-stack">
                <AdminSandboxSectionLazy
                  lastCreate={lastMerchantSandboxCreate}
                  loading={loading}
                  onCreate={onCreateMerchantSandbox}
                  onDestroy={onDestroyMerchantSandbox}
                  onDismissCreate={onDismissMerchantSandboxCreate}
                  onProvisionDns={onProvisionMerchantSandboxDns}
                  onRefresh={onRefreshMerchantSandboxes}
                  onUpdateCfToken={onUpdateSandboxPlatformSettings}
                  sandboxes={merchantSandboxes}
                  settings={sandboxPlatformSettings}
                />
              </div>
            ) : null}
          </Suspense>
        </div>
      </main>
    </div>
  );
}

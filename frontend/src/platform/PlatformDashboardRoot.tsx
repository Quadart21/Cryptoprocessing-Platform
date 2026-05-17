import { useEffect, useMemo, useState } from "react";

import {
  DashboardRail,
  type DashboardRailGroup,
} from "../components/layout/DashboardRail";
import { DashboardStatusMessages } from "../components/layout/DashboardStatusMessages";
import { SectionContextChips } from "../components/layout/SectionContextChips";
import { ClientSectionHeader } from "../components/client/ClientSectionHeader";
import { TwoFactorPanel } from "../components/security/TwoFactorPanel";
import { ADMIN_SECTION_META, buildAdminMenuGroups } from "./config";
import { AdminClientDetailSection } from "./sections/AdminClientDetailSection";
import { AdminClientsSection } from "./sections/AdminClientsSection";
import { AdminOverviewSection } from "./sections/AdminOverviewSection";
import {
  PlatformEventsPanel,
  PlatformInvoicesPanel,
  PlatformTransactionsPanel,
} from "./sections/AdminPlatformPanels";
import { AdminPlatformPayoutsPanel } from "./sections/AdminPlatformPayoutsPanel";
import { AdminPlatformSettingsSection } from "./sections/AdminPlatformSettingsSection";
import { AdminPublicPagesSection } from "./sections/AdminPublicPagesSection";
import { AdminUsersPanel } from "./sections/AdminUsersPanel";
import { AssetManagementPage } from "./sections/AssetManagementPage";
import { AdminSandboxSection } from "./sections/AdminSandboxSection";
import { type AdminDashboardProps, type AdminSection, isAdminSection } from "./types";

export function PlatformDashboardRoot({
  user,
  loading,
  success,
  error,
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
  heroSecondaryValue,
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
  onUpdatePlatformSettings,
  onFetchPlatformExchangeRate,
  onRefreshPlatformExchangeRate,
  onInspectPlatformTelegramBot,
  onSendPlatformTelegramTest,
  onSendPlatformSmtpBzTest,
  onUpdateTenantPolicy,
  onUpdateAssetAvailability,
  onCreatePublicPage,
  onUpdatePublicPage,
  onDeletePublicPage,
  onCreateAdminUser,
  onUpdateAdminUser,
  onSetupTwoFactor,
  onEnableTwoFactor,
  onDisableTwoFactor,
  onApprovePayout,
  onRejectPayout,
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
}: AdminDashboardProps) {
  const [section, setSection] = useState<AdminSection>("overview");

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
        topbarSubtitle={sectionMeta.title}
        onSelect={(key) => {
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
          onCloseSecretModal={onCloseSecretModal}
        />

        <div className="pw-console-workspace">
          <ClientSectionHeader
            description={sectionMeta.description}
            group={sectionMeta.group}
            title={sectionMeta.title}
          />
          <SectionContextChips items={contextChips} />

          {section === "overview" ? (
            <div className="console-section-stack">
              <section className="stats-grid pw-console-stats">
                <article className="stat-card">
                  <span>Роль</span>
                  <strong>{user.role}</strong>
                </article>
                <article className="stat-card">
                  <span>Статус</span>
                  <strong>{user.status}</strong>
                </article>
                <article className="stat-card">
                  <span>Клиентов</span>
                  <strong>{tenants.length}</strong>
                </article>
                <article className="stat-card">
                  <span>Оборот (оплач.)</span>
                  <strong>{heroPrimaryValue}</strong>
                </article>
                <article className="stat-card">
                  <span>К зачислению</span>
                  <strong>{heroSecondaryValue}</strong>
                </article>
                {heroRows.slice(0, 1).map((row) => (
                  <article className="stat-card" key={row.label}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </article>
                ))}
              </section>

              <AdminOverviewSection
                platformAccounting={platformAccounting}
                platformInvoices={platformInvoices}
                platformTransactions={platformTransactions}
                onSyncInvoice={onSyncInvoice}
              />
            </div>
          ) : null}

          {section === "invoices" ? (
            <div className="console-section-stack">
              <section className="dashboard-grid client-grid">
                <PlatformInvoicesPanel
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
                <PlatformTransactionsPanel
                  className="panel panel-span-2"
                  transactions={platformTransactions}
                />
              </section>
            </div>
          ) : null}

          {section === "payouts" ? (
            <div className="console-section-stack">
              <section className="dashboard-grid client-grid">
                <AdminPlatformPayoutsPanel
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
                <PlatformEventsPanel className="panel panel-span-2" events={platformEvents} />
              </section>
            </div>
          ) : null}

          {section === "clients" || section === "requests" ? (
            <div className="console-section-stack">
              <AdminClientsSection
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
              <AdminClientDetailSection
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
              />
            </div>
          ) : null}

          {section === "team" ? (
            <div className="console-section-stack">
              <section className="dashboard-grid client-grid">
                <AdminUsersPanel
                  loading={loading}
                  roles={roleDefinitions}
                  tenants={tenants}
                  users={adminUsers}
                  onCreate={onCreateAdminUser}
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
              <AdminPlatformSettingsSection
                adminAssetRates={adminAssetRates}
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
                onSendPlatformSmtpBzTest={onSendPlatformSmtpBzTest}
                onUpdatePlatformSettings={onUpdatePlatformSettings}
                onUpdateTenantPolicy={onUpdateTenantPolicy}
              />
            </div>
          ) : null}

          {section === "public-pages" ? (
            <div className="console-section-stack">
              <AdminPublicPagesSection
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
              <AssetManagementPage
                loading={loading}
                adminAssetRates={adminAssetRates}
                onUpdateAssetAvailability={onUpdateAssetAvailability}
              />
            </div>
          ) : null}

          {section === "sandbox" && sandboxConsoleEnabled ? (
            <div className="console-section-stack">
              <AdminSandboxSection
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
        </div>
      </main>
    </div>
  );
}

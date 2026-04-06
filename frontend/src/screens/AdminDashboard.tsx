import { useEffect, useMemo, useState } from "react";

import {
  DashboardRail,
  type DashboardRailGroup,
} from "../components/layout/DashboardRail";
import { DashboardStatusMessages } from "../components/layout/DashboardStatusMessages";
import { TwoFactorPanel } from "../components/security/TwoFactorPanel";
import { AdminClientDetailSection } from "./admin/AdminClientDetailSection";
import { AdminClientsSection } from "./admin/AdminClientsSection";
import { AdminOverviewSection } from "./admin/AdminOverviewSection";
import {
  PlatformEventsPanel,
  PlatformInvoicesPanel,
  PlatformTransactionsPanel,
} from "./admin/AdminPlatformPanels";
import { AdminPlatformSettingsSection } from "./admin/AdminPlatformSettingsSection";
import { AdminPublicPagesSection } from "./admin/AdminPublicPagesSection";
import { AssetManagementPage } from "./admin/AssetManagementPage";
import { AdminUsersPanel } from "./admin/AdminUsersPanel";
import {
  type AdminDashboardProps,
  type AdminSection,
  isAdminSection,
} from "./admin/adminDashboard.types";

const ADMIN_SECTION_META: Record<
  AdminSection,
  { group: string; title: string; description: string }
> = {
  overview: {
    group: "Мониторинг",
    title: "Обзор платформы",
    description: "Сводные метрики, последние инвойсы, транзакции и события платформы.",
  },
  invoices: {
    group: "Мониторинг",
    title: "Инвойсы платформы",
    description: "Единый поток инвойсов по всем клиентам для быстрого контроля.",
  },
  transactions: {
    group: "Мониторинг",
    title: "Транзакции платформы",
    description: "Операционный мониторинг движений средств по всей системе.",
  },
  events: {
    group: "Мониторинг",
    title: "События и webhooks",
    description: "Последние системные и провайдерские события по платформе.",
  },
  requests: {
    group: "Клиенты",
    title: "Заявки на подключение",
    description: "Модерация входящих запросов и принятие решения по онбордингу.",
  },
  clients: {
    group: "Клиенты",
    title: "Список клиентов",
    description: "Каталог клиентов, быстрый доступ к карточке и управлению доступом.",
  },
  "client-detail": {
    group: "Клиенты",
    title: "Карточка клиента",
    description: "Полная детализация клиента: проекты, ключи, инвойсы и операции.",
  },
  "platform-settings": {
    group: "Управление",
    title: "Настройки платформы",
    description: "Глобальные комиссии, уведомления и политика доступности активов.",
  },
  "public-pages": {
    group: "Управление",
    title: "Публичные страницы",
    description: "Управление контентом сайта, размещением в меню и футере.",
  },
  assets: {
    group: "Управление",
    title: "Токены и сети",
    description: "Управление доступностью криптовалют и сетей для клиентов.",
  },
  team: {
    group: "Управление",
    title: "Команда и роли",
    description: "Управление внутренними пользователями и их правами доступа.",
  },
  security: {
    group: "Управление",
    title: "Безопасность админов",
    description: "Защита учетной записи админки и контроль 2FA.",
  },
};

export function AdminDashboard({
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
  onUpdatePlatformSettings,
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
}: AdminDashboardProps) {
  const [section, setSection] = useState<AdminSection>("overview");

  useEffect(() => {
    if (section === "client-detail" && !selectedTenantId) {
      setSection("clients");
    }
  }, [section, selectedTenantId]);

  const adminMenuGroups = useMemo<DashboardRailGroup[]>(
    () => [
      {
        key: "monitoring",
        label: "Мониторинг",
        items: [
          { key: "overview", label: "Обзор" },
          { key: "invoices", label: "Инвойсы" },
          { key: "transactions", label: "Транзакции" },
          { key: "events", label: "События" },
        ],
      },
      {
        key: "clients",
        label: "Клиенты",
        items: [
          { key: "requests", label: "Заявки" },
          { key: "clients", label: "Список" },
          {
            key: "client-detail",
            label: "Карточка",
            disabled: !selectedTenantId,
          },
        ],
      },
      {
        key: "management",
        label: "Управление",
        items: [
          { key: "platform-settings", label: "Настройки" },
          { key: "public-pages", label: "Страницы" },
          { key: "assets", label: "Токены и сети" },
          { key: "team", label: "Команда" },
          { key: "security", label: "Безопасность" },
        ],
      },
    ],
    [selectedTenantId],
  );

  const selectedTenantName =
    selectedTenantDetail?.tenant.name ??
    tenants.find((tenant) => tenant.id === selectedTenantId)?.name ??
    "Клиент";

  const sectionMeta = ADMIN_SECTION_META[section];

  function handleOpenTenant(tenantId: string) {
    onSelectTenant(tenantId);
    setSection("client-detail");
  }

  return (
    <div className="app-frame">
      <DashboardRail
        activeKey={section}
        groups={adminMenuGroups}
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

      <main className="dashboard-shell">
        <DashboardStatusMessages
          error={error}
          newApiSecret={newApiSecret}
          success={success}
        />

        {section === "overview" ? (
          <>
            <section className="stats-grid">
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
                <span>Оборот</span>
                <strong>{heroPrimaryValue}</strong>
              </article>
              <article className="stat-card">
                <span>Net</span>
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
              platformEvents={platformEvents}
              platformInvoices={platformInvoices}
              platformTransactions={platformTransactions}
              tenants={tenants}
              user={user}
            />
          </>
        ) : null}

        {section === "invoices" ? (
          <section className="dashboard-grid client-grid">
            <PlatformInvoicesPanel className="panel panel-span-2" invoices={platformInvoices} />
          </section>
        ) : null}

        {section === "transactions" ? (
          <section className="dashboard-grid client-grid">
            <PlatformTransactionsPanel
              className="panel panel-span-2"
              transactions={platformTransactions}
            />
          </section>
        ) : null}

        {section === "events" ? (
          <section className="dashboard-grid client-grid">
            <PlatformEventsPanel className="panel panel-span-2" events={platformEvents} />
          </section>
        ) : null}

        {section === "clients" || section === "requests" ? (
          <AdminClientsSection
            key={tenants.length + tenants.map(t => t.status).join(',')}
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
        ) : null}

        {section === "client-detail" ? (
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
        ) : null}

        {section === "team" ? (
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
        ) : null}

        {section === "security" ? (
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
        ) : null}

        {section === "platform-settings" ? (
          <AdminPlatformSettingsSection
            loading={loading}
            platformBillingSettings={platformBillingSettings}
            selectedTenantBillingPolicy={selectedTenantBillingPolicy}
            selectedTenantId={selectedTenantId}
            tenants={tenants}
            onSelectTenant={onSelectTenant}
            onInspectPlatformTelegramBot={onInspectPlatformTelegramBot}
            onSendPlatformTelegramTest={onSendPlatformTelegramTest}
            onSendPlatformSmtpBzTest={onSendPlatformSmtpBzTest}
            onUpdatePlatformSettings={onUpdatePlatformSettings}
            onUpdateTenantPolicy={onUpdateTenantPolicy}
          />
        ) : null}

        {section === "public-pages" ? (
          <AdminPublicPagesSection
            loading={loading}
            pages={publicPages}
            onCreate={onCreatePublicPage}
            onUpdate={onUpdatePublicPage}
            onDelete={onDeletePublicPage}
          />
        ) : null}

        {section === "assets" ? (
          <AssetManagementPage
            loading={loading}
            adminAssetRates={adminAssetRates}
            onUpdateAssetAvailability={onUpdateAssetAvailability}
          />
        ) : null}
      </main>
    </div>
  );
}

import { FormEvent, useState } from "react";

import type {
  AccountingSummary,
  ApiKeyItem,
  BalanceResponse,
  CreatePayoutPayload,
  CreateInvoicePayload,
  CurrentUser,
  InvoiceItem,
  MerchantNotificationSettings,
  OnboardingStatus,
  PayoutRequestItem,
  ProjectItem,
  RateNetworkItem,
  TwoFactorSetup,
  TwoFactorStatus,
  TransactionItem,
} from "../api";
import {
  DashboardRail,
  type DashboardRailGroup,
  type DashboardRailItem,
} from "../components/layout/DashboardRail";
import { useClientAnalytics } from "../hooks/useClientAnalytics";
import { TwoFactorPanel } from "../components/security/TwoFactorPanel";
import { ApiDocumentationPanel } from "./client/ApiDocumentationPanel";
import { ApiKeysPanel } from "./client/ApiKeysPanel";
import { AnalyticsFiltersPanel } from "./client/AnalyticsFiltersPanel";
import { IntegrationTestingPanel } from "./client/IntegrationTestingPanel";
import { InvoiceCreatePanel } from "./client/InvoiceCreatePanel";
import { InvoiceDetailPanel } from "./client/InvoiceDetailPanel";
import { InvoicesPanel } from "./client/InvoicesPanel";
import { ProjectsPanel } from "./client/ProjectsPanel";
import { PayoutsPanel } from "./client/PayoutsPanel";
import { TransactionsPanel } from "./client/TransactionsPanel";
import { ClientSecurityNotificationsPanel } from "./client/ClientSecurityNotificationsPanel";

type WebhookFormState = {
  project_id: string;
  webhook_url: string;
  webhook_secret: string;
};

type ClientDashboardProps = {
  user: CurrentUser;
  onboarding: OnboardingStatus | null;
  success: string | null;
  error: string | null;
  newApiSecret: string | null;
  loading: boolean;
  projects: ProjectItem[];
  apiKeys: ApiKeyItem[];
  invoices: InvoiceItem[];
  selectedClientInvoiceId: string | null;
  selectedClientInvoiceDetail: InvoiceItem | null;
  clientTransactions: TransactionItem[];
  payouts: PayoutRequestItem[];
  clientAccounting: AccountingSummary | null;
  balance: BalanceResponse | null;
  invoiceForm: CreateInvoicePayload;
  payoutForm: CreatePayoutPayload;
  webhookForm: WebhookFormState;
  rates: Array<{ currency: string }>;
  availableNetworks: RateNetworkItem[];
  selectedNetwork: RateNetworkItem | null;
  apiBaseUrl: string;
  activeApiKeyPublic: string | null;
  activeWebhookUrl: string | null;
  selectedRoute: string;
  integrationCurl: string;
  twoFactorStatus: TwoFactorStatus | null;
  twoFactorSetup: TwoFactorSetup | null;
  notificationSettings: MerchantNotificationSettings | null;
  onLogout: () => void;
  onCreateInvoice: (event: FormEvent<HTMLFormElement>) => void;
  onCreatePayout: (event: FormEvent<HTMLFormElement>) => void;
  onSaveWebhook: (event: FormEvent<HTMLFormElement>) => void;
  onSendWebhookTest: () => void;
  onInvoiceFormChange: (next: CreateInvoicePayload) => void;
  onPayoutFormChange: (next: CreatePayoutPayload) => void;
  onWebhookFormChange: (next: WebhookFormState) => void;
  onClientRegenerateApiKey: (apiKeyId: string) => void;
  onClientRevokeApiKey: (apiKeyId: string) => void;
  onSelectClientInvoice: (invoiceId: string) => void;
  onClientInvoiceSync: (invoiceId: string) => void;
  onSetupTwoFactor: () => void;
  onEnableTwoFactor: (code: string) => void;
  onDisableTwoFactor: (payload: { password: string; code?: string }) => void;
  onSaveNotificationSettings: (payload: {
    notify_email_enabled: boolean;
    notify_telegram_enabled: boolean;
    telegram_chat_id: string | null;
  }) => void;
  onChangePassword: (payload: { current_password: string; new_password: string }) => void;
};

type ClientSection =
  | "overview"
  | "docs"
  | "projects"
  | "keys"
  | "invoices"
  | "transactions"
  | "balance"
  | "security";

const CLIENT_MENU_GROUPS: DashboardRailGroup[] = [
  {
    key: "overview-group",
    label: "Обзор",
    items: [
      { key: "overview", label: "Сводка" },
      { key: "transactions", label: "Операции" },
      { key: "balance", label: "Баланс" },
    ],
  },
  {
    key: "integration-group",
    label: "Интеграция",
    items: [
      { key: "docs", label: "API" },
      { key: "projects", label: "Проекты" },
      { key: "keys", label: "Ключи" },
      { key: "invoices", label: "Инвойсы" },
    ],
  },
  {
    key: "security-group",
    label: "Безопасность",
    items: [{ key: "security", label: "Доступ" }],
  },
];

const CLIENT_MENU_ITEMS: DashboardRailItem[] = CLIENT_MENU_GROUPS.flatMap((group) => group.items);

const CLIENT_SECTION_META: Record<
  ClientSection,
  { group: string; title: string; description: string }
> = {
  overview: {
    group: "Обзор",
    title: "Сводка кабинета",
    description: "Ключевые метрики, статус проекта и быстрые действия в одном месте.",
  },
  transactions: {
    group: "Обзор",
    title: "Операции",
    description: "Фильтруйте и экспортируйте транзакции по статусам, валютам и периоду.",
  },
  balance: {
    group: "Обзор",
    title: "Баланс и выплаты",
    description: "Текущий баланс проекта и управление выплатами по кошелькам.",
  },
  docs: {
    group: "Интеграция",
    title: "API и документация",
    description: "Базовые маршруты, cURL-примеры и рекомендации по подключению.",
  },
  projects: {
    group: "Интеграция",
    title: "Проекты",
    description: "Список проектов и проверка webhook/интеграций в боевом режиме.",
  },
  keys: {
    group: "Интеграция",
    title: "API-ключи",
    description: "Управление ключами доступа и контроль webhook-конфигурации.",
  },
  invoices: {
    group: "Интеграция",
    title: "Инвойсы",
    description: "Создание, просмотр и синхронизация инвойсов в одном разделе.",
  },
  security: {
    group: "Безопасность",
    title: "Безопасность аккаунта",
    description: "2FA, уведомления и смена пароля для защиты доступа.",
  },
};

const CLIENT_SHORTCUTS: Array<{ section: ClientSection; label: string; hint: string }> = [
  {
    section: "invoices",
    label: "Создать инвойс",
    hint: "Переход к выставлению новых счетов",
  },
  {
    section: "transactions",
    label: "Проверить операции",
    hint: "Фильтрация и поиск по транзакциям",
  },
  {
    section: "keys",
    label: "Обновить ключи",
    hint: "Ротация API-ключей и контроль доступа",
  },
  {
    section: "security",
    label: "Проверить 2FA",
    hint: "Настройки защиты аккаунта и уведомлений",
  },
];

function isClientSection(value: string): value is ClientSection {
  return CLIENT_MENU_ITEMS.some((item) => item.key === value);
}

export function ClientDashboard({
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
  onInvoiceFormChange,
  onPayoutFormChange,
  onWebhookFormChange,
  onClientRegenerateApiKey,
  onClientRevokeApiKey,
  onSelectClientInvoice,
  onClientInvoiceSync,
  onSetupTwoFactor,
  onEnableTwoFactor,
  onDisableTwoFactor,
  onSaveNotificationSettings,
  onChangePassword,
}: ClientDashboardProps) {
  const [section, setSection] = useState<ClientSection>("overview");

  const analytics = useClientAnalytics({
    transactions: clientTransactions,
    currencyFallback: balance?.currency ?? "USDT",
  });

  const sectionMeta = CLIENT_SECTION_META[section];

  return (
    <div className="app-frame">
      <DashboardRail
        activeKey={section}
        groups={CLIENT_MENU_GROUPS}
        onSelect={(key) => {
          if (isClientSection(key)) {
            setSection(key);
          }
        }}
        role="client"
      />

      <main className="dashboard-shell">
        <section className="topbar topbar-compact">
          <div>
            <p className="eyebrow">Кабинет клиента</p>
            <h1>{sectionMeta.title}</h1>
            <p className="topbar-subtitle">{sectionMeta.description}</p>
          </div>
          <div className="topbar-actions">
            <div className="identity-chip">
              <strong>{user.full_name}</strong>
              <span>{user.email}</span>
            </div>
            <button className="ghost-button" onClick={onLogout} type="button">
              Выйти
            </button>
          </div>
        </section>

        {success ? <p className="result-box page-message">{success}</p> : null}
        {error ? <p className="error-box page-message">{error}</p> : null}
        {newApiSecret ? <p className="result-box page-message">Новый secret key: {newApiSecret}</p> : null}

        <section className="section-context">
          <article className="section-context-chip">
            <span>Группа</span>
            <strong>{sectionMeta.group}</strong>
          </article>
          <article className="section-context-chip">
            <span>Раздел</span>
            <strong>{sectionMeta.title}</strong>
          </article>
        </section>

        {(section === "overview" || section === "transactions") && (
          <AnalyticsFiltersPanel
            onPeriodChange={analytics.setPeriod}
            period={analytics.period}
            summary={analytics.summary}
          />
        )}

        {section === "overview" ? (
          <>
            <section className="stats-grid">
              <article className="stat-card">
                <span>Статус</span>
                <strong>{onboarding?.tenant_status ?? "approved"}</strong>
              </article>
              <article className="stat-card">
                <span>Проектов</span>
                <strong>{projects.length}</strong>
              </article>
              <article className="stat-card">
                <span>Инвойсов</span>
                <strong>{invoices.length}</strong>
              </article>
              <article className="stat-card">
                <span>Операций</span>
                <strong>{analytics.summary.transactionCount}</strong>
              </article>
              <article className="stat-card">
                <span>Оборот</span>
                <strong>{analytics.summary.turnover}</strong>
              </article>
              <article className="stat-card">
                <span>Net</span>
                <strong>{analytics.summary.net}</strong>
              </article>
            </section>

            <section className="dashboard-grid client-grid">
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Быстрые переходы</p>
                    <h2>Разделы по группам</h2>
                  </div>
                </div>
                <div className="dashboard-shortcuts">
                  {CLIENT_SHORTCUTS.map((shortcut) => (
                    <button
                      className="ghost-button dashboard-shortcut"
                      key={shortcut.section}
                      onClick={() => setSection(shortcut.section)}
                      type="button"
                    >
                      <strong>{shortcut.label}</strong>
                      <span>{shortcut.hint}</span>
                    </button>
                  ))}
                </div>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Готовность интеграции</p>
                    <h2>Текущий статус подключения</h2>
                  </div>
                </div>
                <div className="tenant-list">
                  <article className="tenant-card">
                    <div>
                      <strong>API-ключ</strong>
                      <p>{activeApiKeyPublic ?? "Активный ключ не найден"}</p>
                    </div>
                  </article>
                  <article className="tenant-card">
                    <div>
                      <strong>Webhook URL</strong>
                      <p>{activeWebhookUrl ?? "Webhook пока не задан"}</p>
                    </div>
                  </article>
                  <article className="tenant-card">
                    <div>
                      <strong>2FA</strong>
                      <p>{twoFactorStatus?.enabled ? "Включено" : "Отключено"}</p>
                    </div>
                  </article>
                  <article className="tenant-card">
                    <div>
                      <strong>Уведомления</strong>
                      <p>
                        Email: {notificationSettings?.notify_email_enabled ? "on" : "off"} / Telegram: {" "}
                        {notificationSettings?.notify_telegram_enabled ? "on" : "off"}
                      </p>
                    </div>
                  </article>
                </div>
              </article>
            </section>

            {clientAccounting ? (
              <section className="stats-grid">
                <article className="stat-card">
                  <span>Всего инвойсов</span>
                  <strong>{clientAccounting.invoices_total_count}</strong>
                </article>
                <article className="stat-card">
                  <span>На сумму</span>
                  <strong>{clientAccounting.invoices_total_amount}</strong>
                </article>
                <article className="stat-card">
                  <span>Подтверждено</span>
                  <strong>{clientAccounting.invoices_confirmed_amount}</strong>
                </article>
                <article className="stat-card">
                  <span>Net amount</span>
                  <strong>{clientAccounting.net_amount}</strong>
                </article>
              </section>
            ) : null}
          </>
        ) : null}

        {section === "docs" ? (
          <section className="dashboard-grid client-grid">
            <ApiDocumentationPanel
              apiBaseUrl={apiBaseUrl}
              activeApiKeyPublic={activeApiKeyPublic}
              selectedRoute={selectedRoute}
              activeWebhookUrl={activeWebhookUrl}
              integrationCurl={integrationCurl}
            />
          </section>
        ) : null}

        {section === "projects" ? (
          <section className="dashboard-grid client-grid">
            <ProjectsPanel projects={projects} />
            <IntegrationTestingPanel
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
          </section>
        ) : null}

        {section === "keys" ? (
          <section className="dashboard-grid client-grid">
            <ApiKeysPanel
              apiKeys={apiKeys}
              onRegenerate={onClientRegenerateApiKey}
              onRevoke={onClientRevokeApiKey}
            />
            <IntegrationTestingPanel
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
          </section>
        ) : null}

        {section === "invoices" ? (
          <section className="dashboard-grid client-grid">
            <InvoiceCreatePanel
              availableNetworks={availableNetworks}
              invoiceForm={invoiceForm}
              loading={loading}
              onCreateInvoice={onCreateInvoice}
              onInvoiceFormChange={onInvoiceFormChange}
              projects={projects}
              rates={rates}
              selectedNetwork={selectedNetwork}
            />
            <InvoicesPanel
              invoices={invoices}
              onSelectInvoice={onSelectClientInvoice}
              onSyncInvoice={onClientInvoiceSync}
              selectedClientInvoiceId={selectedClientInvoiceId}
            />
            <InvoiceDetailPanel selectedClientInvoiceDetail={selectedClientInvoiceDetail} />
          </section>
        ) : null}

        {section === "transactions" ? (
          <section className="dashboard-grid client-grid">
            <div className="panel-span-2">
              <TransactionsPanel
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
          </section>
        ) : null}

        {section === "balance" ? (
          <>
            <section className="stats-grid">
              <article className="stat-card">
                <span>Текущий баланс</span>
                <strong>
                  {balance?.amount ?? "0"} {balance?.currency ?? "USDT"}
                </strong>
              </article>
              <article className="stat-card">
                <span>К зачислению</span>
                <strong>{analytics.summary.net}</strong>
              </article>
              <article className="stat-card">
                <span>Комиссии</span>
                <strong>{analytics.summary.fee}</strong>
              </article>
              <article className="stat-card">
                <span>Успешность</span>
                <strong>{analytics.summary.successRate}</strong>
              </article>
            </section>

            <section className="dashboard-grid client-grid">
              <PayoutsPanel
                loading={loading}
                onCreatePayout={onCreatePayout}
                onPayoutFormChange={onPayoutFormChange}
                payoutForm={payoutForm}
                payouts={payouts}
                projects={projects}
              />
            </section>
          </>
        ) : null}

        {section === "security" ? (
          <section className="dashboard-grid client-grid">
            <TwoFactorPanel
              status={twoFactorStatus}
              setupData={twoFactorSetup}
              loading={loading}
              onSetup={onSetupTwoFactor}
              onEnable={onEnableTwoFactor}
              onDisable={onDisableTwoFactor}
            />
            <ClientSecurityNotificationsPanel
              loading={loading}
              settings={notificationSettings}
              onSaveNotificationSettings={onSaveNotificationSettings}
              onChangePassword={onChangePassword}
            />
          </section>
        ) : null}
      </main>
    </div>
  );
}

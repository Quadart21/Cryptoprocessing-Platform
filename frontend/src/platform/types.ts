import type { FormEvent } from "react";

import type {
  AccountingSummary,
  AdminUserCreatePayload,
  AdminUserItem,
  AdminUserUpdatePayload,
  AssetAvailabilityPayload,
  CurrentUser,
  InvoiceAdminDetail,
  InvoiceItem,
  MerchantSandboxCreatePayload,
  MerchantSandboxCreateResponse,
  MerchantSandboxSummary,
  PayoutRequestItem,
  PlatformBillingSettings,
  NotificationTemplatePreview,
  NotificationTemplatePreviewPayload,
  NotificationTemplateTestPayload,
  NotificationTemplateTestResponse,
  SandboxPlatformSettings,
  ExchangeRateLookup,
  ExchangeRateRefresh,
  ProviderEventItem,
  PublicPageItem,
  RateItem,
  SmtpBzTestPayload,
  SmtpBzTestResponse,
  TenantBillingPolicy,
  TenantCreatePayload,
  TenantCreateResponse,
  TenantAdminUpdatePayload,
  TenantDetailResponse,
  TenantItem,
  TelegramAdminTestPayload,
  TelegramAdminTestResponse,
  TelegramBotIdentity,
  TelegramBotInspectPayload,
  TransactionItem,
  TwoFactorSetup,
  TwoFactorStatus,
  UserRoleDefinition,
  ProjectAdminUpdatePayload,
} from "../api";
import type { DashboardRailItem } from "../components/layout/DashboardRail";

export type AdminSection =
  | "overview"
  | "requests"
  | "clients"
  | "invoices"
  | "transactions"
  | "payouts"
  | "events"
  | "client-detail"
  | "platform-settings"
  | "public-pages"
  | "assets"
  | "sandbox"
  | "team"
  | "security";

export const ADMIN_MENU_ITEMS: DashboardRailItem[] = [
  { key: "overview", label: "Обзор" },
  { key: "requests", label: "Заявки" },
  { key: "clients", label: "Клиенты" },
  { key: "invoices", label: "Инвойсы" },
  { key: "transactions", label: "Транзакции" },
  { key: "payouts", label: "Выплаты" },
  { key: "events", label: "События" },
  { key: "platform-settings", label: "Настройки" },
  { key: "public-pages", label: "Страницы" },
  { key: "assets", label: "Токены и сети" },
  { key: "team", label: "Команда" },
  { key: "security", label: "Безопасность" },
];

export function isAdminSection(value: string): value is Exclude<AdminSection, "client-detail"> {
  if (value === "sandbox") {
    return true;
  }
  return ADMIN_MENU_ITEMS.some((item) => item.key === value);
}

/** Контракт консоли платформы (главный админ / platform roles). */
export type AdminDashboardProps = {
  user: CurrentUser;
  loading: boolean;
  success: string | null;
  error: string | null;
  newApiSecret: string | null;
  tenantForm: TenantCreatePayload;
  createdTenant: TenantCreateResponse | null;
  tenants: TenantItem[];
  selectedTenantId: string | null;
  selectedTenantDetail: TenantDetailResponse | null;
  selectedTenantInvoices: InvoiceItem[];
  selectedTenantTransactions: TransactionItem[];
  selectedTenantPayouts: PayoutRequestItem[];
  selectedTenantAccounting: AccountingSummary | null;
  platformAccounting: AccountingSummary | null;
  platformInvoices: InvoiceItem[];
  platformTransactions: TransactionItem[];
  platformPayouts: PayoutRequestItem[];
  platformEvents: ProviderEventItem[];
  platformBillingSettings: PlatformBillingSettings | null;
  publicPages: PublicPageItem[];
  selectedTenantBillingPolicy: TenantBillingPolicy | null;
  adminAssetRates: RateItem[];
  adminUsers: AdminUserItem[];
  roleDefinitions: UserRoleDefinition[];
  twoFactorStatus: TwoFactorStatus | null;
  twoFactorSetup: TwoFactorSetup | null;
  selectedInvoiceId: string | null;
  selectedInvoiceDetail: InvoiceAdminDetail | null;
  selectedInvoiceEvents: ProviderEventItem[];
  heroRows: Array<{ label: string; value: string }>;
  heroPrimaryValue: string;
  heroSecondaryValue: string;
  sandboxConsoleEnabled: boolean;
  merchantSandboxes: MerchantSandboxSummary[];
  sandboxPlatformSettings: SandboxPlatformSettings | null;
  lastMerchantSandboxCreate: MerchantSandboxCreateResponse | null;
  onLogout: () => void;
  onCreateTenant: (event: FormEvent<HTMLFormElement>) => void;
  onTenantFormChange: (next: TenantCreatePayload) => void;
  onSelectTenant: (tenantId: string) => void;
  onApproveTenant: (tenantId: string) => void;
  onRejectTenant: (tenantId: string) => void;
  onUpdateAdminTenant: (tenantId: string, payload: TenantAdminUpdatePayload) => void;
  onUpdateAdminProject: (projectId: string, payload: ProjectAdminUpdatePayload) => void;
  onDeleteAdminTenant: (tenantId: string) => void;
  onResetTenantOwnerPassword: (tenantId: string) => void;
  onResetTenantOwnerTwoFactor: (tenantId: string) => void;
  onAdminRegenerateApiKey: (apiKeyId: string) => void;
  onAdminRevokeApiKey: (apiKeyId: string) => void;
  onSelectInvoice: (invoiceId: string) => void;
  onUpdateInvoiceStatus: (status: string) => void;
  onSyncInvoice: (invoiceId: string) => void;
  onUpdatePlatformSettings: (payload: PlatformBillingSettings) => Promise<void>;
  onFetchPlatformExchangeRate: (currency: string) => Promise<ExchangeRateLookup>;
  onRefreshPlatformExchangeRate: () => Promise<ExchangeRateRefresh>;
  onInspectPlatformTelegramBot: (
    payload: TelegramBotInspectPayload,
  ) => Promise<TelegramBotIdentity>;
  onSendPlatformTelegramTest: (
    payload: TelegramAdminTestPayload,
  ) => Promise<TelegramAdminTestResponse>;
  onSendPlatformSmtpBzTest: (payload: SmtpBzTestPayload) => Promise<SmtpBzTestResponse>;
  onPreviewNotificationTemplate: (
    payload: NotificationTemplatePreviewPayload,
  ) => Promise<NotificationTemplatePreview>;
  onSendNotificationTemplateTest: (
    payload: NotificationTemplateTestPayload,
  ) => Promise<NotificationTemplateTestResponse>;
  onUpdateTenantPolicy: (payload: Omit<TenantBillingPolicy, "tenant_id">) => void;
  onUpdateAssetAvailability: (payload: AssetAvailabilityPayload) => void;
  onCreatePublicPage: (
    payload: Omit<PublicPageItem, "id" | "created_at" | "updated_at">,
  ) => void;
  onUpdatePublicPage: (
    pageId: string,
    payload: Partial<Omit<PublicPageItem, "id" | "created_at" | "updated_at">>,
  ) => void;
  onDeletePublicPage: (pageId: string) => void;
  onCreateAdminUser: (payload: AdminUserCreatePayload) => void;
  onUpdateAdminUser: (userId: string, payload: AdminUserUpdatePayload) => void;
  onSetupTwoFactor: () => void;
  onEnableTwoFactor: (code: string) => void;
  onDisableTwoFactor: (payload: { password: string; code?: string }) => void;
  onApprovePayout: (payoutId: string) => void;
  onRejectPayout: (payoutId: string) => void;
  onCloseSecretModal: () => void;
  onRefreshMerchantSandboxes: () => void;
  onCreateMerchantSandbox: (payload: MerchantSandboxCreatePayload) => void;
  onUpdateSandboxPlatformSettings: (cloudflareApiToken: string | null | undefined) => void;
  onProvisionMerchantSandboxDns: (sandboxId: string, ipv4: string) => void;
  onDestroyMerchantSandbox: (sandboxId: string) => void;
  onDismissMerchantSandboxCreate: () => void;
};

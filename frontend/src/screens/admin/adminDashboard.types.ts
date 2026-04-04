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
  PayoutRequestItem,
  PlatformBillingSettings,
  ProviderEventItem,
  PublicPageItem,
  RateItem,
  SmtpBzTestPayload,
  SmtpBzTestResponse,
  TenantBillingPolicy,
  TenantCreatePayload,
  TenantCreateResponse,
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
} from "../../api";
import type { DashboardRailItem } from "../../components/layout/DashboardRail";

export type AdminSection =
  | "overview"
  | "requests"
  | "clients"
  | "invoices"
  | "transactions"
  | "events"
  | "client-detail"
  | "platform-settings"
  | "public-pages"
  | "team"
  | "security";

export const ADMIN_MENU_ITEMS: DashboardRailItem[] = [
  { key: "overview", label: "Обзор" },
  { key: "requests", label: "Заявки" },
  { key: "clients", label: "Клиенты" },
  { key: "invoices", label: "Инвойсы" },
  { key: "transactions", label: "Транзакции" },
  { key: "events", label: "События" },
  { key: "platform-settings", label: "Настройки" },
  { key: "public-pages", label: "Страницы" },
  { key: "team", label: "Команда" },
  { key: "security", label: "Безопасность" },
];

export function isAdminSection(value: string): value is Exclude<AdminSection, "client-detail"> {
  return ADMIN_MENU_ITEMS.some((item) => item.key === value);
}

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
  onLogout: () => void;
  onCreateTenant: (event: FormEvent<HTMLFormElement>) => void;
  onTenantFormChange: (next: TenantCreatePayload) => void;
  onSelectTenant: (tenantId: string) => void;
  onApproveTenant: (tenantId: string) => void;
  onRejectTenant: (tenantId: string) => void;
  onAdminRegenerateApiKey: (apiKeyId: string) => void;
  onAdminRevokeApiKey: (apiKeyId: string) => void;
  onSelectInvoice: (invoiceId: string) => void;
  onUpdateInvoiceStatus: (status: string) => void;
  onUpdatePlatformSettings: (payload: PlatformBillingSettings) => void;
  onInspectPlatformTelegramBot: (
    payload: TelegramBotInspectPayload,
  ) => Promise<TelegramBotIdentity>;
  onSendPlatformTelegramTest: (
    payload: TelegramAdminTestPayload,
  ) => Promise<TelegramAdminTestResponse>;
  onSendPlatformSmtpBzTest: (
    payload: SmtpBzTestPayload,
  ) => Promise<SmtpBzTestResponse>;
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
};

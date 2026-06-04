import type { FormEvent } from "react";

import type {
  AccountingSummary,
  ApiKeyItem,
  BalanceResponse,
  CheckoutDeliveryMode,
  CreateInvoicePayload,
  CreatePayoutPayload,
  CurrentUser,
  InvoiceItem,
  InvoiceDetail,
  InvoiceSettlement,
  InvoiceWebhookTestResponse,
  MerchantNotificationSettings,
  OnboardingStatus,
  PayoutRequestItem,
  ProjectItem,
  RateNetworkItem,
  TwoFactorSetup,
  TwoFactorStatus,
  TransactionItem,
} from "../api";

export type WebhookFormState = {
  project_id: string;
  webhook_url: string;
  webhook_secret: string;
  checkout_delivery: CheckoutDeliveryMode;
  return_url_success: string;
  return_url_failed: string;
};

/** Публичный контракт экрана кабинета (AppController → ClientDashboard). */
export type ClientDashboardProps = {
  user: CurrentUser;
  onboarding: OnboardingStatus | null;
  success: string | null;
  error: string | null;
  onDismissSuccess: () => void;
  onDismissError: () => void;
  newApiSecret: string | null;
  loading: boolean;
  projects: ProjectItem[];
  apiKeys: ApiKeyItem[];
  invoices: InvoiceItem[];
  selectedClientInvoiceId: string | null;
  selectedClientInvoiceDetail: InvoiceDetail | null;
  isClientInvoiceModalOpen: boolean;
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
  onInvoiceWebhookTest: (invoiceId: string) => Promise<InvoiceWebhookTestResponse>;
  onInvoiceFormChange: (next: CreateInvoicePayload) => void;
  onPayoutFormChange: (next: CreatePayoutPayload) => void;
  onWebhookFormChange: (next: WebhookFormState) => void;
  onClientRegenerateApiKey: (apiKeyId: string) => void;
  onClientRevokeApiKey: (apiKeyId: string) => void;
  onSelectClientInvoice: (invoiceId: string) => void;
  onClientInvoiceSync: (invoiceId: string) => void;
  onCloseClientInvoiceModal: () => void;
  onSetupTwoFactor: () => void;
  onEnableTwoFactor: (code: string) => void;
  onDisableTwoFactor: (payload: { password: string; code?: string }) => void;
  onSaveNotificationSettings: (payload: {
    notify_email_enabled: boolean;
    notify_telegram_enabled: boolean;
    telegram_chat_id: string | null;
  }) => void;
  onChangePassword: (payload: { current_password: string; new_password: string }) => void;
  onCloseSecretModal: () => void;
  onRefreshBalance: () => void;
};

export type MerchantSection =
  | "overview"
  | "docs"
  | "projects"
  | "keys"
  | "invoices"
  | "transactions"
  | "balance"
  | "security";

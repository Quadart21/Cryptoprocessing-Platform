import { request, authHeaders } from "./base";
import type {
  RegistrationPayload,
  RegistrationResponse,
  OnboardingStatus,
  ProjectItem,
  ApiKeyItem,
  ApiKeyRegenerateResponse,
  InvoiceItem,
  CreateInvoicePayload,
  BalanceResponse,
  TransactionItem,
  PayoutRequestItem,
  CreatePayoutPayload,
  AccountingSummary,
  RatesResponse,
  WebhookConfigItem,
  WebhookTestResponse,
  InvoiceWebhookTestResponse,
  MerchantNotificationSettings,
  MerchantNotificationSettingsUpdatePayload,
  CheckoutDeliveryMode,
} from "./base";

export function register(payload: RegistrationPayload): Promise<RegistrationResponse> {
  return request<RegistrationResponse>("/client/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchOnboardingStatus(token: string): Promise<OnboardingStatus> {
  return request<OnboardingStatus>("/client/onboarding/status", {
    headers: authHeaders(token),
  });
}

export function fetchProjects(token: string): Promise<ProjectItem[]> {
  return request<ProjectItem[]>("/client/projects", {
    headers: authHeaders(token),
  });
}

export function fetchApiKeys(token: string): Promise<ApiKeyItem[]> {
  return request<ApiKeyItem[]>("/client/api-keys", {
    headers: authHeaders(token),
  });
}

export function fetchInvoices(token: string): Promise<InvoiceItem[]> {
  return request<InvoiceItem[]>("/client/invoices", {
    headers: authHeaders(token),
  });
}

export function fetchClientInvoiceDetail(
  token: string,
  invoiceId: string,
): Promise<InvoiceItem> {
  return request<InvoiceItem>(`/client/invoices/${invoiceId}`, {
    headers: authHeaders(token),
  });
}

export function createInvoice(
  token: string,
  payload: CreateInvoicePayload,
): Promise<InvoiceItem> {
  return request<InvoiceItem>("/client/invoices", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function fetchBalance(token: string): Promise<BalanceResponse> {
  return request<BalanceResponse>("/client/balance", {
    headers: authHeaders(token),
  });
}

export function fetchClientTransactions(token: string): Promise<TransactionItem[]> {
  return request<TransactionItem[]>("/client/transactions", {
    headers: authHeaders(token),
  });
}

export function fetchClientPayouts(token: string): Promise<PayoutRequestItem[]> {
  return request<PayoutRequestItem[]>("/client/payouts", {
    headers: authHeaders(token),
  });
}

export function createClientPayout(
  token: string,
  payload: CreatePayoutPayload,
): Promise<PayoutRequestItem> {
  return request<PayoutRequestItem>("/client/payouts", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function fetchClientAccountingSummary(token: string): Promise<AccountingSummary> {
  return request<AccountingSummary>("/client/accounting/summary", {
    headers: authHeaders(token),
  });
}

export function fetchRates(token: string): Promise<RatesResponse> {
  return request<RatesResponse>("/client/rates", {
    headers: authHeaders(token),
  });
}

export function fetchWebhookConfigs(token: string): Promise<WebhookConfigItem[]> {
  return request<WebhookConfigItem[]>("/client/webhooks", {
    headers: authHeaders(token),
  });
}

export function updateWebhookConfig(
  token: string,
  payload: {
    project_id: string;
    webhook_url?: string;
    webhook_secret?: string;
    checkout_delivery?: CheckoutDeliveryMode;
  },
): Promise<WebhookConfigItem> {
  return request<WebhookConfigItem>("/client/webhooks", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function sendWebhookTest(
  token: string,
  payload: {
    project_id: string;
  },
): Promise<WebhookTestResponse> {
  return request<WebhookTestResponse>("/client/webhooks/test", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function sendInvoiceWebhookTest(
  token: string,
  invoiceId: string,
): Promise<InvoiceWebhookTestResponse> {
  return request<InvoiceWebhookTestResponse>(`/client/invoices/${encodeURIComponent(invoiceId)}/webhook-test`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export function syncClientInvoice(token: string, invoiceId: string): Promise<InvoiceItem> {
  return request<InvoiceItem>(`/client/invoices/${invoiceId}/sync`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export function revokeClientApiKey(token: string, apiKeyId: string): Promise<ApiKeyItem> {
  return request<ApiKeyItem>(`/client/api-keys/${apiKeyId}/revoke`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export function regenerateClientApiKey(
  token: string,
  apiKeyId: string,
): Promise<ApiKeyRegenerateResponse> {
  return request<ApiKeyRegenerateResponse>(`/client/api-keys/${apiKeyId}/regenerate`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export function fetchClientNotificationSettings(
  token: string,
): Promise<MerchantNotificationSettings> {
  return request<MerchantNotificationSettings>("/client/notifications/settings", {
    headers: authHeaders(token),
  });
}

export function updateClientNotificationSettings(
  token: string,
  payload: MerchantNotificationSettingsUpdatePayload,
): Promise<MerchantNotificationSettings> {
  return request<MerchantNotificationSettings>("/client/notifications/settings", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

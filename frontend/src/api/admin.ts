import { request, authHeaders } from "./base";
import type {
  TenantItem,
  TenantCreateResponse,
  TenantCreatePayload,
  TenantAdminUpdatePayload,
  TenantDetailResponse,
  ProjectAdminUpdatePayload,
  UserRoleDefinition,
  AdminUserItem,
  AdminUserCreatePayload,
  AdminUserCreateResponse,
  AdminUserUpdatePayload,
  InvoiceItem,
  InvoiceAdminDetail,
  TransactionItem,
  PayoutRequestItem,
  ReviewPayoutPayload,
  AccountingSummary,
  PlatformBillingSettings,
  TenantBillingPolicy,
  RatesResponse,
  AssetAvailabilityPayload,
  AssetAvailabilityResponse,
  PublicPageItem,
  PublicPageListResponse,
  ProviderEventItem,
  TelegramBotIdentity,
  TelegramBotInspectPayload,
  TelegramAdminTestPayload,
  TelegramAdminTestResponse,
  SmtpBzTestPayload,
  SmtpBzTestResponse,
  ExchangeRateLookup,
  ExchangeRateRefresh,
} from "./base";

export function fetchTenants(token: string): Promise<TenantItem[]> {
  return request<TenantItem[]>("/admin/tenants", {
    headers: authHeaders(token),
  });
}

export function createTenant(
  token: string,
  payload: TenantCreatePayload,
): Promise<TenantCreateResponse> {
  return request<TenantCreateResponse>("/admin/tenants", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function approveTenant(
  token: string,
  tenantId: string,
  reviewComment?: string,
): Promise<{
  status: string;
  tenant_id: string;
  project_id: string;
  api_public_key: string;
  api_secret_key: string;
  generated_password: string;
}> {
  return request(`/admin/tenants/${tenantId}/approve`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ review_comment: reviewComment ?? null }),
  });
}

export function rejectTenant(
  token: string,
  tenantId: string,
  reviewComment?: string,
): Promise<TenantItem> {
  return request<TenantItem>(`/admin/tenants/${tenantId}/reject`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ review_comment: reviewComment ?? null }),
  });
}

export function fetchTenantDetail(
  token: string,
  tenantId: string,
): Promise<TenantDetailResponse> {
  return request<TenantDetailResponse>(`/admin/tenants/${tenantId}`, {
    headers: authHeaders(token),
  });
}

export function updateAdminTenant(
  token: string,
  tenantId: string,
  payload: TenantAdminUpdatePayload,
): Promise<TenantDetailResponse> {
  return request<TenantDetailResponse>(`/admin/tenants/${tenantId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function updateAdminProject(
  token: string,
  projectId: string,
  payload: ProjectAdminUpdatePayload,
): Promise<import("./base").ProjectItem> {
  return request<import("./base").ProjectItem>(`/admin/projects/${projectId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function deleteAdminTenant(token: string, tenantId: string): Promise<{ status: string; tenant_id: string }> {
  return request<{ status: string; tenant_id: string }>(`/admin/tenants/${tenantId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export function fetchTenantInvoices(token: string, tenantId: string): Promise<InvoiceItem[]> {
  return request<InvoiceItem[]>(`/admin/tenants/${tenantId}/invoices`, {
    headers: authHeaders(token),
  });
}

export function fetchTenantTransactions(
  token: string,
  tenantId: string,
): Promise<TransactionItem[]> {
  return request<TransactionItem[]>(`/admin/tenants/${tenantId}/transactions`, {
    headers: authHeaders(token),
  });
}

export function fetchTenantAccountingSummary(
  token: string,
  tenantId: string,
): Promise<AccountingSummary> {
  return request<AccountingSummary>(`/admin/tenants/${tenantId}/accounting/summary`, {
    headers: authHeaders(token),
  });
}

export function fetchTenantPayouts(
  token: string,
  tenantId: string,
): Promise<PayoutRequestItem[]> {
  return request<PayoutRequestItem[]>(`/admin/tenants/${tenantId}/payouts`, {
    headers: authHeaders(token),
  });
}

export function reviewAdminPayout(
  token: string,
  payoutId: string,
  payload: ReviewPayoutPayload,
): Promise<PayoutRequestItem> {
  return request<PayoutRequestItem>(`/admin/payouts/${payoutId}/review`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function fetchAdminInvoices(token: string): Promise<InvoiceItem[]> {
  return request<InvoiceItem[]>("/admin/invoices", {
    headers: authHeaders(token),
  });
}

export function fetchAdminInvoiceDetail(
  token: string,
  invoiceId: string,
): Promise<InvoiceAdminDetail> {
  return request<InvoiceAdminDetail>(`/admin/invoices/${invoiceId}`, {
    headers: authHeaders(token),
  });
}

export function updateAdminInvoiceStatus(
  token: string,
  invoiceId: string,
  status: string,
  txHash?: string,
): Promise<InvoiceAdminDetail> {
  return request<InvoiceAdminDetail>(`/admin/invoices/${invoiceId}/status`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ status, tx_hash: txHash ?? null }),
  });
}

export function syncAdminInvoice(token: string, invoiceId: string): Promise<InvoiceAdminDetail> {
  return request<InvoiceAdminDetail>(`/admin/invoices/${invoiceId}/sync`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export function fetchAdminTransactions(token: string): Promise<TransactionItem[]> {
  return request<TransactionItem[]>("/admin/transactions", {
    headers: authHeaders(token),
  });
}

export function fetchAdminPayouts(token: string): Promise<PayoutRequestItem[]> {
  return request<PayoutRequestItem[]>("/admin/payouts", {
    headers: authHeaders(token),
  });
}

export function fetchAdminEvents(token: string): Promise<ProviderEventItem[]> {
  return request<ProviderEventItem[]>("/admin/events", {
    headers: authHeaders(token),
  });
}

export function fetchInvoiceEvents(
  token: string,
  invoiceId: string,
): Promise<ProviderEventItem[]> {
  return request<ProviderEventItem[]>(`/admin/invoices/${invoiceId}/events`, {
    headers: authHeaders(token),
  });
}

export function fetchPlatformAccountingSummary(token: string): Promise<AccountingSummary> {
  return request<AccountingSummary>("/admin/accounting/summary", {
    headers: authHeaders(token),
  });
}

export function fetchPlatformBillingSettings(token: string): Promise<PlatformBillingSettings> {
  return request<PlatformBillingSettings>("/admin/billing/settings", {
    headers: authHeaders(token),
  });
}

export function fetchPlatformExchangeRate(
  token: string,
  currency: string,
): Promise<ExchangeRateLookup> {
  return request<ExchangeRateLookup>(`/admin/billing/exchange-rate/${encodeURIComponent(currency)}`, {
    headers: authHeaders(token),
  });
}

export function refreshPlatformExchangeRate(
  token: string,
): Promise<ExchangeRateRefresh> {
  return request<ExchangeRateRefresh>(
    "/admin/billing/exchange-rates/refresh",
    {
      method: "POST",
      headers: authHeaders(token),
    },
  );
}

export function updatePlatformBillingSettings(
  token: string,
  payload: PlatformBillingSettings,
): Promise<PlatformBillingSettings> {
  return request<PlatformBillingSettings>("/admin/billing/settings", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function sendPlatformSmtpBzTest(
  token: string,
  payload: SmtpBzTestPayload,
): Promise<SmtpBzTestResponse> {
  return request<SmtpBzTestResponse>("/admin/billing/smtp/test", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function inspectPlatformTelegramBot(
  token: string,
  payload: TelegramBotInspectPayload,
): Promise<TelegramBotIdentity> {
  return request<TelegramBotIdentity>("/admin/billing/telegram/bot", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function sendPlatformTelegramTest(
  token: string,
  payload: TelegramAdminTestPayload,
): Promise<TelegramAdminTestResponse> {
  return request<TelegramAdminTestResponse>("/admin/billing/telegram/test", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function fetchTenantBillingPolicy(
  token: string,
  tenantId: string,
): Promise<TenantBillingPolicy> {
  return request<TenantBillingPolicy>(`/admin/tenants/${tenantId}/billing-policy`, {
    headers: authHeaders(token),
  });
}

export function updateTenantBillingPolicy(
  token: string,
  tenantId: string,
  payload: Omit<TenantBillingPolicy, "tenant_id">,
): Promise<TenantBillingPolicy> {
  return request<TenantBillingPolicy>(`/admin/tenants/${tenantId}/billing-policy`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function fetchAdminAssets(token: string): Promise<RatesResponse> {
  return request<RatesResponse>("/admin/assets", {
    headers: authHeaders(token),
  });
}

export function updateAdminAssetAvailability(
  token: string,
  payload: AssetAvailabilityPayload,
): Promise<AssetAvailabilityResponse> {
  return request<AssetAvailabilityResponse>("/admin/assets", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function fetchAdminRoles(token: string): Promise<UserRoleDefinition[]> {
  return request<UserRoleDefinition[]>("/admin/roles", {
    headers: authHeaders(token),
  });
}

export function fetchAdminUsers(
  token: string,
  tenantId?: string | null,
): Promise<AdminUserItem[]> {
  const query = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : "";
  return request<AdminUserItem[]>(`/admin/users${query}`, {
    headers: authHeaders(token),
  });
}

export function createAdminUser(
  token: string,
  payload: AdminUserCreatePayload,
): Promise<AdminUserCreateResponse> {
  return request<AdminUserCreateResponse>("/admin/users", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function updateAdminUser(
  token: string,
  userId: string,
  payload: AdminUserUpdatePayload,
): Promise<AdminUserItem> {
  return request<AdminUserItem>(`/admin/users/${userId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function fetchAdminPublicPages(token: string): Promise<PublicPageItem[]> {
  return request<PublicPageItem[]>("/admin/public-pages", {
    headers: authHeaders(token),
  });
}

export function createAdminPublicPage(
  token: string,
  payload: Omit<PublicPageItem, "id" | "created_at" | "updated_at">,
): Promise<PublicPageItem> {
  return request<PublicPageItem>("/admin/public-pages", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function updateAdminPublicPage(
  token: string,
  pageId: string,
  payload: Partial<Omit<PublicPageItem, "id" | "created_at" | "updated_at">>,
): Promise<PublicPageItem> {
  return request<PublicPageItem>(`/admin/public-pages/${encodeURIComponent(pageId)}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function deleteAdminPublicPage(token: string, pageId: string): Promise<void> {
  return request<void>(`/admin/public-pages/${encodeURIComponent(pageId)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export function revokeAdminApiKey(token: string, apiKeyId: string): Promise<import("./base").ApiKeyItem> {
  return request<import("./base").ApiKeyItem>(`/admin/api-keys/${apiKeyId}/revoke`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export function regenerateAdminApiKey(
  token: string,
  apiKeyId: string,
): Promise<import("./base").ApiKeyRegenerateResponse> {
  return request<import("./base").ApiKeyRegenerateResponse>(`/admin/api-keys/${apiKeyId}/regenerate`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export function fetchCsrfToken(token: string): Promise<{ csrf_token: string }> {
  return request<{ csrf_token: string }>("/admin/security/csrf", {
    headers: authHeaders(token),
  });
}

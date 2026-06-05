import { resolveApiBaseUrl } from "./config/apiBase";
import { getCsrfToken, setCsrfToken } from "./storage";

const API_BASE_URL = resolveApiBaseUrl();

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type PasswordRecoveryResponse = {
  status: string;
  message: string;
};

export type CurrentUser = {
  id: string;
  tenant_id: string | null;
  email: string;
  full_name: string;
  role: string;
  status: string;
  permissions: string[];
  totp_enabled: boolean;
};

export type TenantItem = {
  id: string;
  name: string;
  slug: string;
  status: string;
  review_comment: string | null;
  owner_email: string;
  timezone: string;
  base_currency: string;
  plan: string;
};

export type TenantCreateResponse = TenantItem & {
  invite_token: string;
  project_id: string;
  api_public_key: string;
  api_secret_key: string;
};

export type TenantCreatePayload = {
  company_name: string;
  owner_email: string;
  owner_full_name: string;
  domain: string;
  timezone: string;
  base_currency: string;
  plan: string;
};

export type RegistrationPayload = {
  company_name: string;
  owner_full_name: string;
  owner_email: string;
  password: string;
  domain: string;
  project_description: string;
  timezone: string;
  base_currency: string;
  plan: string;
};

export type RegistrationResponse = {
  tenant_id: string;
  user_id: string;
  status: string;
  message: string;
};

export type OnboardingStatus = {
  tenant_id: string | null;
  tenant_status: string | null;
  review_comment: string | null;
  project_name: string | null;
  project_domain: string | null;
  project_description: string | null;
  project_status: string | null;
};

export type CheckoutDeliveryMode = "payment_page" | "h2h" | "both";

export type ProjectItem = {
  id: string;
  tenant_id: string;
  name: string;
  domain: string;
  description: string | null;
  webhook_url: string | null;
  has_webhook_secret: boolean;
  checkout_delivery: CheckoutDeliveryMode;
  status: string;
};

export type ApiKeyItem = {
  id: string;
  project_id: string;
  public_key: string;
  status: string;
};

export type ApiKeyRegenerateResponse = ApiKeyItem & {
  secret_key: string;
};

export type WebhookConfigItem = {
  project_id: string;
  webhook_url: string | null;
  has_secret: boolean;
  checkout_delivery: CheckoutDeliveryMode;
  return_url_success: string | null;
  return_url_failed: string | null;
};

export type WebhookTestResponse = {
  project_id: string;
  webhook_url: string;
  event_id: string;
  delivered_at: string;
  attempts: number;
  status_code: number;
  response_preview: string | null;
};

export type InvoiceItem = {
  id: string;
  project_id: string;
  merchant_order_id: string;
  provider_order_id: string;
  amount_fiat: string;
  fiat_currency: string;
  amount_crypto: string;
  crypto_currency: string;
  network: string;
  payment_address: string | null;
  qr_url: string | null;
  payment_page_url: string | null;
  checkout_delivery: CheckoutDeliveryMode;
  status: string;
  network_confirmations_actual: number | null;
  network_confirmations_required: number | null;
  expires_at: string;
  created_at: string;
};

export type InvoiceSettlement = {
  amount_crypto: string;
  crypto_currency: string;
  gross_amount: string;
  total_fee: string;
  net_amount: string;
  currency: string;
  is_final: boolean;
  paid_at: string | null;
};

export type InvoiceTransactionDetails = {
  operation_type: string;
  created_at: string;
  last_updated_at: string;
  paid_at: string | null;
  trading_pair: string;
  amount_crypto: string;
  crypto_currency: string;
  amount_fiat: string;
  fiat_currency: string;
  status: string;
  exchange_id: string;
  wallet_address: string | null;
  tx_hash: string | null;
  exchange_rate: string | null;
  exchange_rate_currency: string;
  processing_commission: string | null;
  platform_commission: string | null;
  total_commission: string | null;
  network_commission: string | null;
  network_commission_currency: string | null;
  commission_currency: string;
  network_confirmations_actual: number | null;
  network_confirmations_required: number | null;
  is_estimate: boolean;
};

export type InvoiceDetail = InvoiceItem & {
  settlement: InvoiceSettlement | null;
  transaction_details: InvoiceTransactionDetails | null;
};

export type InvoiceAdminDetail = InvoiceItem & {
  tenant_id: string;
  paid_at: string | null;
  confirmed_at: string | null;
  metadata_json: Record<string, unknown> | null;
  raw_provider_payload_json: Record<string, unknown> | null;
  transaction_details: InvoiceTransactionDetails | null;
};

export type CreateInvoicePayload = {
  project_id: string;
  merchant_order_id: string;
  amount_fiat: number;
  fiat_currency: string;
  crypto_currency: string;
  network: string;
  metadata: Record<string, string>;
};

export type BalanceHoldItem = {
  transaction_id: string;
  invoice_id: string;
  merchant_order_id: string;
  amount: string;
  available_at: string;
};

export type BalanceResponse = {
  currency: string;
  amount: string;
  available_amount: string;
  frozen_amount: string;
  pending_amount: string;
  locked_amount: string;
  total_amount: string;
  hold_hours: number;
  next_release_at: string | null;
  holds: BalanceHoldItem[];
};

export type TransactionItem = {
  id: string;
  tenant_id: string;
  project_id: string;
  invoice_id: string;
  amount_crypto: string | null;
  crypto_currency: string | null;
  gross_amount: string;
  provider_fee?: string | null;
  platform_fee?: string | null;
  turnover_fee?: string | null;
  total_fee?: string | null;
  net_amount: string;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
};

export type PayoutRequestItem = {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  project_id: string | null;
  project_name: string | null;
  requested_by_user_id: string | null;
  reviewed_by_user_id: string | null;
  destination_address: string;
  network: string;
  currency: string;
  amount_requested: string;
  amount_approved: string | null;
  status: string;
  review_comment: string | null;
  external_payout_id: string | null;
  processed_at: string | null;
  created_at: string;
};

export type CreatePayoutPayload = {
  project_id: string;
  destination_address: string;
  amount: number;
  note?: string;
};

export type ReviewPayoutPayload = {
  action: "approve" | "reject";
  review_comment?: string;
  external_payout_id?: string;
  amount_approved?: number;
};

export type TenantOwnerItem = {
  id: string;
  email: string;
  full_name: string;
  status: string;
};

export type AdminTenantOwnerPasswordResetResponse = {
  status: string;
  tenant_id: string;
  user_id: string;
  email: string;
  generated_password: string;
};

export type TenantAdminUpdatePayload = {
  company_name: string;
  slug: string;
  status: string;
  review_comment: string | null;
  owner_email: string;
  owner_full_name: string;
  timezone: string;
  base_currency: string;
  plan: string;
};

export type ProjectAdminUpdatePayload = {
  name: string;
  domain: string;
  description: string | null;
  webhook_url: string | null;
  checkout_delivery: CheckoutDeliveryMode;
  status: string;
};

export type TenantDetailResponse = {
  tenant: TenantItem;
  owner: TenantOwnerItem;
  projects: ProjectItem[];
  api_keys: ApiKeyItem[];
  invoices_count: number;
  approved_projects_count: number;
};

export type UserRoleDefinition = {
  role: string;
  scope: "platform" | "tenant";
  label: string;
  description: string;
  permissions: string[];
};

export type AdminUserItem = {
  id: string;
  tenant_id: string | null;
  tenant_name: string | null;
  email: string;
  full_name: string;
  role: string;
  status: string;
  totp_enabled: boolean;
  invited_at: string | null;
  activated_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminUserCreatePayload = {
  email: string;
  full_name: string;
  role: string;
  tenant_id: string | null;
  status: "invited" | "active" | "suspended";
  password?: string;
  create_invite: boolean;
};

export type AdminUserUpdatePayload = {
  full_name?: string;
  role?: string;
  tenant_id?: string | null;
  status?: "invited" | "active" | "suspended";
  password?: string;
  reset_two_factor?: boolean;
};

export type AdminUserCreateResponse = {
  user: AdminUserItem;
  invite_token: string | null;
};

export type TwoFactorStatus = {
  enabled: boolean;
  configured: boolean;
  confirmed_at: string | null;
};

export type TwoFactorSetup = {
  enabled: boolean;
  secret: string;
  issuer: string;
  account_name: string;
  otpauth_url: string;
};

export type AccountingSummary = {
  tenant_id: string | null;
  invoices_total_count: number;
  invoices_paid_count: number;
  invoices_confirmed_count: number;
  invoices_failed_count: number;
  invoices_expired_count: number;
  invoices_total_amount: string;
  invoices_paid_amount: string;
  invoices_confirmed_amount: string;
  gross_amount: string;
  provider_fee_amount: string;
  platform_fee_amount: string;
  turnover_fee_amount: string;
  total_platform_revenue_amount: string;
  net_amount: string;
  average_invoice_amount: string;
};

export type ExchangeRatePriceField = "last" | "buy" | "sell";

export type PlatformBillingSettings = {
  provider_fee_percent: string;
  default_markup_percent: string;
  default_turnover_fee_percent: string;
  platform_markup_min_usdt: string;
  platform_fee_min_usdt: string;
  platform_markup_min_band_usdt_low: string;
  platform_markup_min_band_usdt_high: string;
  exchange_rate_markup_percent: string;
  exchange_rate_price_field: ExchangeRatePriceField;
  manual_exchange_rates: Record<string, string>;
  current_exchange_rates: Record<string, string>;
  allow_tenant_markup_override: boolean;
  allow_tenant_turnover_fee_override: boolean;
  payouts_enabled: boolean;
  email_notifications_enabled: boolean;
  telegram_notifications_enabled: boolean;
  smtp_bz_enabled: boolean;
  smtp_bz_api_base_url: string;
  smtp_bz_sender_email: string;
  smtp_bz_sender_name: string;
  smtp_bz_reply_to: string | null;
  smtp_bz_tag: string | null;
  smtp_bz_api_key_configured: boolean;
  smtp_bz_api_key_masked?: string | null;
  smtp_bz_api_key?: string | null;
  telegram_api_base_url: string;
  telegram_bot_token_configured: boolean;
  telegram_bot_token_masked?: string | null;
  telegram_bot_token?: string | null;
  notification_events: NotificationEventToggle[];
  notification_brand_name: string;
  notification_logo_url: string | null;
  notification_primary_url: string | null;
  notification_templates: NotificationTemplateItem[];
  notification_template_variables: string[];
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  seo_favicon_url: string | null;
  seo_og_image_url: string | null;
  seo_robots: string;
  seo_canonical_url: string | null;
  ops_telegram?: OpsTelegramSettings | null;
};

export type OpsTelegramTopic = {
  key: string;
  title: string;
  description: string;
  thread_id: number | null;
  enabled: boolean;
  event_codes: string[];
  events_enabled_count: number;
};

export type OpsTelegramEvent = {
  code: string;
  topic_key: string;
  topic_title: string;
  enabled: boolean;
};

export type OpsTelegramSettings = {
  enabled: boolean;
  chat_id: string | null;
  topics: OpsTelegramTopic[];
  events: OpsTelegramEvent[];
};

export type OpsTelegramTopicTestPayload = {
  topic_key: string;
};

export type OpsTelegramTopicTestResponse = {
  ok: boolean;
  topic_key: string;
  chat_id: string | null;
  thread_id: number | null;
  telegram_message_id: number | null;
};

export type OpsTelegramProvisionPayload = {
  chat_id?: string | null;
};

export type OpsTelegramProvisionResponse = {
  ok: boolean;
  chat_id: string;
  created_topics: Record<string, number>;
  topics: Record<string, { thread_id?: number | null; enabled?: boolean }>;
};

export type ExchangeRateLookup = {
  currency: string;
  quote_currency: string;
  rate: string | null;
  source: "api" | "manual" | "cached" | string;
};

export type ExchangeRateRefresh = {
  quote_currency: string;
  refreshed_symbols: number;
  cached_symbols: number;
  refreshed: boolean;
};

export type TelegramBotInspectPayload = {
  telegram_api_base_url?: string | null;
  telegram_bot_token?: string | null;
};

export type TelegramBotIdentity = {
  token_configured: boolean;
  token_masked: string | null;
  api_base_url: string;
  bot_id: number | null;
  username: string | null;
  first_name: string | null;
  display_name: string | null;
  checked_with_override: boolean;
};

export type TelegramAdminTestPayload = {
  admin_telegram_chat_id: string;
  telegram_api_base_url?: string | null;
  telegram_bot_token?: string | null;
};

export type TelegramAdminTestResponse = {
  ok: boolean;
  chat_id: string;
  api_base_url: string;
  bot_username: string | null;
  bot_display_name: string | null;
  telegram_message_id: number | null;
};

export type SmtpBzTestPayload = {
  test_recipient_email: string;
  smtp_bz_api_base_url?: string | null;
  smtp_bz_sender_email?: string | null;
  smtp_bz_sender_name?: string | null;
  smtp_bz_reply_to?: string | null;
  smtp_bz_tag?: string | null;
  smtp_bz_api_key?: string | null;
};

export type SmtpBzTestResponse = {
  ok: boolean;
  smtp_bz_api_base_url: string;
  sender_email: string;
  sender_name: string;
  recipient_email: string;
  tag: string | null;
};

export type NotificationEventToggle = {
  code: string;
  title: string;
  mode: "notify" | "confirm" | string;
  email_enabled: boolean;
  telegram_enabled: boolean;
};

export type NotificationTemplateItem = {
  code: string;
  title: string;
  mode: "notify" | "confirm" | string;
  email_subject: string | null;
  message_lines: string | null;
  email_body: string | null;
  telegram_body: string | null;
  default_email_subject: string;
  default_message_lines: string;
  default_email_body: string;
  default_telegram_body: string;
  configured: boolean;
};

export type NotificationTemplatePreviewPayload = {
  code: string;
  email_subject?: string | null;
  message_lines?: string | null;
  email_body?: string | null;
  telegram_body?: string | null;
  sample_context?: Record<string, string>;
};

export type NotificationTemplatePreview = {
  code: string;
  title: string;
  email_subject: string;
  email_text: string;
  email_html: string;
  telegram_text: string;
  variables: Record<string, string>;
};

export type NotificationTemplateTestPayload = NotificationTemplatePreviewPayload & {
  test_recipient_email?: string | null;
  telegram_chat_id?: string | null;
  smtp_bz_api_key?: string | null;
  telegram_bot_token?: string | null;
};

export type NotificationTemplateTestResponse = NotificationTemplatePreview & {
  email_sent: boolean;
  telegram_sent: boolean;
};

export type MerchantNotificationSettings = {
  email: string;
  notify_email_enabled: boolean;
  notify_telegram_enabled: boolean;
  telegram_chat_id: string | null;
  telegram_connected: boolean;
};

export type SeoSettings = {
  title: string | null;
  description: string | null;
  keywords: string | null;
  favicon_url: string | null;
  og_image_url: string | null;
  robots: string;
  canonical_url: string | null;
};

export type MerchantNotificationSettingsUpdatePayload = {
  notify_email_enabled: boolean;
  notify_telegram_enabled: boolean;
  telegram_chat_id: string | null;
};

export type TenantBillingPolicy = {
  tenant_id: string;
  custom_markup_percent: string | null;
  custom_turnover_fee_percent: string | null;
  payouts_enabled: boolean;
  requires_manual_payout_review: boolean;
};

export type ProviderEventItem = {
  id: string;
  provider_name: string;
  provider_event_id: string;
  invoice_id: string;
  event_type: string;
  source: string;
  payload_json: Record<string, unknown> | null;
  processed_at: string | null;
  status: string;
  created_at: string;
};

export type RateNetworkItem = {
  network: string;
  ticker: string | null;
  min_deposit: string | null;
  max_deposit: string | null;
  min_deposit_fiat: string | null;
  max_deposit_fiat: string | null;
  min_withdraw: string | null;
  max_withdraw: string | null;
  network_fee: string | null;
  availability: boolean;
  provider_availability: boolean;
  platform_enabled: boolean;
  client_available: boolean;
  availability_reason: string | null;
  acquiring: boolean;
  withdrawal: boolean;
  memo_required: boolean;
};

export type RateItem = {
  currency: string;
  networks: RateNetworkItem[];
};

export type RatesResponse = {
  items: RateItem[];
};

export type PublicPageItem = {
  id: string;
  slug: string;
  title: string;
  content_html: string;
  status: "draft" | "published" | string;
  show_in_header: boolean;
  show_in_footer: boolean;
  header_order: number;
  footer_order: number;
  created_at: string;
  updated_at: string;
};

export type PublicPageNavigationItem = {
  slug: string;
  title: string;
  show_in_header: boolean;
  show_in_footer: boolean;
  header_order: number;
  footer_order: number;
};

export type PublicPageListResponse = {
  items: PublicPageNavigationItem[];
};

export type MerchantSandboxSummary = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  label: string;
  dns_parent_zone: string;
  desired_subdomain: string;
  status: string;
  public_base_url: string | null;
  tenant_name: string;
  created_at: string;
  origin_ipv4: string | null;
  agent_public_id: string | null;
};

export type SandboxPlatformSettings = {
  cloudflare_token_configured: boolean;
  cloudflare_token_masked: string | null;
};

export type MerchantSandboxCreatePayload = {
  label: string;
  dns_parent_zone: string;
  desired_subdomain: string;
};

export type MerchantSandboxCreateResponse = {
  id: string;
  tenant_id: string;
  project_id: string;
  label: string;
  dns_parent_zone: string;
  desired_subdomain: string;
  status: string;
  enrollment_token: string;
  enrollment_expires_at: string;
  api_public_key: string;
  api_secret_key: string;
  owner_email: string;
  owner_password: string;
  public_api_base_url: string;
};

export type AssetAvailabilityPayload = {
  currency: string;
  network: string;
  platform_enabled: boolean;
};

export type AssetAvailabilityResponse = AssetAvailabilityPayload;

function formatValidationDetail(detail: unknown): string | null {
  if (!Array.isArray(detail)) {
    return null;
  }

  const messages = detail
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const typed = item as { loc?: unknown; msg?: unknown };
      const message = typeof typed.msg === "string" ? typed.msg.trim() : "";
      const location = Array.isArray(typed.loc)
        ? typed.loc.map((part) => String(part)).join(".")
        : "";
      if (message && location) {
        return `${location}: ${message}`;
      }
      if (message) {
        return message;
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));

  if (messages.length === 0) {
    return null;
  }

  return messages.join("; ");
}

function extractErrorMessage(payload: unknown): {
  message: string | null;
  detail: unknown;
  code: string | null;
} {
  if (!payload || typeof payload !== "object") {
    return { message: null, detail: null, code: null };
  }

  const record = payload as Record<string, unknown>;
  const detail = record.detail;
  let code: string | null = null;

  if (typeof record.code === "string" && record.code.trim().length > 0) {
    code = record.code;
  }

  if (typeof detail === "string" && detail.trim().length > 0) {
    return { message: detail, detail, code };
  }

  if (detail && typeof detail === "object") {
    const detailRecord = detail as Record<string, unknown>;
    if (
      typeof detailRecord.code === "string" &&
      detailRecord.code.trim().length > 0
    ) {
      code = detailRecord.code;
    }
    if (
      typeof detailRecord.message === "string" &&
      detailRecord.message.trim().length > 0
    ) {
      return { message: detailRecord.message, detail, code };
    }
  }

  const validationMessage = formatValidationDetail(detail);
  if (validationMessage) {
    return { message: validationMessage, detail, code };
  }

  if (typeof record.message === "string" && record.message.trim().length > 0) {
    return { message: record.message, detail, code };
  }

  return { message: null, detail, code };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const csrfToken = getCsrfToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken && { "X-CSRF-Token": csrfToken }),
      ...(init?.headers ?? {}),
    },
  });

  const csrfHeader = response.headers.get("X-CSRF-Token");
  if (csrfHeader) {
    setCsrfToken(csrfHeader);
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    let parsedPayload: unknown = null;
    let rawText: string | null = null;

    if (contentType.includes("application/json")) {
      parsedPayload = await response.json().catch(() => null);
    } else {
      rawText = await response.text().catch(() => null);
      const trimmed = rawText?.trim() ?? "";
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          parsedPayload = JSON.parse(trimmed);
        } catch {
          parsedPayload = null;
        }
      }
    }

    const extracted = extractErrorMessage(parsedPayload);
    const textFallback =
      rawText &&
      rawText.trim().length > 0 &&
      !rawText.trim().startsWith("<!DOCTYPE") &&
      !rawText.trim().startsWith("<html")
        ? rawText.trim().slice(0, 240)
        : null;
    const resolvedMessage =
      extracted.message ?? textFallback ?? `Ошибка запроса (HTTP ${response.status}).`;
    const normalizedError = new Error(resolvedMessage) as Error & {
      status?: number;
      detail?: unknown;
      code?: string;
    };
    normalizedError.status = response.status;
    normalizedError.detail = extracted.detail;
    if (extracted.code) {
      normalizedError.code = extracted.code;
    }
    throw normalizedError;

    /*
    const payloadWithDetail = (await response.json().catch(() => null)) as
      | { detail?: string | { message?: string; code?: string } }
      | null;
    const richDetail = payloadWithDetail?.detail;
    const richMessage =
      typeof richDetail === "string"
        ? richDetail
        : typeof richDetail?.message === "string" && richDetail.message.trim().length > 0
          ? richDetail.message
          : "Ошибка запроса.";
    const richError = new Error(richMessage) as Error & {
      status?: number;
      detail?: unknown;
      code?: string;
    };
    richError.status = response.status;
    richError.detail = richDetail;
    if (
      richDetail &&
      typeof richDetail === "object" &&
      "code" in richDetail &&
      typeof richDetail.code === "string"
    ) {
      richError.code = richDetail.code;
    }
    if (richDetail !== undefined) {
      throw richError;
    }
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail ?? "Ошибка запроса.");
    */
  }
  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json()) as T;
  if (
    data &&
    typeof data === "object" &&
    "csrf_token" in data &&
    typeof (data as { csrf_token: unknown }).csrf_token === "string"
  ) {
    setCsrfToken((data as { csrf_token: string }).csrf_token);
  }
  return data;
}

export function login(
  email: string,
  password: string,
  otp_code?: string,
): Promise<LoginResponse> {
  return request<LoginResponse>("/client/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, otp_code }),
  });
}

export function register(payload: RegistrationPayload): Promise<RegistrationResponse> {
  return request<RegistrationResponse>("/client/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function requestPasswordRecovery(email: string): Promise<PasswordRecoveryResponse> {
  return request<PasswordRecoveryResponse>("/client/auth/recover-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function setPasswordByRecoveryToken(
  token: string,
  password: string,
): Promise<{ status: string; message: string; user_id: string; email: string }> {
  return request<{ status: string; message: string; user_id: string; email: string }>(
    "/client/auth/set-password",
    {
      method: "POST",
      body: JSON.stringify({ token, password }),
    },
  );
}

export function fetchCurrentUser(token: string): Promise<CurrentUser> {
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  return request<CurrentUser>("/client/me", { headers });
}

export function fetchTwoFactorStatus(token: string): Promise<TwoFactorStatus> {
  return request<TwoFactorStatus>("/client/security/2fa/status", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function setupTwoFactor(token: string): Promise<TwoFactorSetup> {
  return request<TwoFactorSetup>("/client/security/2fa/setup", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function enableTwoFactor(token: string, code: string): Promise<TwoFactorStatus> {
  return request<TwoFactorStatus>("/client/security/2fa/enable", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code }),
  });
}

export function disableTwoFactor(
  token: string,
  payload: { password: string; code?: string },
): Promise<TwoFactorStatus> {
  return request<TwoFactorStatus>("/client/security/2fa/disable", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function changeClientPassword(
  token: string,
  payload: { current_password: string; new_password: string },
): Promise<{ status: string; message: string }> {
  return request<{ status: string; message: string }>("/client/security/change-password", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function fetchClientNotificationSettings(
  token: string,
): Promise<MerchantNotificationSettings> {
  return request<MerchantNotificationSettings>("/client/notifications/settings", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function updateClientNotificationSettings(
  token: string,
  payload: MerchantNotificationSettingsUpdatePayload,
): Promise<MerchantNotificationSettings> {
  return request<MerchantNotificationSettings>("/client/notifications/settings", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function fetchOnboardingStatus(token: string): Promise<OnboardingStatus> {
  return request<OnboardingStatus>("/client/onboarding/status", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchProjects(token: string): Promise<ProjectItem[]> {
  return request<ProjectItem[]>("/client/projects", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchApiKeys(token: string): Promise<ApiKeyItem[]> {
  return request<ApiKeyItem[]>("/client/api-keys", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchInvoices(token: string): Promise<InvoiceItem[]> {
  return request<InvoiceItem[]>("/client/invoices", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchClientInvoiceDetail(
  token: string,
  invoiceId: string,
): Promise<InvoiceDetail> {
  return request<InvoiceDetail>(`/client/invoices/${invoiceId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function createInvoice(
  token: string,
  payload: CreateInvoicePayload,
): Promise<InvoiceItem> {
  return request<InvoiceItem>("/client/invoices", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function fetchBalance(token: string): Promise<BalanceResponse> {
  return request<BalanceResponse>("/client/balance", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchClientTransactions(token: string): Promise<TransactionItem[]> {
  return request<TransactionItem[]>("/client/transactions", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchClientPayouts(token: string): Promise<PayoutRequestItem[]> {
  return request<PayoutRequestItem[]>("/client/payouts", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function createClientPayout(
  token: string,
  payload: CreatePayoutPayload,
): Promise<PayoutRequestItem> {
  return request<PayoutRequestItem>("/client/payouts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function fetchClientAccountingSummary(token: string): Promise<AccountingSummary> {
  return request<AccountingSummary>("/client/accounting/summary", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchRates(token: string): Promise<RatesResponse> {
  return request<RatesResponse>("/client/rates", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchCsrfToken(token: string): Promise<{ csrf_token: string }> {
  return request<{ csrf_token: string }>("/admin/security/csrf", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchAdminAssets(token: string): Promise<RatesResponse> {
  return request<RatesResponse>("/admin/assets", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchAdminPublicPages(token: string): Promise<PublicPageItem[]> {
  return request<PublicPageItem[]>("/admin/public-pages", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function createAdminPublicPage(
  token: string,
  payload: Omit<PublicPageItem, "id" | "created_at" | "updated_at">,
): Promise<PublicPageItem> {
  return request<PublicPageItem>("/admin/public-pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function updateAdminPublicPage(
  token: string,
  pageId: string,
  payload: Partial<Omit<PublicPageItem, "id" | "created_at" | "updated_at">>,
): Promise<PublicPageItem> {
  return request<PublicPageItem>(`/admin/public-pages/${pageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function deleteAdminPublicPage(token: string, pageId: string): Promise<void> {
  return request<void>(`/admin/public-pages/${pageId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchPublicPages(status: "published" | "all" = "published"): Promise<PublicPageListResponse> {
  const query = status === "published" ? "?status_filter=published" : "?status_filter=all";
  return request<PublicPageListResponse>(`/client/public-pages${query}`);
}

export function fetchPublicPageBySlug(slug: string): Promise<PublicPageItem> {
  return request<PublicPageItem>(`/client/public-pages/${encodeURIComponent(slug)}`);
}

export function fetchSeoSettings(): Promise<SeoSettings> {
  return request<SeoSettings>("/public/seo");
}

export function updateAdminAssetAvailability(
  token: string,
  payload: AssetAvailabilityPayload,
): Promise<AssetAvailabilityResponse> {
  return request<AssetAvailabilityResponse>("/admin/assets", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function fetchWebhookConfigs(token: string): Promise<WebhookConfigItem[]> {
  return request<WebhookConfigItem[]>("/client/webhooks", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function updateWebhookConfig(
  token: string,
  payload: {
    project_id: string;
    webhook_url?: string;
    webhook_secret?: string;
    return_url_success?: string | null;
    return_url_failed?: string | null;
  },
): Promise<WebhookConfigItem> {
  return request<WebhookConfigItem>("/client/webhooks", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
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
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export type InvoiceWebhookTestResponse = {
  project_id: string;
  invoice_id: string;
  webhook_url: string;
  event_id: string;
  delivered_at: string;
  attempts: number;
  status_code: number;
  response_preview: string | null;
  ok: boolean;
  error: string | null;
};

export function sendInvoiceWebhookTest(
  token: string,
  invoiceId: string,
): Promise<InvoiceWebhookTestResponse> {
  return request<InvoiceWebhookTestResponse>(
    `/client/invoices/${encodeURIComponent(invoiceId)}/webhook-test`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
}

export function syncClientInvoice(token: string, invoiceId: string): Promise<InvoiceDetail> {
  return request<InvoiceDetail>(`/client/invoices/${invoiceId}/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function revokeClientApiKey(token: string, apiKeyId: string): Promise<ApiKeyItem> {
  return request<ApiKeyItem>(`/client/api-keys/${apiKeyId}/revoke`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function regenerateClientApiKey(
  token: string,
  apiKeyId: string,
): Promise<ApiKeyRegenerateResponse> {
  return request<ApiKeyRegenerateResponse>(`/client/api-keys/${apiKeyId}/regenerate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchTenants(token: string): Promise<TenantItem[]> {
  return request<TenantItem[]>("/admin/tenants", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchAdminRoles(token: string): Promise<UserRoleDefinition[]> {
  return request<UserRoleDefinition[]>("/admin/roles", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchAdminUsers(
  token: string,
  opts?: { tenantId?: string | null; scope?: "platform" | "tenant" },
): Promise<AdminUserItem[]> {
  const params = new URLSearchParams();
  if (opts?.tenantId) {
    params.set("tenant_id", opts.tenantId);
  }
  if (opts?.scope) {
    params.set("scope", opts.scope);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  return request<AdminUserItem[]>(`/admin/users${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function createAdminUser(
  token: string,
  payload: AdminUserCreatePayload,
): Promise<AdminUserCreateResponse> {
  return request<AdminUserCreateResponse>("/admin/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
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
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function deleteAdminUser(token: string, userId: string): Promise<void> {
  return request<void>(`/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function createTenant(
  token: string,
  payload: TenantCreatePayload,
): Promise<TenantCreateResponse> {
  return request<TenantCreateResponse>("/admin/tenants", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
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
    headers: {
      Authorization: `Bearer ${token}`,
    },
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
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ review_comment: reviewComment ?? null }),
  });
}

export function fetchTenantDetail(
  token: string,
  tenantId: string,
): Promise<TenantDetailResponse> {
  return request<TenantDetailResponse>(`/admin/tenants/${tenantId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function updateAdminTenant(
  token: string,
  tenantId: string,
  payload: TenantAdminUpdatePayload,
): Promise<TenantDetailResponse> {
  return request<TenantDetailResponse>(`/admin/tenants/${tenantId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function updateAdminProject(
  token: string,
  projectId: string,
  payload: ProjectAdminUpdatePayload,
): Promise<ProjectItem> {
  return request<ProjectItem>(`/admin/projects/${projectId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function deleteAdminTenant(
  token: string,
  tenantId: string,
): Promise<{ status: string; tenant_id: string }> {
  return request<{ status: string; tenant_id: string }>(`/admin/tenants/${tenantId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function resetAdminTenantOwnerPassword(
  token: string,
  tenantId: string,
): Promise<AdminTenantOwnerPasswordResetResponse> {
  return request<AdminTenantOwnerPasswordResetResponse>(
    `/admin/tenants/${tenantId}/owner/reset-password`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
}

export function resetAdminTenantOwnerTwoFactor(
  token: string,
  tenantId: string,
): Promise<TenantOwnerItem> {
  return request<TenantOwnerItem>(`/admin/tenants/${tenantId}/owner/reset-2fa`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchTenantInvoices(token: string, tenantId: string): Promise<InvoiceItem[]> {
  return request<InvoiceItem[]>(`/admin/tenants/${tenantId}/invoices`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchTenantTransactions(
  token: string,
  tenantId: string,
): Promise<TransactionItem[]> {
  return request<TransactionItem[]>(`/admin/tenants/${tenantId}/transactions`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchTenantAccountingSummary(
  token: string,
  tenantId: string,
): Promise<AccountingSummary> {
  return request<AccountingSummary>(`/admin/tenants/${tenantId}/accounting/summary`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchPlatformAccountingSummary(token: string): Promise<AccountingSummary> {
  return request<AccountingSummary>("/admin/accounting/summary", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchPlatformBillingSettings(token: string): Promise<PlatformBillingSettings> {
  return request<PlatformBillingSettings>("/admin/billing/settings", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchPlatformExchangeRate(
  token: string,
  currency: string,
): Promise<ExchangeRateLookup> {
  return request<ExchangeRateLookup>(
    `/admin/billing/exchange-rate/${encodeURIComponent(currency)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
}

export function refreshPlatformExchangeRate(
  token: string,
): Promise<ExchangeRateRefresh> {
  return request<ExchangeRateRefresh>(
    "/admin/billing/exchange-rates/refresh",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
}

export function updatePlatformBillingSettings(
  token: string,
  payload: PlatformBillingSettings,
): Promise<PlatformBillingSettings> {
  return request<PlatformBillingSettings>("/admin/billing/settings", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function previewNotificationTemplate(
  token: string,
  payload: NotificationTemplatePreviewPayload,
): Promise<NotificationTemplatePreview> {
  return request<NotificationTemplatePreview>("/admin/billing/notifications/preview", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function sendNotificationTemplateTest(
  token: string,
  payload: NotificationTemplateTestPayload,
): Promise<NotificationTemplateTestResponse> {
  return request<NotificationTemplateTestResponse>("/admin/billing/notifications/test", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function sendPlatformSmtpBzTest(
  token: string,
  payload: SmtpBzTestPayload,
): Promise<SmtpBzTestResponse> {
  return request<SmtpBzTestResponse>("/admin/billing/smtp/test", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function inspectPlatformTelegramBot(
  token: string,
  payload: TelegramBotInspectPayload,
): Promise<TelegramBotIdentity> {
  return request<TelegramBotIdentity>("/admin/billing/telegram/bot", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function sendPlatformTelegramTest(
  token: string,
  payload: TelegramAdminTestPayload,
): Promise<TelegramAdminTestResponse> {
  return request<TelegramAdminTestResponse>("/admin/billing/telegram/test", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function provisionOpsTelegramTopics(
  token: string,
  payload: OpsTelegramProvisionPayload = {},
): Promise<OpsTelegramProvisionResponse> {
  return request<OpsTelegramProvisionResponse>("/admin/billing/ops-telegram/provision", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function sendOpsTelegramTopicTest(
  token: string,
  payload: OpsTelegramTopicTestPayload,
): Promise<OpsTelegramTopicTestResponse> {
  return request<OpsTelegramTopicTestResponse>("/admin/billing/ops-telegram/test", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function fetchTenantBillingPolicy(
  token: string,
  tenantId: string,
): Promise<TenantBillingPolicy> {
  return request<TenantBillingPolicy>(`/admin/tenants/${tenantId}/billing-policy`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function updateTenantBillingPolicy(
  token: string,
  tenantId: string,
  payload: Omit<TenantBillingPolicy, "tenant_id">,
): Promise<TenantBillingPolicy> {
  return request<TenantBillingPolicy>(`/admin/tenants/${tenantId}/billing-policy`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function revokeAdminApiKey(token: string, apiKeyId: string): Promise<ApiKeyItem> {
  return request<ApiKeyItem>(`/admin/api-keys/${apiKeyId}/revoke`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function regenerateAdminApiKey(
  token: string,
  apiKeyId: string,
): Promise<ApiKeyRegenerateResponse> {
  return request<ApiKeyRegenerateResponse>(`/admin/api-keys/${apiKeyId}/regenerate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchAdminInvoices(token: string): Promise<InvoiceItem[]> {
  return request<InvoiceItem[]>("/admin/invoices", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchAdminTransactions(token: string): Promise<TransactionItem[]> {
  return request<TransactionItem[]>("/admin/transactions", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchAdminPayouts(token: string): Promise<PayoutRequestItem[]> {
  return request<PayoutRequestItem[]>("/admin/payouts", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchTenantPayouts(
  token: string,
  tenantId: string,
): Promise<PayoutRequestItem[]> {
  return request<PayoutRequestItem[]>(`/admin/tenants/${tenantId}/payouts`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function reviewAdminPayout(
  token: string,
  payoutId: string,
  payload: ReviewPayoutPayload,
): Promise<PayoutRequestItem> {
  return request<PayoutRequestItem>(`/admin/payouts/${payoutId}/review`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function fetchAdminEvents(
  token: string,
  params?: { limit?: number; source?: string; event_type?: string },
): Promise<ProviderEventItem[]> {
  const search = new URLSearchParams();
  if (params?.limit) {
    search.set("limit", String(params.limit));
  }
  if (params?.source) {
    search.set("source", params.source);
  }
  if (params?.event_type) {
    search.set("event_type", params.event_type);
  }
  const query = search.toString();
  return request<ProviderEventItem[]>(`/admin/events${query ? `?${query}` : ""}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchInvoiceEvents(
  token: string,
  invoiceId: string,
): Promise<ProviderEventItem[]> {
  return request<ProviderEventItem[]>(`/admin/invoices/${invoiceId}/events`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchAdminInvoiceDetail(
  token: string,
  invoiceId: string,
): Promise<InvoiceAdminDetail> {
  return request<InvoiceAdminDetail>(`/admin/invoices/${invoiceId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
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
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status, tx_hash: txHash ?? null }),
  });
}

export function syncAdminInvoice(
  token: string,
  invoiceId: string,
): Promise<InvoiceAdminDetail> {
  return request<InvoiceAdminDetail>(`/admin/invoices/${invoiceId}/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function repairAdminInvoiceSettlement(
  token: string,
  invoiceId: string,
): Promise<InvoiceAdminDetail> {
  return request<InvoiceAdminDetail>(`/admin/invoices/${invoiceId}/repair-settlement`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function fetchSandboxPlatformSettings(token: string): Promise<SandboxPlatformSettings> {
  return request<SandboxPlatformSettings>("/admin/sandbox/settings", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function updateSandboxPlatformSettings(
  token: string,
  payload: { cloudflare_api_token?: string | null },
): Promise<SandboxPlatformSettings> {
  return request<SandboxPlatformSettings>("/admin/sandbox/settings", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function fetchMerchantSandboxes(token: string): Promise<MerchantSandboxSummary[]> {
  return request<MerchantSandboxSummary[]>("/admin/sandbox", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function createMerchantSandbox(
  token: string,
  payload: MerchantSandboxCreatePayload,
): Promise<MerchantSandboxCreateResponse> {
  return request<MerchantSandboxCreateResponse>("/admin/sandbox", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function provisionMerchantSandboxDns(
  token: string,
  sandboxId: string,
  payload: { ipv4: string; proxied?: boolean },
): Promise<MerchantSandboxSummary> {
  return request<MerchantSandboxSummary>(
    `/admin/sandbox/${encodeURIComponent(sandboxId)}/provision-dns`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ipv4: payload.ipv4, proxied: payload.proxied ?? true }),
    },
  );
}

export function destroyMerchantSandbox(token: string, sandboxId: string): Promise<void> {
  return request<void>(`/admin/sandbox/${encodeURIComponent(sandboxId)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

import { resolveApiBaseUrl } from "../config/apiBase";
import { getCsrfToken, setCsrfToken } from "../storage";

const API_BASE_URL = resolveApiBaseUrl();

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
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

export type ProjectItem = {
  id: string;
  tenant_id: string;
  name: string;
  domain: string;
  description: string | null;
  webhook_url: string | null;
  has_webhook_secret: boolean;
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

/** Ответ POST /client/invoices/:id/webhook-test — тестовый webhook по инвойсу без смены статуса. */
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
  payment_address: string;
  qr_url: string | null;
  status: string;
  expires_at: string;
  created_at: string;
};

export type InvoiceAdminDetail = InvoiceItem & {
  tenant_id: string;
  paid_at: string | null;
  confirmed_at: string | null;
  metadata_json: Record<string, unknown> | null;
  raw_provider_payload_json: Record<string, unknown> | null;
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

export type BalanceResponse = {
  currency: string;
  amount: string;
  available_amount: string;
  locked_amount: string;
  total_amount: string;
};

export type TransactionItem = {
  id: string;
  tenant_id: string;
  project_id: string;
  invoice_id: string;
  gross_amount: string;
  provider_fee: string;
  platform_fee: string;
  turnover_fee: string;
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
  email_body: string | null;
  telegram_body: string | null;
};

export type PlatformBillingSettings = {
  provider_fee_percent: string;
  default_markup_percent: string;
  default_turnover_fee_percent: string;
  /** Мин. наценка в USDT при депозите в диапазоне USDT-эквивалента [low, high]. */
  platform_markup_min_usdt: string;
  platform_markup_min_band_usdt_low: string;
  platform_markup_min_band_usdt_high: string;
  exchange_rate_markup_percent: string;
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

export type MerchantNotificationSettings = {
  email: string;
  notify_email_enabled: boolean;
  notify_telegram_enabled: boolean;
  telegram_chat_id: string | null;
  telegram_connected: boolean;
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

export type AssetAvailabilityPayload = {
  currency: string;
  network: string;
  platform_enabled: boolean;
};

export type AssetAvailabilityResponse = AssetAvailabilityPayload;

export type PublicPageItem = {
  id: string;
  slug: string;
  title: string;
  content_html: string;
  status: string;
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

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
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

export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export type SeoSettings = {
  title: string | null;
  description: string | null;
  keywords: string | null;
  favicon_url: string | null;
  og_image_url: string | null;
  robots: string;
  canonical_url: string | null;
};

export function fetchSeoSettings(): Promise<SeoSettings> {
  return request<SeoSettings>("/public/seo", {});
}

import { request, authHeaders } from "./base";

export type PartnerApplyPayload = {
  email: string;
  password: string;
  full_name: string;
  display_name: string;
  contact_telegram?: string;
  payout_address?: string;
  payout_network?: string;
};

export type PartnerApplyResponse = {
  partner_id: string;
  user_id: string;
  status: string;
  referral_code: string;
  message: string;
};

export type PartnerDashboard = {
  partner_id: string;
  user_id: string;
  email: string;
  full_name: string;
  display_name: string;
  contact_telegram: string | null;
  status: string;
  referral_code: string;
  referral_link_path: string;
  commission_percent: number | string;
  payout_address: string | null;
  payout_network: string;
  review_comment: string | null;
  hold_days: number;
  min_payout_usdt: number | string;
  cookie_days: number;
  pending_hold_usdt: number | string;
  available_usdt: number | string;
  paid_usdt: number | string;
  locked_payout_usdt: number | string;
  clicks: number;
  registrations: number;
  approved_merchants: number;
  merchants_with_volume: number;
};

export type PartnerMerchantRow = {
  tenant_id: string;
  tenant_name: string;
  tenant_status: string;
  created_at: string;
  platform_fee_usdt: number | string;
  commission_usdt: number | string;
};

export type PartnerCommissionRow = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  invoice_id: string;
  platform_fee_amount: number | string;
  commission_percent: number | string;
  commission_amount: number | string;
  currency: string;
  status: string;
  available_at: string;
  created_at: string;
};

export type PartnerPayoutRow = {
  id: string;
  amount_requested: number | string;
  amount_approved: number | string | null;
  destination_address: string;
  network: string;
  currency: string;
  status: string;
  review_comment: string | null;
  created_at: string;
  processed_at: string | null;
};

export type AffiliateProgramConfig = {
  program_enabled: boolean;
  public_apply_enabled: boolean;
  auto_approve_partners: boolean;
  partner_cabinet_when_pending: boolean;
  commission_percent: number | string;
  commission_override_allowed: boolean;
  commission_override_min_percent: number | string;
  commission_override_max_percent: number | string;
  attribution_mode: "lifetime" | "fixed_days" | string;
  attribution_days: number;
  cookie_days: number;
  click_mode: "last_click" | "first_click" | string;
  freeze_attribution_after_tenant_approve: boolean;
  track_clicks_from_pending_partners: boolean;
  require_approved_partner_for_attribution: boolean;
  hold_days: number;
  accrue_only_approved_partners: boolean;
  accrue_only_approved_tenants: boolean;
  min_platform_fee_to_accrue_usdt: number | string;
  payouts_enabled: boolean;
  min_payout_usdt: number | string;
  default_payout_network: string;
  allowed_payout_networks: string[];
  require_payout_address_on_apply: boolean;
  require_payout_address_before_request: boolean;
  block_self_referral_email: boolean;
  block_same_email_domain: boolean;
  self_referral_free_domains: string[];
  referral_code_length: number;
  show_merchant_names_to_partners: boolean;
  show_funnel_clicks_to_partners: boolean;
  cpa_enabled: boolean;
  cpa_amount_usdt: number | string;
  cpa_trigger: "approved" | "first_volume" | string;
};

export type AffiliateSettings = {
  affiliate_commission_percent: number | string;
  affiliate_hold_days: number;
  affiliate_min_payout_usdt: number | string;
  affiliate_cookie_days: number;
  config: AffiliateProgramConfig;
};

export type PublicAffiliateConfig = {
  program_enabled: boolean;
  public_apply_enabled: boolean;
  cookie_days: number;
  click_mode: string;
  default_payout_network: string;
  allowed_payout_networks: string[];
  require_payout_address_on_apply: boolean;
  commission_percent: number | string;
  hold_days: number;
  min_payout_usdt: number | string;
  attribution_mode: string;
  attribution_days: number;
};

export const DEFAULT_AFFILIATE_CONFIG: AffiliateProgramConfig = {
  program_enabled: true,
  public_apply_enabled: true,
  auto_approve_partners: false,
  partner_cabinet_when_pending: true,
  commission_percent: 25,
  commission_override_allowed: true,
  commission_override_min_percent: 0,
  commission_override_max_percent: 100,
  attribution_mode: "lifetime",
  attribution_days: 365,
  cookie_days: 60,
  click_mode: "last_click",
  freeze_attribution_after_tenant_approve: true,
  track_clicks_from_pending_partners: true,
  require_approved_partner_for_attribution: true,
  hold_days: 14,
  accrue_only_approved_partners: true,
  accrue_only_approved_tenants: true,
  min_platform_fee_to_accrue_usdt: 0,
  payouts_enabled: true,
  min_payout_usdt: 50,
  default_payout_network: "TRC20",
  allowed_payout_networks: ["TRC20", "ERC20", "BEP20"],
  require_payout_address_on_apply: false,
  require_payout_address_before_request: true,
  block_self_referral_email: true,
  block_same_email_domain: true,
  self_referral_free_domains: [
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "icloud.com",
    "mail.ru",
    "yandex.ru",
    "yandex.com",
    "proton.me",
    "protonmail.com",
  ],
  referral_code_length: 8,
  show_merchant_names_to_partners: true,
  show_funnel_clicks_to_partners: true,
  cpa_enabled: false,
  cpa_amount_usdt: 0,
  cpa_trigger: "first_volume",
};

export type AdminPartnerListItem = {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  display_name: string;
  status: string;
  referral_code: string;
  commission_percent: number | string | null;
  effective_commission_percent: number | string;
  contact_telegram: string | null;
  payout_address: string | null;
  payout_network: string;
  pending_hold_usdt: number | string;
  available_usdt: number | string;
  paid_usdt: number | string;
  registrations: number;
  created_at: string;
  approved_at: string | null;
};

export type AdminPartnerDetail = AdminPartnerListItem & {
  review_comment: string | null;
  notes: string | null;
  merchants: PartnerMerchantRow[];
  recent_commissions: PartnerCommissionRow[];
  payouts: PartnerPayoutRow[];
};

const REF_STORAGE_KEY = "affiliate_ref_code";
const REF_STORED_AT_KEY = "affiliate_ref_stored_at";

export function storeAffiliateRef(
  code: string,
  clickMode: "last_click" | "first_click" | string = "last_click",
): void {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return;
  if (clickMode === "first_click") {
    const existing = localStorage.getItem(REF_STORAGE_KEY);
    if (existing) return;
  }
  localStorage.setItem(REF_STORAGE_KEY, normalized);
  localStorage.setItem(REF_STORED_AT_KEY, String(Date.now()));
}

export function fetchPublicAffiliateConfig(): Promise<PublicAffiliateConfig> {
  return request<PublicAffiliateConfig>("/public/affiliate", {});
}


export function readAffiliateRef(cookieDays = 60): string | null {
  const code = localStorage.getItem(REF_STORAGE_KEY);
  const storedAt = Number(localStorage.getItem(REF_STORED_AT_KEY) || "0");
  if (!code || !storedAt) return null;
  const maxAgeMs = cookieDays * 24 * 60 * 60 * 1000;
  if (Date.now() - storedAt > maxAgeMs) {
    localStorage.removeItem(REF_STORAGE_KEY);
    localStorage.removeItem(REF_STORED_AT_KEY);
    return null;
  }
  return code;
}

export function applyAsPartner(payload: PartnerApplyPayload): Promise<PartnerApplyResponse> {
  return request<PartnerApplyResponse>("/partner/auth/apply", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function trackAffiliateClick(referralCode: string, landingPath?: string): Promise<void> {
  return request<void>("/partner/referral/click", {
    method: "POST",
    body: JSON.stringify({
      referral_code: referralCode,
      landing_path: landingPath ?? window.location.pathname,
    }),
  });
}

export function fetchPartnerDashboard(token: string): Promise<PartnerDashboard> {
  return request<PartnerDashboard>("/partner/dashboard", {
    headers: authHeaders(token),
  });
}

export function updatePartnerProfile(
  token: string,
  payload: {
    display_name?: string;
    contact_telegram?: string;
    payout_address?: string;
    payout_network?: string;
  },
): Promise<PartnerDashboard> {
  return request<PartnerDashboard>("/partner/profile", {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function fetchPartnerMerchants(token: string): Promise<PartnerMerchantRow[]> {
  return request<PartnerMerchantRow[]>("/partner/merchants", {
    headers: authHeaders(token),
  });
}

export function fetchPartnerCommissions(token: string): Promise<PartnerCommissionRow[]> {
  return request<PartnerCommissionRow[]>("/partner/commissions", {
    headers: authHeaders(token),
  });
}

export function fetchPartnerPayouts(token: string): Promise<PartnerPayoutRow[]> {
  return request<PartnerPayoutRow[]>("/partner/payouts", {
    headers: authHeaders(token),
  });
}

export function createPartnerPayout(
  token: string,
  payload: { amount?: number; destination_address?: string; network?: string },
): Promise<PartnerPayoutRow> {
  return request<PartnerPayoutRow>("/partner/payouts", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function fetchAdminPartners(token: string): Promise<AdminPartnerListItem[]> {
  return request<AdminPartnerListItem[]>("/admin/partners", {
    headers: authHeaders(token),
  });
}

export function fetchAdminPartnerDetail(token: string, partnerId: string): Promise<AdminPartnerDetail> {
  return request<AdminPartnerDetail>(`/admin/partners/${partnerId}`, {
    headers: authHeaders(token),
  });
}

export function updateAdminPartner(
  token: string,
  partnerId: string,
  payload: {
    status?: string;
    commission_percent?: number | null;
    clear_commission_override?: boolean;
    review_comment?: string;
    notes?: string;
  },
): Promise<AdminPartnerListItem> {
  return request<AdminPartnerListItem>(`/admin/partners/${partnerId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function fetchAdminPartnerPayouts(token: string): Promise<PartnerPayoutRow[]> {
  return request<PartnerPayoutRow[]>("/admin/partners/payouts", {
    headers: authHeaders(token),
  });
}

export function reviewAdminPartnerPayout(
  token: string,
  payoutId: string,
  payload: { action: "approve" | "reject"; review_comment?: string; external_reference?: string },
): Promise<PartnerPayoutRow> {
  return request<PartnerPayoutRow>(`/admin/partners/payouts/${payoutId}/review`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function fetchAffiliateSettings(token: string): Promise<AffiliateSettings> {
  return request<AffiliateSettings>("/admin/partners/settings", {
    headers: authHeaders(token),
  });
}

export function updateAffiliateSettings(
  token: string,
  payload: { config: AffiliateProgramConfig },
): Promise<AffiliateSettings> {
  return request<AffiliateSettings>("/admin/partners/settings", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

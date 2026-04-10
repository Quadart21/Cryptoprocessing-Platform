import type {
  CreateInvoicePayload,
  CreatePayoutPayload,
  RegistrationPayload,
  TenantCreatePayload,
} from "../api";

export function createMerchantOrderId(): string {
  return `order-${Date.now()}`;
}

export const initialTenantForm: TenantCreatePayload = {
  company_name: "",
  owner_email: "",
  owner_full_name: "",
  domain: "",
  timezone: "Europe/Amsterdam",
  base_currency: "USD",
  plan: "default",
};

export const initialRegistrationForm: RegistrationPayload = {
  company_name: "",
  owner_full_name: "",
  owner_email: "",
  password: "",
  domain: "",
  project_description: "",
  timezone: "Europe/Amsterdam",
  base_currency: "USD",
  plan: "default",
};

export const initialInvoiceForm: CreateInvoicePayload = {
  project_id: "",
  merchant_order_id: createMerchantOrderId(),
  amount_fiat: 100,
  fiat_currency: "USD",
  crypto_currency: "USDT",
  network: "TRC20",
  metadata: { source: "frontend" },
};

export const initialWebhookForm = {
  project_id: "",
  webhook_url: "",
  webhook_secret: "",
};

export const initialPayoutForm: CreatePayoutPayload = {
  project_id: "",
  destination_address: "",
  amount: 0,
  note: "",
};

export const initialLoginForm = {
  email: "",
  password: "",
  otp_code: "",
};

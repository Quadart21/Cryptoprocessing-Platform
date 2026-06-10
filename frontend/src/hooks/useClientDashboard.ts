import type {
  ApiKeyItem,
  CreateInvoicePayload,
  RateNetworkItem,
  RateItem,
  WebhookConfigItem,
} from "../api";
import { resolveClientApiBaseUrl } from "../config/apiBase";
import { useTranslation } from "../i18n";

type UseClientDashboardParams = {
  rates: RateItem[];
  invoiceForm: CreateInvoicePayload;
  apiKeys: ApiKeyItem[];
  webhookConfigs: WebhookConfigItem[];
  webhookProjectId: string;
};

type UseClientDashboardResult = {
  selectedRate: RateItem | null;
  availableNetworks: RateNetworkItem[];
  selectedNetwork: RateNetworkItem | null;
  activeApiKey: ApiKeyItem | null;
  activeWebhook: WebhookConfigItem | null;
  apiBaseUrl: string;
  integrationCurl: string;
};

export function useClientDashboard({
  rates,
  invoiceForm,
  apiKeys,
  webhookConfigs,
  webhookProjectId,
}: UseClientDashboardParams): UseClientDashboardResult {
  const { t } = useTranslation();

  const selectedRate =
    rates.find((item) => item.currency === invoiceForm.crypto_currency) ?? rates[0] ?? null;
  const availableNetworks = selectedRate
    ? selectedRate.networks.filter((item) => item.availability && item.acquiring)
    : [];
  const selectedNetwork =
    availableNetworks.find((item) => item.network === invoiceForm.network) ??
    availableNetworks[0] ??
    null;
  const activeApiKey =
    apiKeys.find((item) => item.status === "active") ??
    apiKeys.find((item) => item.status !== "revoked") ??
    apiKeys[0] ??
    null;
  const activeWebhook =
    webhookConfigs.find((item) => item.project_id === webhookProjectId) ??
    webhookConfigs[0] ??
    null;
  const apiBaseUrl = resolveClientApiBaseUrl();
  const integrationCurl = activeApiKey
    ? `curl -X POST "${apiBaseUrl}/invoices" \\
  -H "X-API-Key: ${activeApiKey.public_key}" \\
  -H "X-API-Secret: <secret_key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "${invoiceForm.project_id || "<project_id>"}",
    "merchant_order_id": "test-order-001",
    "amount_fiat": 100,
    "fiat_currency": "USD",
    "crypto_currency": "${invoiceForm.crypto_currency}",
    "network": "${invoiceForm.network}",
    "metadata": {
      "source": "merchant-test"
    }
  }'`
    : t("merchant.integration.scenarios.rates.noKey");

  return {
    selectedRate,
    availableNetworks,
    selectedNetwork,
    activeApiKey,
    activeWebhook,
    apiBaseUrl,
    integrationCurl,
  };
}

import { ApiDocumentationPanel } from "../screens/client/ApiDocumentationPanel";
import { resolveClientApiBaseUrl } from "../config/apiBase";

export function DocsMerchantApiPage() {
  const apiBaseUrl = resolveClientApiBaseUrl();
  const integrationCurl = `curl -X POST "${apiBaseUrl}/invoices" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "<project_id>",
    "merchant_order_id": "order_1001",
    "amount_fiat": 100,
    "fiat_currency": "USD",
    "crypto_currency": "USDT",
    "network": "TRC20"
  }'`;

  return (
    <div className="docs-api-page">
      <ApiDocumentationPanel
        apiBaseUrl={apiBaseUrl}
        activeApiKeyPublic={null}
        selectedRoute="USDT / TRC20"
        activeWebhookUrl="https://merchant.example.com/webhooks/norencash"
        integrationCurl={integrationCurl}
      />
    </div>
  );
}

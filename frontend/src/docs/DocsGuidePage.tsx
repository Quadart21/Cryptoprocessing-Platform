import { ApiDocumentationPanel } from "../screens/client/ApiDocumentationPanel";
import { resolveClientApiBaseUrl } from "../config/apiBase";
import type { DocsSectionKey } from "../types/docsSection";
import { DocsPager } from "./DocsPager";
import { useDocsPageMeta } from "./useDocsNav";

type DocsGuidePageProps = {
  section: DocsSectionKey;
};

function buildIntegrationCurl(apiBaseUrl: string) {
  return `curl -X POST "${apiBaseUrl}/invoices" \\
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
}

export function DocsGuidePage({ section }: DocsGuidePageProps) {
  const pageMeta = useDocsPageMeta();
  const meta = pageMeta[section];
  const apiBaseUrl = resolveClientApiBaseUrl();

  return (
    <article className="docs-guide docs-api-page">
      <header className="docs-page-head">
        <p className="docs-page-eyebrow">{meta.eyebrow}</p>
        <h1>{meta.title}</h1>
        <p className="docs-page-lead">{meta.lead}</p>
      </header>

      <div className="docs-guide-body">
        <ApiDocumentationPanel
          activeApiKeyPublic={null}
          activeWebhookUrl="https://merchant.example.com/webhooks/norencash"
          apiBaseUrl={apiBaseUrl}
          docsSection={section}
          integrationCurl={buildIntegrationCurl(apiBaseUrl)}
          presentation="docs"
          selectedRoute="USDT / TRC20"
        />
      </div>

      <DocsPager currentPath={`/${section}`} />
    </article>
  );
}

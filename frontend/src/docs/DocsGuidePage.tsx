import { Link } from "react-router-dom";

import { ApiDocumentationPanel } from "../screens/client/ApiDocumentationPanel";
import { resolveClientApiBaseUrl } from "../config/apiBase";
import { DocsApiToc } from "./DocsApiToc";
import type { DocsSectionKey } from "../types/docsSection";
import { DOCS_GUIDE_ORDER, DOCS_PAGE_META } from "./docsNav";

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
  const meta = DOCS_PAGE_META[section];
  const apiBaseUrl = resolveClientApiBaseUrl();
  const orderIndex = DOCS_GUIDE_ORDER.indexOf(section);
  const prev = orderIndex > 0 ? DOCS_GUIDE_ORDER[orderIndex - 1] : null;
  const next = orderIndex >= 0 && orderIndex < DOCS_GUIDE_ORDER.length - 1 ? DOCS_GUIDE_ORDER[orderIndex + 1] : null;

  return (
    <article className="docs-guide">
      <header className="docs-page-head">
        <p className="docs-page-eyebrow">{meta.eyebrow}</p>
        <h1>{meta.title}</h1>
        <p className="docs-page-lead">{meta.lead}</p>
      </header>

      <div className={`docs-guide-body${section === "reference" ? " docs-guide-body--reference" : ""}`}>
        <ApiDocumentationPanel
          activeApiKeyPublic={null}
          activeWebhookUrl="https://merchant.example.com/webhooks/norencash"
          apiBaseUrl={apiBaseUrl}
          docsSection={section}
          integrationCurl={buildIntegrationCurl(apiBaseUrl)}
          presentation="docs"
          selectedRoute="USDT / TRC20"
        />
        {section === "reference" ? <DocsApiToc variant="inline" /> : null}
      </div>

      <nav className="docs-pager" aria-label="Section navigation">
        {prev ? (
          <Link className="docs-pager-link docs-pager-link--prev" to={`/${prev}`}>
            <span>Previous</span>
            <strong>{DOCS_PAGE_META[prev].title}</strong>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link className="docs-pager-link docs-pager-link--next" to={`/${next}`}>
            <span>Next</span>
            <strong>{DOCS_PAGE_META[next].title}</strong>
          </Link>
        ) : null}
      </nav>
    </article>
  );
}

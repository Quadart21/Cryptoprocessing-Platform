import { Link } from "react-router-dom";

import { useApiTranslation } from "../i18n";
import { DOCS_GUIDE_ORDER, DOCS_PAGE_META } from "./docsNav";
import { IntegrationModulesPanel } from "./IntegrationModulesPanel";

export function DocsIntegrationsPage() {
  const { t, ta } = useApiTranslation();
  const steps = ta<string>("merchant.apiDocs.integrations.steps");
  const prev = "webhooks";
  const next = "reference";

  return (
    <article className="docs-guide">
      <header className="docs-page-head">
        <p className="docs-page-eyebrow">{t("merchant.apiDocs.integrations.eyebrow")}</p>
        <h1>{t("merchant.apiDocs.integrations.title")}</h1>
        <p className="docs-page-lead">{t("merchant.apiDocs.integrations.lead")}</p>
      </header>

      <section className="docs-intro-section">
        <div className="docs-section-head">
          <p>{t("merchant.apiDocs.integrations.flowLabel")}</p>
          <h2>{t("merchant.apiDocs.integrations.flowTitle")}</h2>
        </div>
        <ol className="docs-integration-steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <IntegrationModulesPanel variant="full" />

      <nav className="docs-pager" aria-label="Section navigation">
        <Link className="docs-pager-link docs-pager-link--prev" to={`/${prev}`}>
          <span>{t("merchant.apiDocs.integrations.pagerPrevious")}</span>
          <strong>{DOCS_PAGE_META[prev].title}</strong>
        </Link>
        <Link className="docs-pager-link docs-pager-link--next" to={`/${next}`}>
          <span>{t("merchant.apiDocs.integrations.pagerNext")}</span>
          <strong>{DOCS_PAGE_META[next].title}</strong>
        </Link>
      </nav>
    </article>
  );
}

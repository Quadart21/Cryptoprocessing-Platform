import { Link } from "react-router-dom";

import { useTranslation } from "../i18n";
import { IntegrationModulesPanel } from "./IntegrationModulesPanel";
import { useDocsPageMeta } from "./useDocsNav";

export function DocsIntegrationsPage() {
  const { t, ta } = useTranslation();
  const pageMeta = useDocsPageMeta();
  const steps = ta<string>("merchant.apiDocs.integrations.steps");
  const prev = "webhooks" as const;
  const next = "reference" as const;

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

      <IntegrationModulesPanel hideHeader variant="full" />

      <nav className="docs-pager" aria-label={t("docsSite.pagerAria")}>
        <Link className="docs-pager-link docs-pager-link--prev" to={`/${prev}`}>
          <span>{t("docsSite.pagerPrevious")}</span>
          <strong>{pageMeta[prev].title}</strong>
        </Link>
        <Link className="docs-pager-link docs-pager-link--next" to={`/${next}`}>
          <span>{t("docsSite.pagerNext")}</span>
          <strong>{pageMeta[next].title}</strong>
        </Link>
      </nav>
    </article>
  );
}

import { useTranslation } from "../i18n";
import { DocsPager } from "./DocsPager";
import { IntegrationModulesPanel } from "./IntegrationModulesPanel";

export function DocsIntegrationsPage() {
  const { t, ta } = useTranslation();
  const steps = ta<string>("merchant.apiDocs.integrations.steps");

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

      <DocsPager currentPath="/integrations" />
    </article>
  );
}

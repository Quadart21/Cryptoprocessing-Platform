import { Link, Navigate, useParams } from "react-router-dom";

import { useTranslation } from "../i18n";
import {
  INTEGRATION_MODULES,
  type IntegrationModuleId,
  integrationDownloadUrl,
  integrationGithubTreeUrl,
} from "./integrationDownloads";

const MODULE_IDS = new Set(INTEGRATION_MODULES.map((module) => module.id));

function isModuleId(value: string | undefined): value is IntegrationModuleId {
  return Boolean(value && MODULE_IDS.has(value as IntegrationModuleId));
}

export function DocsIntegrationModulePage() {
  const { moduleId } = useParams();
  const { t, ta } = useTranslation();

  if (!isModuleId(moduleId)) {
    return <Navigate replace to="/integrations" />;
  }

  const module = INTEGRATION_MODULES.find((item) => item.id === moduleId)!;
  const steps = ta<string>(`merchant.apiDocs.integrations.moduleGuides.${moduleId}.steps`);
  const downloadUrl = integrationDownloadUrl(module.downloadFile);
  const sourceUrl = integrationGithubTreeUrl(module.githubPath);

  return (
    <article className="docs-guide docs-integration-module">
      <header className="docs-page-head">
        <p className="docs-page-eyebrow">{t(`merchant.apiDocs.integrations.modules.${moduleId}.subtitle`)}</p>
        <h1>{t(`merchant.apiDocs.integrations.modules.${moduleId}.title`)}</h1>
        <p className="docs-page-lead">{t(`merchant.apiDocs.integrations.modules.${moduleId}.body`)}</p>
      </header>

      <section className="docs-intro-section">
        <div className="docs-integration-module-meta">
          <div>
            <span>{t("merchant.apiDocs.integrations.orderPrefix")}</span>
            <code>{module.orderPrefix}</code>
          </div>
          <div>
            <span>{t("merchant.apiDocs.integrations.requirements")}</span>
            <strong>{t(`merchant.apiDocs.integrations.requirementsList.${module.requirementsKey}`)}</strong>
          </div>
        </div>

        <div className="docs-integration-actions docs-integration-module-actions">
          <a className="docs-site-button docs-site-button-primary" href={downloadUrl} download>
            {t("merchant.apiDocs.integrations.download")}
          </a>
          <a className="docs-site-button docs-site-button-ghost" href={sourceUrl} rel="noreferrer" target="_blank">
            {t("merchant.apiDocs.integrations.viewSource")}
          </a>
        </div>
      </section>

      <section className="docs-intro-section">
        <div className="docs-section-head">
          <p>{t("merchant.apiDocs.integrations.moduleGuideLabel")}</p>
          <h2>{t("merchant.apiDocs.integrations.moduleGuideTitle")}</h2>
        </div>
        <ol className="docs-integration-steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <nav className="docs-pager" aria-label={t("docsSite.pagerAria")}>
        <Link className="docs-pager-link docs-pager-link--prev" to="/integrations">
          <span>{t("docsSite.pagerPrevious")}</span>
          <strong>{t("merchant.apiDocs.integrations.title")}</strong>
        </Link>
        <Link className="docs-pager-link docs-pager-link--next" to="/reference">
          <span>{t("docsSite.pagerNext")}</span>
          <strong>{t("docsSite.pages.reference.title")}</strong>
        </Link>
      </nav>
    </article>
  );
}

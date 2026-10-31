import { Link } from "react-router-dom";

import { useTranslation } from "../i18n";
import { resolveDocsSiteUrl } from "../config/siteHost";
import {
  INTEGRATION_MODULES,
  INTEGRATIONS_BUNDLE_FILE,
  integrationDownloadUrl,
} from "./integrationDownloads";

type IntegrationModulesPanelProps = {
  variant?: "full" | "compact";
  /** When true, omit the section title (page already has its own header). */
  hideHeader?: boolean;
  /** @deprecated Always follows UI locale. Kept for call-site compatibility. */
  followUiLocale?: boolean;
};

export function IntegrationModulesPanel({
  variant = "full",
  hideHeader = false,
}: IntegrationModulesPanelProps) {
  const { t } = useTranslation();
  const compact = variant === "compact";

  return (
    <div className={`docs-integration-panel${compact ? " docs-integration-panel--compact" : ""}`}>
      {!hideHeader && compact ? (
        <header className="api-docs-section-head">
          <p className="eyebrow">{t("merchant.apiDocs.integrations.eyebrow")}</p>
          <h3>{t("merchant.apiDocs.integrations.title")}</h3>
          <p className="muted-text">{t("merchant.apiDocs.integrations.compactLead")}</p>
          <a className="ghost-button docs-integration-full-link" href={resolveDocsSiteUrl("/integrations")}>
            {t("merchant.apiDocs.integrations.openFullGuide")}
          </a>
        </header>
      ) : null}

      {!hideHeader && !compact ? (
        <header className="api-docs-section-head">
          <p className="eyebrow">{t("merchant.apiDocs.integrations.eyebrow")}</p>
          <h3>{t("merchant.apiDocs.integrations.title")}</h3>
          <p className="muted-text">{t("merchant.apiDocs.integrations.lead")}</p>
        </header>
      ) : null}

      <div className="docs-integration-grid">
        {INTEGRATION_MODULES.map((module) => {
          const downloadUrl = integrationDownloadUrl(module.downloadFile);
          const guidePath = `/integrations/${module.id}`;
          return (
            <article className="docs-integration-card" key={module.id}>
              <div className="docs-integration-card-head">
                <span className="docs-integration-card-icon">
                  {module.id === "oneC" ? "1C" : module.id.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <h3>{t(`merchant.apiDocs.integrations.modules.${module.id}.title`)}</h3>
                  <p>{t(`merchant.apiDocs.integrations.modules.${module.id}.subtitle`)}</p>
                </div>
              </div>
              <p className="docs-integration-card-body">
                {t(`merchant.apiDocs.integrations.modules.${module.id}.body`)}
              </p>
              {!compact ? (
                <dl className="docs-integration-meta">
                  <div>
                    <dt>{t("merchant.apiDocs.integrations.orderPrefix")}</dt>
                    <dd>
                      <code>{module.orderPrefix}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>{t("merchant.apiDocs.integrations.requirements")}</dt>
                    <dd>{t(`merchant.apiDocs.integrations.requirementsList.${module.requirementsKey}`)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="docs-integration-prefix">
                  <code>{module.orderPrefix}</code>
                </p>
              )}
              <div className="docs-integration-actions">
                {!compact ? (
                  <Link className="docs-site-button docs-site-button-primary" to={guidePath}>
                    {t("merchant.apiDocs.integrations.openModuleGuide")}
                  </Link>
                ) : null}
                <a className="docs-site-button docs-site-button-ghost" href={downloadUrl} download>
                  {t("merchant.apiDocs.integrations.download")}
                </a>
              </div>
            </article>
          );
        })}
      </div>

      {!compact ? (
        <section className="docs-support-panel docs-integration-bundle">
          <div>
            <p className="docs-support-eyebrow">{t("merchant.apiDocs.integrations.bundleEyebrow")}</p>
            <h2>{t("merchant.apiDocs.integrations.bundleTitle")}</h2>
            <p>{t("merchant.apiDocs.integrations.bundleBody")}</p>
          </div>
          <a
            className="docs-site-button docs-site-button-primary"
            href={integrationDownloadUrl(INTEGRATIONS_BUNDLE_FILE)}
            download
          >
            {t("merchant.apiDocs.integrations.downloadAll")}
          </a>
        </section>
      ) : null}
    </div>
  );
}

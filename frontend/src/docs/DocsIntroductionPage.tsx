import { Link } from "react-router-dom";

import { resolveClientApiBaseUrl } from "../config/apiBase";
import { resolveMainSiteOrigin } from "../config/siteHost";
import { usePlatformBrand } from "../brand/PlatformBrandContext";
import { useTranslation } from "../i18n";
import { useDocsHubCards, useDocsPipeline } from "./useDocsNav";

export function DocsIntroductionPage() {
  const mainSite = resolveMainSiteOrigin();
  const apiBaseUrl = resolveClientApiBaseUrl();
  const { brandName } = usePlatformBrand();
  const { t } = useTranslation();
  const pipeline = useDocsPipeline();
  const hubCards = useDocsHubCards();

  return (
    <article className="docs-intro docs-intro--hub">
      <section className="docs-hero docs-hero--compact">
        <div className="docs-hero-copy">
          <p className="docs-hero-eyebrow">
            <span className="docs-hero-pulse" />
            {brandName} · {t("docsSite.hub.eyebrowSuffix")}
          </p>
          <h1>
            {t("docsSite.hub.titleLine1")}
            <span> {t("docsSite.hub.titleLine2")}</span>
          </h1>
          <p className="docs-hero-lead">{t("docsSite.hub.lead")}</p>
          <div className="docs-hero-actions">
            <Link className="docs-site-button docs-site-button-primary" to="/quickstart">
              {t("docsSite.hub.quickStart")}
            </Link>
            <Link className="docs-site-button docs-site-button-ghost" to="/reference">
              {t("docsSite.hub.apiMethods")}
            </Link>
            <a className="docs-site-button docs-site-button-ghost" href={`${mainSite}/?auth=register`}>
              {t("docsSite.getApiKeys")}
            </a>
          </div>
        </div>

        <div className="docs-hero-panel">
          <p className="docs-hero-panel-label">{t("docsSite.hub.pathLabel")}</p>
          <div className="docs-pipeline docs-pipeline--compact">
            {pipeline.map((item) => (
              <article className="docs-pipeline-step" key={item.step}>
                <span>{item.step}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="docs-intro-section">
        <div className="docs-section-head">
          <p>{t("docsSite.hub.sectionsLabel")}</p>
          <h2>{t("docsSite.hub.whereNext")}</h2>
        </div>
        <div className="docs-intro-cards docs-intro-cards--hub">
          {hubCards.map((card) => (
            <Link className="docs-intro-card" key={card.title} to={card.to}>
              <span className="docs-intro-card-icon">{card.icon}</span>
              <strong>{card.title}</strong>
              <span>{card.body}</span>
              <em>{t("docsSite.hub.open")}</em>
            </Link>
          ))}
        </div>
      </section>

      <section className="docs-intro-section docs-support-panel">
        <div>
          <p className="docs-support-eyebrow">{t("docsSite.hub.envEyebrow")}</p>
          <h2>{t("docsSite.hub.baseUrlTitle")}</h2>
          <p>
            {t("docsSite.hub.baseUrlBodyBefore")} <code>{apiBaseUrl}</code> {t("docsSite.hub.baseUrlBodyAfter")}
          </p>
        </div>
        <Link className="docs-site-button docs-site-button-primary" to="/quickstart">
          {t("docsSite.hub.startIntegration")}
        </Link>
      </section>
    </article>
  );
}

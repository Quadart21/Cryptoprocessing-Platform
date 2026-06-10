import { Link } from "react-router-dom";

import { resolveClientApiBaseUrl } from "../config/apiBase";
import { resolveMainSiteOrigin } from "../config/siteHost";
import { usePlatformBrand } from "../brand/PlatformBrandContext";
import { DOCS_HUB_CARDS, DOCS_PIPELINE } from "./docsNav";

export function DocsIntroductionPage() {
  const mainSite = resolveMainSiteOrigin();
  const apiBaseUrl = resolveClientApiBaseUrl();
  const { brandName } = usePlatformBrand();

  return (
    <article className="docs-intro docs-intro--hub">
      <section className="docs-hero docs-hero--compact">
        <div className="docs-hero-copy">
          <p className="docs-hero-eyebrow">
            <span className="docs-hero-pulse" />
            {brandName} · Merchant API
          </p>
          <h1>
            Cryptocurrency
            <span> payment documentation</span>
          </h1>
          <p className="docs-hero-lead">
            Sections are organized by task: getting started, checkout, webhooks, method reference, and pricing. No
            single endless page.
          </p>
          <div className="docs-hero-actions">
            <Link className="docs-site-button docs-site-button-primary" to="/quickstart">
              Quick start
            </Link>
            <Link className="docs-site-button docs-site-button-ghost" to="/reference">
              API methods
            </Link>
            <a className="docs-site-button docs-site-button-ghost" href={`${mainSite}/?auth=register`}>
              Get API keys
            </a>
          </div>
        </div>

        <div className="docs-hero-panel">
          <p className="docs-hero-panel-label">Integration path</p>
          <div className="docs-pipeline docs-pipeline--compact">
            {DOCS_PIPELINE.map((item) => (
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
          <p>Sections</p>
          <h2>Where to go next</h2>
        </div>
        <div className="docs-intro-cards docs-intro-cards--hub">
          {DOCS_HUB_CARDS.map((card) => (
            <Link className="docs-intro-card" key={card.title} to={card.to}>
              <span className="docs-intro-card-icon">{card.icon}</span>
              <strong>{card.title}</strong>
              <span>{card.body}</span>
              <em>Open →</em>
            </Link>
          ))}
        </div>
      </section>

      <section className="docs-intro-section docs-support-panel">
        <div>
          <p className="docs-support-eyebrow">Environment</p>
          <h2>Base URL</h2>
          <p>
            Merchant API: <code>{apiBaseUrl}</code> · the <code>/api/v1/client</code> prefix is already included in
            examples.
          </p>
        </div>
        <Link className="docs-site-button docs-site-button-primary" to="/quickstart">
          Start integration
        </Link>
      </section>
    </article>
  );
}

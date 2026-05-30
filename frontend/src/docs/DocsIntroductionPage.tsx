import { Link } from "react-router-dom";

import { resolveClientApiBaseUrl } from "../config/apiBase";
import { resolveMainSiteOrigin } from "../config/siteHost";
import { DocsCopyChip } from "./DocsCopyChip";
import { DOCS_PIPELINE, DOCS_QUICK_CARDS, DOCS_STATS } from "./docsNav";

export function DocsIntroductionPage() {
  const mainSite = resolveMainSiteOrigin();
  const apiBaseUrl = resolveClientApiBaseUrl();

  return (
    <article className="docs-intro">
      <section className="docs-hero">
        <div className="docs-hero-copy">
          <p className="docs-hero-eyebrow">
            <span className="docs-hero-pulse" />
            Merchant API · Production ready
          </p>
          <h1>
            Документация для
            <span> premium crypto checkout</span>
          </h1>
          <p className="docs-hero-lead">
            Интегрируйте приём USDT и других активов через REST API: инвойсы, адреса пополнения,
            баланс, транзакции и события webhook — с прозрачным контрактом и примерами под copy-paste.
          </p>
          <div className="docs-hero-actions">
            <Link className="docs-site-button docs-site-button-primary" to="/merchant-api">
              Explore API Reference
            </Link>
            <a className="docs-site-button docs-site-button-ghost" href={`${mainSite}/?auth=register`}>
              Create merchant account
            </a>
          </div>
        </div>

        <div className="docs-hero-panel">
          <p className="docs-hero-panel-label">Integration flow</p>
          <div className="docs-pipeline">
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

      <section className="docs-stats-row" aria-label="Platform highlights">
        {DOCS_STATS.map((item) => (
          <article className="docs-stat-card" key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
            <p>{item.hint}</p>
          </article>
        ))}
      </section>

      <section className="docs-intro-section">
        <div className="docs-section-head">
          <p>Explore</p>
          <h2>Разделы документации</h2>
        </div>
        <div className="docs-intro-cards">
          {DOCS_QUICK_CARDS.map((card) => (
            <Link className="docs-intro-card" key={card.title} to={card.to}>
              <span className="docs-intro-card-icon">{card.icon}</span>
              <strong>{card.title}</strong>
              <span>{card.body}</span>
              <em>Open section →</em>
            </Link>
          ))}
        </div>
      </section>

      <section className="docs-intro-section docs-endpoint-panel">
        <div className="docs-section-head">
          <p>Environment</p>
          <h2>Base URL & health</h2>
        </div>
        <DocsCopyChip value={apiBaseUrl} label="Copy base URL" />
        <DocsCopyChip value={`${apiBaseUrl}/health`} label="Copy health" />
        <p className="docs-intro-muted">
          Все merchant-методы живут под <code>/api/v1/client</code>. Health доступен без авторизации.
        </p>
      </section>

      <section className="docs-intro-section docs-support-panel">
        <div>
          <p className="docs-support-eyebrow">Premium support</p>
          <h2>Нужна помощь с интеграцией?</h2>
          <p>
            Откройте кабинет мерчанта, выпустите ключи и используйте встроенный webhook test. Для
            review payload'ов — свяжитесь с командой платформы.
          </p>
        </div>
        <a className="docs-site-button docs-site-button-primary" href={mainSite}>
          {mainSite.replace(/^https?:\/\//, "")}
        </a>
      </section>
    </article>
  );
}

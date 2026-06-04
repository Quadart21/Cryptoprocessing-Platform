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
            NorenDigital · Merchant API
          </p>
          <h1>
            Документация
            <span> приёма криптовалюты</span>
          </h1>
          <p className="docs-hero-lead">
            REST API для инвойсов, hosted checkout на <code>/pay/&#123;token&#125;</code>, H2H-реквизитов,
            баланса, транзакций и webhook. Формат ответа задаётся на уровне проекта.
          </p>
          <div className="docs-hero-actions">
            <Link className="docs-site-button docs-site-button-primary" to="/merchant-api">
              API Reference
            </Link>
            <a className="docs-site-button docs-site-button-ghost" href={`${mainSite}/?auth=register`}>
              Создать аккаунт
            </a>
          </div>
        </div>

        <div className="docs-hero-panel">
          <p className="docs-hero-panel-label">Сценарий интеграции</p>
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
          <p>Разделы</p>
          <h2>Документация</h2>
        </div>
        <div className="docs-intro-cards">
          {DOCS_QUICK_CARDS.map((card) => (
            <Link className="docs-intro-card" key={card.title} to={card.to}>
              <span className="docs-intro-card-icon">{card.icon}</span>
              <strong>{card.title}</strong>
              <span>{card.body}</span>
              <em>Открыть →</em>
            </Link>
          ))}
        </div>
      </section>

      <section className="docs-intro-section docs-endpoint-panel">
        <div className="docs-section-head">
          <p>Окружение</p>
          <h2>Base URL и health</h2>
        </div>
        <DocsCopyChip value={apiBaseUrl} label="Скопировать URL" />
        <DocsCopyChip value={`${apiBaseUrl}/health`} label="Скопировать health" />
        <p className="docs-intro-muted">
          Merchant-методы — под <code>/api/v1/client</code>. Health доступен без авторизации.
        </p>
      </section>

      <section className="docs-intro-section docs-support-panel">
        <div>
          <p className="docs-support-eyebrow">Поддержка</p>
          <h2>Вопросы по интеграции</h2>
          <p>
            Выпустите ключи в кабинете, проверьте webhook через встроенный тест. Для разбора payload — напишите
            команде платформы.
          </p>
        </div>
        <a className="docs-site-button docs-site-button-primary" href={mainSite}>
          {mainSite.replace(/^https?:\/\//, "")}
        </a>
      </section>
    </article>
  );
}

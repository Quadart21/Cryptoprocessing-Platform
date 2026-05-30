import { Link } from "react-router-dom";

import { resolveClientApiBaseUrl } from "../config/apiBase";
import { resolveMainSiteOrigin } from "../config/siteHost";
import { DOCS_QUICK_CARDS } from "./docsNav";

export function DocsIntroductionPage() {
  const mainSite = resolveMainSiteOrigin();
  const apiBaseUrl = resolveClientApiBaseUrl();

  return (
    <article className="docs-intro">
      <p className="docs-intro-eyebrow">Documentation</p>
      <h1>Введение в NorenCash Merchant API</h1>
      <p className="docs-intro-lead">
        NorenCash API предоставляет набор инструментов для интеграции криптовалютных платежей в ваш сервис:
        создание инвойсов, получение адресов для пополнения, история транзакций, баланс, выплаты и webhook-события.
      </p>

      <section className="docs-intro-section">
        <h2>Начало работы</h2>
        <p>
          Для интеграции создайте проект в личном кабинете и выпустите пару{" "}
          <strong>Public / Secret keys</strong>. Secret храните только на backend.
        </p>
        <div className="docs-intro-actions">
          <a className="docs-site-button docs-site-button-primary" href={`${mainSite}/?auth=register`}>
            Перейти в кабинет
          </a>
          <Link className="docs-site-button docs-site-button-ghost" to="/merchant-api">
            Открыть Merchant API
          </Link>
        </div>
      </section>

      <section className="docs-intro-section">
        <h2>Быстрая навигация</h2>
        <p className="docs-intro-muted">Основные разделы документации</p>
        <div className="docs-intro-cards">
          {DOCS_QUICK_CARDS.map((card) => (
            <Link className="docs-intro-card" key={card.title} to={card.to}>
              <strong>{card.title}</strong>
              <span>{card.body}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="docs-intro-section">
        <h2>Base URL</h2>
        <pre className="docs-intro-code">{apiBaseUrl}</pre>
        <p className="docs-intro-muted">
          Health-check: <code>{apiBaseUrl}/health</code>
        </p>
      </section>

      <section className="docs-intro-section docs-intro-support">
        <h2>Поддержка</h2>
        <p>
          Если нужна помощь с интеграцией, откройте кабинет мерчанта или обратитесь к менеджеру платформы через
          контакты на основном сайте.
        </p>
        <a className="docs-site-link" href={mainSite}>
          {mainSite.replace(/^https?:\/\//, "")}
        </a>
      </section>
    </article>
  );
}

import { NavLink, Outlet, useLocation } from "react-router-dom";

import { resolveMainSiteOrigin } from "../config/siteHost";
import { DocsApiToc } from "./DocsApiToc";
import { DOCS_PRIMARY_NAV } from "./docsNav";

export function DocsSiteLayout() {
  const mainSite = resolveMainSiteOrigin();
  const location = useLocation();
  const isApiPage = location.pathname.startsWith("/merchant-api");

  return (
    <div className={`docs-site${isApiPage ? " docs-site--api" : ""}`}>
      <div className="docs-site-ambient" aria-hidden="true">
        <span className="docs-site-orb docs-site-orb-a" />
        <span className="docs-site-orb docs-site-orb-b" />
        <span className="docs-site-grid" />
      </div>

      <header className="docs-site-topbar">
        <div className="docs-site-topbar-inner">
          <NavLink className="docs-site-brand" to="/">
            <span className="docs-site-brand-mark" aria-hidden="true">
              <span />
            </span>
            <div>
              <strong>NorenDigital</strong>
              <small>Developer Documentation</small>
            </div>
          </NavLink>

          <nav className="docs-site-topnav" aria-label="Documentation sections">
            {DOCS_PRIMARY_NAV.map((item) => {
              const isHashLink = item.to.includes("#");
              const isActive =
                !isHashLink &&
                (item.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.to));
              const className = `docs-site-topnav-link${isActive ? " is-active" : ""}`;
              return isHashLink ? (
                <a className={className} href={item.to} key={item.to}>
                  {item.label}
                </a>
              ) : (
                <NavLink className={className} end={item.to === "/"} key={item.to} to={item.to}>
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="docs-site-topbar-actions">
            <a className="docs-site-link" href={`${mainSite}/docs`} target="_blank" rel="noreferrer">
              OpenAPI
            </a>
            <a className="docs-site-button docs-site-button-ghost" href={`${mainSite}/?auth=login`}>
              Sign in
            </a>
            <a className="docs-site-button docs-site-button-primary" href={`${mainSite}/?auth=register`}>
              Get API keys
            </a>
          </div>
        </div>
      </header>

      <div className={`docs-site-shell${isApiPage ? " docs-site-shell--api" : ""}`}>
        {!isApiPage ? (
          <aside className="docs-site-sidebar" aria-label="Documentation navigation">
            <div className="docs-site-sidebar-panel">
              <p className="docs-site-sidebar-label">Guides</p>
              <nav className="docs-site-nav">
                {DOCS_PRIMARY_NAV.map((item) => {
                  const className = `docs-site-nav-item${
                    !item.to.includes("#") && location.pathname === item.to ? " is-active" : ""
                  }`;
                  const content = (
                    <>
                      <span className="docs-site-nav-icon">{item.icon}</span>
                      <span className="docs-site-nav-copy">
                        <strong>{item.label}</strong>
                        <span>{item.description}</span>
                      </span>
                    </>
                  );
                  return item.to.includes("#") ? (
                    <a className={className} href={item.to} key={item.to}>
                      {content}
                    </a>
                  ) : (
                    <NavLink className={className} end={item.to === "/"} key={item.to} to={item.to}>
                      {content}
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            <div className="docs-site-sidebar-panel docs-site-sidebar-cta">
              <p className="docs-site-sidebar-label">Need help?</p>
              <p>Команда поддержки поможет с интеграцией и review payload&apos;ов.</p>
              <a className="docs-site-button docs-site-button-primary docs-site-button-block" href={mainSite}>
                Открыть платформу
              </a>
            </div>
          </aside>
        ) : null}

        <div className="docs-site-content">
          {isApiPage ? (
            <div className="docs-api-banner">
              <div>
                <p className="docs-api-banner-eyebrow">Reference</p>
                <h1>Merchant API</h1>
                <p>
                  Контракт для приёма крипто-платежей: инвойсы, баланс, транзакции и webhook-события с
                  copy-paste примерами.
                </p>
              </div>
              <div className="docs-api-banner-badges">
                <span>REST</span>
                <span>JSON</span>
                <span>HMAC Webhooks</span>
              </div>
            </div>
          ) : null}

          <main className={`docs-site-main${isApiPage ? " docs-site-main--api" : ""}`}>
            <Outlet />
          </main>

          {!isApiPage ? (
            <footer className="docs-site-footer">
              <span>© NorenDigital Developer Docs</span>
              <div className="docs-site-footer-links">
                <a href={`${mainSite}/openapi.json`} target="_blank" rel="noreferrer">
                  openapi.json
                </a>
                <a href={`${mainSite}/docs`} target="_blank" rel="noreferrer">
                  Swagger
                </a>
                <a href={mainSite}>Platform</a>
              </div>
            </footer>
          ) : null}
        </div>

        {isApiPage ? <DocsApiToc /> : null}
      </div>
    </div>
  );
}

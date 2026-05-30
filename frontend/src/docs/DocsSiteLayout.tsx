import { NavLink, Outlet } from "react-router-dom";

import { resolveMainSiteOrigin } from "../config/siteHost";
import { DOCS_PRIMARY_NAV } from "./docsNav";

export function DocsSiteLayout() {
  const mainSite = resolveMainSiteOrigin();

  return (
    <div className="docs-site">
      <header className="docs-site-topbar">
        <div className="docs-site-topbar-inner">
          <NavLink className="docs-site-brand" to="/">
            <span className="docs-site-brand-mark" aria-hidden="true" />
            <div>
              <strong>NorenCash Docs</strong>
              <small>Merchant API</small>
            </div>
          </NavLink>
          <div className="docs-site-topbar-actions">
            <a className="docs-site-link" href={`${mainSite}/docs`} rel="noreferrer">
              На основном сайте
            </a>
            <a className="docs-site-button docs-site-button-ghost" href={`${mainSite}/?auth=login`}>
              Войти
            </a>
            <a className="docs-site-button docs-site-button-primary" href={`${mainSite}/?auth=register`}>
              Подключить проект
            </a>
          </div>
        </div>
      </header>

      <div className="docs-site-body">
        <aside className="docs-site-sidebar" aria-label="Навигация документации">
          <p className="docs-site-sidebar-label">Документация</p>
          <nav className="docs-site-nav">
            {DOCS_PRIMARY_NAV.map((item) =>
              item.to.includes("#") ? (
                <a className="docs-site-nav-item" href={item.to} key={item.to}>
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </a>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `docs-site-nav-item${isActive ? " is-active" : ""}`}
                  end={item.to === "/"}
                >
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </NavLink>
              ),
            )}
          </nav>
          <div className="docs-site-sidebar-foot">
            <p className="docs-site-sidebar-label">OpenAPI</p>
            <a className="docs-site-link" href={`${mainSite}/docs`} target="_blank" rel="noreferrer">
              Swagger UI
            </a>
            <a className="docs-site-link" href={`${mainSite}/openapi.json`} target="_blank" rel="noreferrer">
              openapi.json
            </a>
          </div>
        </aside>

        <main className="docs-site-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

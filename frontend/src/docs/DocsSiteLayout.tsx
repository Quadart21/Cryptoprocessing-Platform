import { NavLink, Outlet, useLocation } from "react-router-dom";

import { PlatformBrandMark, usePlatformBrand } from "../brand/PlatformBrandLogo";
import { resolveClientApiBaseUrl } from "../config/apiBase";
import { resolveMainSiteOrigin } from "../config/siteHost";
import { DocsCopyChip } from "./DocsCopyChip";
import { DOCS_SIDEBAR_GROUPS } from "./docsNav";

function isNavActive(pathname: string, to: string) {
  if (to === "/") {
    return pathname === "/";
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function DocsSiteLayout() {
  const mainSite = resolveMainSiteOrigin();
  const apiBaseUrl = resolveClientApiBaseUrl();
  const location = useLocation();
  const isHub = location.pathname === "/";
  const { brandName, logoUrl } = usePlatformBrand();

  return (
    <div className="docs-site">
      <div className="docs-site-ambient" aria-hidden="true">
        <span className="docs-site-orb docs-site-orb-a" />
        <span className="docs-site-orb docs-site-orb-b" />
        <span className="docs-site-grid" />
      </div>

      <header className="docs-site-topbar">
        <div className="docs-site-topbar-inner">
          <NavLink className="docs-site-brand" to="/">
            {logoUrl ? (
              <PlatformBrandMark imgClassName="docs-site-brand-logo-img" />
            ) : (
              <span className="docs-site-brand-mark" aria-hidden="true">
                <span />
              </span>
            )}
            <div>
              {!logoUrl ? <strong>{brandName}</strong> : null}
              <small>Документация Merchant API</small>
            </div>
          </NavLink>

          <div className="docs-site-topbar-actions">
            <a className="docs-site-link" href={`${mainSite}/docs`} target="_blank" rel="noreferrer">
              Swagger
            </a>
            <a className="docs-site-button docs-site-button-ghost" href={`${mainSite}/?auth=login`}>
              Войти
            </a>
            <a className="docs-site-button docs-site-button-primary" href={`${mainSite}/?auth=register`}>
              Получить ключи
            </a>
          </div>
        </div>
      </header>

      <div className="docs-site-shell">
        <aside className="docs-site-sidebar" aria-label="Навигация документации">
          {DOCS_SIDEBAR_GROUPS.map((group) => (
            <div className="docs-site-sidebar-panel" key={group.label}>
              <p className="docs-site-sidebar-label">{group.label}</p>
              <nav className="docs-site-nav">
                {group.items.map((item) => (
                  <NavLink
                    className={({ isActive }) =>
                      `docs-site-nav-item${isActive || isNavActive(location.pathname, item.to) ? " is-active" : ""}`
                    }
                    end={item.to === "/"}
                    key={item.to}
                    to={item.to}
                  >
                    <span className="docs-site-nav-icon">{item.icon}</span>
                    <span className="docs-site-nav-copy">
                      <strong>{item.label}</strong>
                      <span>{item.description}</span>
                    </span>
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}

          <div className="docs-site-sidebar-panel docs-site-sidebar-env">
            <p className="docs-site-sidebar-label">Base URL</p>
            <DocsCopyChip value={apiBaseUrl} label="Скопировать" />
            <p className="docs-site-sidebar-hint">
              Health: <code>{apiBaseUrl}/health</code>
            </p>
          </div>

          <div className="docs-site-sidebar-panel docs-site-sidebar-cta">
            <p className="docs-site-sidebar-label">Поддержка</p>
            <p>Поможем с интеграцией и разбором webhook payload.</p>
            <a className="docs-site-button docs-site-button-primary docs-site-button-block" href={mainSite}>
              Открыть платформу
            </a>
          </div>
        </aside>

        <div className="docs-site-content">
          <main className={`docs-site-main${isHub ? " docs-site-main--hub" : " docs-site-main--guide"}`}>
            <Outlet />
          </main>

          <footer className="docs-site-footer">
            <span>
              © {new Date().getFullYear()} {brandName}
            </span>
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
        </div>
      </div>
    </div>
  );
}

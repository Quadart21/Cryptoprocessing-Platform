import { NavLink, Outlet, useLocation } from "react-router-dom";

import { PlatformBrandMark, usePlatformBrand } from "../brand/PlatformBrandLogo";
import { resolveClientApiBaseUrl } from "../config/apiBase";
import { resolveMainSiteOrigin } from "../config/siteHost";
import { LanguageSwitcher, useTranslation } from "../i18n";
import { DocsCopyChip } from "./DocsCopyChip";
import { useDocsSidebarGroups } from "./useDocsNav";

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
  const { t, dir, locale } = useTranslation();
  const sidebarGroups = useDocsSidebarGroups();

  return (
    <div className="docs-site" lang={locale} dir={dir}>
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
              <small>{t("docsSite.brandSubtitle")}</small>
            </div>
          </NavLink>

          <div className="docs-site-topbar-actions">
            <LanguageSwitcher className="docs-site-lang" variant="compact" />
            <a className="docs-site-link" href={`${mainSite}/docs`} target="_blank" rel="noreferrer">
              {t("docsSite.swagger")}
            </a>
            <a className="docs-site-button docs-site-button-ghost" href={`${mainSite}/?auth=login`}>
              {t("docsSite.signIn")}
            </a>
            <a className="docs-site-button docs-site-button-primary" href={`${mainSite}/?auth=register`}>
              {t("docsSite.getApiKeys")}
            </a>
          </div>
        </div>
      </header>

      <div className="docs-site-shell">
        <aside className="docs-site-sidebar" aria-label={t("docsSite.navAria")}>
          {sidebarGroups.map((group) => (
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
            <p className="docs-site-sidebar-label">{t("docsSite.baseUrl")}</p>
            <DocsCopyChip value={apiBaseUrl} label={t("docsSite.copy")} copiedLabel={t("docsSite.copied")} />
            <p className="docs-site-sidebar-hint">
              {t("docsSite.health")}: <code>{apiBaseUrl}/health</code>
            </p>
          </div>

          <div className="docs-site-sidebar-panel docs-site-sidebar-cta">
            <p className="docs-site-sidebar-label">{t("docsSite.support")}</p>
            <p>{t("docsSite.supportBody")}</p>
            <a className="docs-site-button docs-site-button-primary docs-site-button-block" href={mainSite}>
              {t("docsSite.openPlatform")}
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
                {t("docsSite.swagger")}
              </a>
              <a href={mainSite}>{t("docsSite.platform")}</a>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

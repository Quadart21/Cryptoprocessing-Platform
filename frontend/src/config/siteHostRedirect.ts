import {
  isAdminSubdomain,
  isApiSubdomain,
  isAppSubdomain,
  isMarketingHost,
  isPaySubdomain,
  resolveAdminSiteUrl,
  resolveAppSiteUrl,
  resolveDocsSiteUrl,
  resolvePaySiteUrl,
} from "./siteHost";
import { buildAuthHandoffUrl, isCrossOriginUrl } from "./authHandoff";

type ViteImportMeta = ImportMeta & {
  env?: Record<string, string | undefined>;
};

function envValue(key: string): string | null {
  const raw = (import.meta as ViteImportMeta).env?.[key]?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

function isLocalDevHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower === "localhost" || lower === "127.0.0.1" || lower.endsWith(".localhost");
}

/** Включить редиректы на app/admin/api/pay (prod или явные VITE_*). */
export function dedicatedSiteHostsEnabled(): boolean {
  if (
    envValue("VITE_APP_SITE_URL") ||
    envValue("VITE_ADMIN_SITE_URL") ||
    envValue("VITE_API_BASE_URL")
  ) {
    return true;
  }
  if (typeof window === "undefined") {
    return false;
  }
  return !isLocalDevHost(window.location.hostname);
}

function currentPathAndSearch(): string {
  if (typeof window === "undefined") {
    return "/";
  }
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function urlsDiffer(target: string, current: string): boolean {
  try {
    const targetUrl = new URL(target, window.location.origin);
    const currentUrl = new URL(current, window.location.origin);
    return targetUrl.href !== currentUrl.href;
  } catch {
    return target !== current;
  }
}

export function redirectToUrlIfNeeded(target: string): boolean {
  if (!dedicatedSiteHostsEnabled() || typeof window === "undefined") {
    return false;
  }
  if (!urlsDiffer(target, window.location.href)) {
    return false;
  }
  window.location.replace(target);
  return true;
}

export function buildAppAuthUrl(mode: "login" | "register"): string {
  const base = resolveAppSiteUrl("/");
  try {
    const url = new URL(base);
    url.searchParams.set("auth", mode);
    return url.toString();
  } catch {
    return `${base}?auth=${mode}`;
  }
}

export function readAuthModeFromQuery(): "login" | "register" | "partner" | null {
  if (typeof window === "undefined") {
    return null;
  }
  const auth = new URLSearchParams(window.location.search).get("auth")?.toLowerCase();
  if (auth === "login" || auth === "register" || auth === "partner") {
    return auth;
  }
  return null;
}

export function clearAuthQueryFromUrl(): void {
  if (typeof window === "undefined") {
    return;
  }
  const params = new URLSearchParams(window.location.search);
  if (!params.has("auth")) {
    return;
  }
  params.delete("auth");
  const query = params.toString();
  const next = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", next);
}

export function redirectPayTokenFromMarketingHost(token: string): boolean {
  if (!dedicatedSiteHostsEnabled() || isPaySubdomain() || !isMarketingHost()) {
    return false;
  }
  return redirectToUrlIfNeeded(resolvePaySiteUrl(`/${encodeURIComponent(token)}`));
}

export function redirectApiRootToDocs(): boolean {
  if (!dedicatedSiteHostsEnabled() || !isApiSubdomain() || typeof window === "undefined") {
    return false;
  }
  const path = window.location.pathname;
  if (path !== "/" && path !== "") {
    return false;
  }
  return redirectToUrlIfNeeded(resolveDocsSiteUrl("/"));
}

export function redirectAuthenticatedUserToDedicatedHost(
  role: string,
  adminHost: boolean,
  accessToken: string | null,
  csrfToken?: string | null,
): boolean {
  if (!dedicatedSiteHostsEnabled()) {
    return false;
  }

  const platformRole = new Set([
    "superadmin",
    "platform_admin",
    "platform_finance",
    "platform_support",
  ]).has(role);

  if (platformRole) {
    if (adminHost && isAdminSubdomain()) {
      return false;
    }
    const target = resolveAdminSiteUrl(currentPathAndSearch());
    const finalTarget =
      accessToken && isCrossOriginUrl(target)
        ? buildAuthHandoffUrl(target, accessToken, csrfToken)
        : target;
    return redirectToUrlIfNeeded(finalTarget);
  }

  if (!isAppSubdomain()) {
    const target = resolveAppSiteUrl(currentPathAndSearch());
    const finalTarget =
      accessToken && isCrossOriginUrl(target)
        ? buildAuthHandoffUrl(target, accessToken, csrfToken)
        : target;
    return redirectToUrlIfNeeded(finalTarget);
  }

  return false;
}

export function redirectMarketingAuthToApp(mode: "login" | "register"): boolean {
  if (!dedicatedSiteHostsEnabled() || !isMarketingHost() || isAppSubdomain()) {
    return false;
  }
  // Login/register on marketing host; after auth useDedicatedSiteRedirect handoffs the token.
  if (mode === "login") {
    return false;
  }
  return redirectToUrlIfNeeded(buildAppAuthUrl(mode));
}

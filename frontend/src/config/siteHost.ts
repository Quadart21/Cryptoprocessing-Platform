type ViteImportMeta = ImportMeta & {
  env?: Record<string, string | undefined>;
};

function envValue(key: string): string | null {
  const raw = (import.meta as ViteImportMeta).env?.[key]?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

function stripSubdomainPrefix(hostname: string, prefix: string): string {
  const lower = hostname.toLowerCase();
  const normalizedPrefix = `${prefix.toLowerCase()}.`;
  if (lower.startsWith(normalizedPrefix)) {
    return hostname.slice(normalizedPrefix.length);
  }
  return hostname;
}

export function isDocsSubdomain(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.location.hostname.toLowerCase().startsWith("docs.");
}

export function isAdminSubdomain(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.location.hostname.toLowerCase().startsWith("admin.");
}

export function isAppSubdomain(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.location.hostname.toLowerCase().startsWith("app.");
}

export function isPaySubdomain(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.location.hostname.toLowerCase().startsWith("pay.");
}

export function isApiSubdomain(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.location.hostname.toLowerCase().startsWith("api.");
}

const RESERVED_SITE_PREFIXES = new Set(["app", "admin", "api", "docs", "pay"]);

/** Основной маркетинговый хост (apex или www), без кабинета/админки/API. */
export function isMarketingHost(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const hostname = window.location.hostname.toLowerCase();
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length < 2) {
    return true;
  }
  const prefix = parts[0];
  if (prefix === "www") {
    return true;
  }
  return !RESERVED_SITE_PREFIXES.has(prefix);
}

export function resolveMainSiteOrigin(): string {
  const configured = envValue("VITE_MAIN_SITE_URL");
  if (configured) {
    return configured;
  }
  if (typeof window === "undefined") {
    return "https://noren.digital";
  }
  const { protocol, hostname } = window.location;
  if (isDocsSubdomain()) {
    const host = stripSubdomainPrefix(hostname, "docs");
    return `${protocol}//${host}`;
  }
  if (isAdminSubdomain()) {
    const host = stripSubdomainPrefix(hostname, "admin");
    return `${protocol}//${host}`;
  }
  if (isAppSubdomain()) {
    const host = stripSubdomainPrefix(hostname, "app");
    return `${protocol}//${host}`;
  }
  if (isPaySubdomain()) {
    const host = stripSubdomainPrefix(hostname, "pay");
    return `${protocol}//${host}`;
  }
  return window.location.origin;
}

export function resolveDocsSiteUrl(path = "/"): string {
  const configured = envValue("VITE_DOCS_SITE_URL");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (configured) {
    return `${configured}${normalizedPath}`;
  }
  const main = resolveMainSiteOrigin();
  try {
    const url = new URL(main);
    return `${url.protocol}//docs.${url.host}${normalizedPath}`;
  } catch {
    return `https://docs.noren.digital${normalizedPath}`;
  }
}

export function resolveAdminSiteUrl(path = "/"): string {
  const configured = envValue("VITE_ADMIN_SITE_URL");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (configured) {
    return `${configured}${normalizedPath}`;
  }
  const main = resolveMainSiteOrigin();
  try {
    const url = new URL(main);
    return `${url.protocol}//admin.${url.host}${normalizedPath}`;
  } catch {
    return "https://admin.noren.digital/";
  }
}

export function resolvePaySiteUrl(path = "/"): string {
  const configured = envValue("VITE_PAY_SITE_URL");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (configured) {
    return `${configured}${normalizedPath}`;
  }
  const main = resolveMainSiteOrigin();
  try {
    const url = new URL(main);
    return `${url.protocol}//pay.${url.host}${normalizedPath}`;
  } catch {
    return "https://pay.noren.digital/";
  }
}

export function resolveAppSiteUrl(path = "/"): string {
  const configured = envValue("VITE_APP_SITE_URL");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (configured) {
    return `${configured}${normalizedPath}`;
  }
  const main = resolveMainSiteOrigin();
  try {
    const url = new URL(main);
    return `${url.protocol}//app.${url.host}${normalizedPath}`;
  } catch {
    return "https://app.noren.digital/";
  }
}

export function resolveApiSiteOrigin(): string {
  const configured = envValue("VITE_API_BASE_URL");
  if (configured) {
    try {
      const url = new URL(configured.replace(/\/+$/, ""));
      if (url.pathname.endsWith("/api/v1")) {
        url.pathname = url.pathname.slice(0, -"/api/v1".length) || "/";
      }
      return url.origin;
    } catch {
      return configured.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
    }
  }
  const main = resolveMainSiteOrigin();
  try {
    const url = new URL(main);
    return `${url.protocol}//api.${url.host}`;
  } catch {
    return "https://api.noren.digital";
  }
}

export function resolveApiBaseUrlForSite(): string {
  const configured = envValue("VITE_API_BASE_URL");
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && !isApiSubdomain()) {
    return `${resolveApiSiteOrigin()}/api/v1`;
  }
  return `${resolveMainSiteOrigin()}/api/v1`;
}

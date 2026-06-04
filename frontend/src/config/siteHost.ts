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

export function resolveApiBaseUrlForSite(): string {
  const configured = envValue("VITE_API_BASE_URL");
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && isPaySubdomain()) {
    try {
      const main = new URL(resolveMainSiteOrigin());
      return `${main.protocol}//api.${main.host}/api/v1`;
    } catch {
      return "https://api.noren.digital/api/v1";
    }
  }
  return `${resolveMainSiteOrigin()}/api/v1`;
}

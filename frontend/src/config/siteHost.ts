type ViteImportMeta = ImportMeta & {
  env?: Record<string, string | undefined>;
};

function envValue(key: string): string | null {
  const raw = (import.meta as ViteImportMeta).env?.[key]?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

export function isDocsSubdomain(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const host = window.location.hostname.toLowerCase();
  return host.startsWith("docs.");
}

export function resolveMainSiteOrigin(): string {
  const configured = envValue("VITE_MAIN_SITE_URL");
  if (configured) {
    return configured;
  }
  if (typeof window === "undefined") {
    return "https://noren.digital";
  }
  if (isDocsSubdomain()) {
    const host = window.location.hostname.replace(/^docs\./i, "");
    return `${window.location.protocol}//${host}`;
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

export function resolveApiBaseUrlForSite(): string {
  const configured = envValue("VITE_API_BASE_URL");
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  return `${resolveMainSiteOrigin()}/api/v1`;
}

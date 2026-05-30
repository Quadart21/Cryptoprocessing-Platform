import { resolveApiBaseUrlForSite } from "./siteHost";

function sanitizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

type ViteImportMeta = ImportMeta & {
  env?: Record<string, string | undefined>;
};

function resolveBrowserOrigin(): string | null {
  if (typeof window === "undefined" || !window.location?.origin) {
    return null;
  }
  return sanitizeBaseUrl(window.location.origin);
}

export function resolveApiBaseUrl(): string {
  const envApiBase = (import.meta as ViteImportMeta).env?.VITE_API_BASE_URL?.trim();
  if (envApiBase) {
    return sanitizeBaseUrl(envApiBase);
  }

  if (typeof window !== "undefined") {
    return resolveApiBaseUrlForSite();
  }

  return "http://127.0.0.1:8000/api/v1";
}

export function resolveClientApiBaseUrl(): string {
  return `${resolveApiBaseUrl()}/client`;
}

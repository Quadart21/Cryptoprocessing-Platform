import type { Locale } from "../i18n/types";

export type PublicSurface = "docs" | "landing";

export type PublicRequestContext = {
  surface: PublicSurface;
  locale: Locale;
  url: string;
  mainOrigin: string;
  apiBaseUrl: string;
};

let current: PublicRequestContext | null = null;

export function setPublicRequestContext(next: PublicRequestContext | null): void {
  current = next;
}

export function getPublicRequestContext(): PublicRequestContext | null {
  return current;
}

export function readPublicSsrBootstrap(): PublicRequestContext | null {
  if (typeof document === "undefined") {
    return null;
  }
  const node = document.getElementById("public-ssr");
  if (!node?.textContent) {
    return null;
  }
  try {
    const parsed = JSON.parse(node.textContent) as Partial<PublicRequestContext>;
    if (parsed.surface !== "docs" && parsed.surface !== "landing") {
      return null;
    }
    if (parsed.locale !== "ru" && parsed.locale !== "en" && parsed.locale !== "ar") {
      return null;
    }
    if (!parsed.url || !parsed.mainOrigin || !parsed.apiBaseUrl) {
      return null;
    }
    return {
      surface: parsed.surface,
      locale: parsed.locale,
      url: parsed.url,
      mainOrigin: parsed.mainOrigin,
      apiBaseUrl: parsed.apiBaseUrl,
    };
  } catch {
    return null;
  }
}

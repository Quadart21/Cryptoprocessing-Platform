import type { Locale } from "./i18n/types";

const TOKEN_KEY = "cryptoprocessing_access_token";
const REFRESH_TOKEN_KEY = "cryptoprocessing_refresh_token";
const CSRF_TOKEN_KEY = "cryptoprocessing_csrf_token";
const LOCALE_KEY = "cryptoprocessing_locale";

const VALID_LOCALES: Locale[] = ["ru", "en", "ar"];

function browserStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

export function getAccessToken(): string | null {
  return browserStorage()?.getItem(TOKEN_KEY) ?? null;
}

export function setAccessToken(token: string): void {
  browserStorage()?.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  browserStorage()?.removeItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return browserStorage()?.getItem(REFRESH_TOKEN_KEY) ?? null;
}

export function setRefreshToken(token: string): void {
  browserStorage()?.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearRefreshToken(): void {
  browserStorage()?.removeItem(REFRESH_TOKEN_KEY);
}

export function getCsrfToken(): string | null {
  return browserStorage()?.getItem(CSRF_TOKEN_KEY) ?? null;
}

export function setCsrfToken(token: string): void {
  browserStorage()?.setItem(CSRF_TOKEN_KEY, token);
}

export function clearCsrfToken(): void {
  browserStorage()?.removeItem(CSRF_TOKEN_KEY);
}

export function getLocale(): Locale | null {
  const value = browserStorage()?.getItem(LOCALE_KEY) ?? null;
  return VALID_LOCALES.includes(value as Locale) ? (value as Locale) : null;
}

export function setLocale(locale: Locale): void {
  browserStorage()?.setItem(LOCALE_KEY, locale);
  writeLocaleCookie(locale);
}

export function writeLocaleCookie(locale: Locale): void {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${LOCALE_KEY}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}


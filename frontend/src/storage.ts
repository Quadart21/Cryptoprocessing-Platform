import type { Locale } from "./i18n/types";

const TOKEN_KEY = "cryptoprocessing_access_token";
const CSRF_TOKEN_KEY = "cryptoprocessing_csrf_token";
const LOCALE_KEY = "cryptoprocessing_locale";

const VALID_LOCALES: Locale[] = ["ru", "en", "ar"];

export function getAccessToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

export function getCsrfToken(): string | null {
  return window.localStorage.getItem(CSRF_TOKEN_KEY);
}

export function setCsrfToken(token: string): void {
  window.localStorage.setItem(CSRF_TOKEN_KEY, token);
}

export function clearCsrfToken(): void {
  window.localStorage.removeItem(CSRF_TOKEN_KEY);
}

export function getLocale(): Locale | null {
  const value = window.localStorage.getItem(LOCALE_KEY);
  return VALID_LOCALES.includes(value as Locale) ? (value as Locale) : null;
}

export function setLocale(locale: Locale): void {
  window.localStorage.setItem(LOCALE_KEY, locale);
}


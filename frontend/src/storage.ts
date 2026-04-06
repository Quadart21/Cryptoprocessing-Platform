const TOKEN_KEY = "cryptoprocessing_access_token";
const CSRF_TOKEN_KEY = "cryptoprocessing_csrf_token";

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


import { resolveApiBaseUrl } from "../config/apiBase";
import {
  clearAccessToken,
  clearRefreshToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "../storage";

const API_BASE_URL = resolveApiBaseUrl();

export const ACCESS_TOKEN_REFRESHED_EVENT = "noren:access-token-refreshed";

let refreshInFlight: Promise<string | null> | null = null;

function isAuthRefreshPath(path: string): boolean {
  return path.includes("/client/auth/login") || path.includes("/client/auth/refresh");
}

export function shouldAttemptSessionRefresh(path: string, status: number): boolean {
  return status === 401 && !isAuthRefreshPath(path) && Boolean(getRefreshToken());
}

/** Flatten HeadersInit so object spreads keep Authorization (Headers spread is empty). */
export function headersInitToRecord(init?: HeadersInit): Record<string, string> {
  const record: Record<string, string> = {};
  if (!init) {
    return record;
  }
  new Headers(init).forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

function notifyAccessTokenRefreshed(accessToken: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(ACCESS_TOKEN_REFRESHED_EVENT, { detail: { accessToken } }),
  );
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/client/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) {
        clearAccessToken();
        clearRefreshToken();
        return null;
      }
      const payload = (await response.json()) as {
        access_token?: string;
        refresh_token?: string;
      };
      const accessToken = payload.access_token?.trim() ?? "";
      const nextRefresh = payload.refresh_token?.trim() ?? "";
      if (!accessToken || !nextRefresh) {
        clearAccessToken();
        clearRefreshToken();
        return null;
      }
      setAccessToken(accessToken);
      setRefreshToken(nextRefresh);
      notifyAccessTokenRefreshed(accessToken);
      return accessToken;
    } catch {
      clearAccessToken();
      clearRefreshToken();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export function withRefreshedAuthorization(
  init: RequestInit | undefined,
  accessToken: string,
): RequestInit {
  const headers = headersInitToRecord(init?.headers);
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === "authorization") {
      delete headers[key];
    }
  }
  headers.Authorization = `Bearer ${accessToken}`;
  return { ...init, headers };
}

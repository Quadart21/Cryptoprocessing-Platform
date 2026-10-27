import { resolveApiBaseUrl } from "../config/apiBase";
import {
  clearAccessToken,
  clearRefreshToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "../storage";

const API_BASE_URL = resolveApiBaseUrl();

let refreshInFlight: Promise<string | null> | null = null;

function isAuthRefreshPath(path: string): boolean {
  return path.includes("/client/auth/login") || path.includes("/client/auth/refresh");
}

export function shouldAttemptSessionRefresh(path: string, status: number): boolean {
  return status === 401 && !isAuthRefreshPath(path) && Boolean(getRefreshToken());
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
  const headers = new Headers(init?.headers ?? {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  return { ...init, headers };
}

import { useState } from "react";

import type { CurrentUser } from "../api";
import { consumeAuthHandoffFromUrl } from "../config/authHandoff";
import {
  clearAccessToken,
  clearCsrfToken,
  clearRefreshToken,
  getAccessToken,
  getCsrfToken,
  setAccessToken,
  setCsrfToken,
  setRefreshToken,
} from "../storage";

function readInitialSession(): { token: string | null; csrf: string | null } {
  const handoff = consumeAuthHandoffFromUrl();
  if (handoff.accessToken) {
    setAccessToken(handoff.accessToken);
    if (handoff.csrfToken) {
      setCsrfToken(handoff.csrfToken);
    }
    return {
      token: handoff.accessToken,
      csrf: handoff.csrfToken ?? getCsrfToken(),
    };
  }
  return {
    token: getAccessToken(),
    csrf: getCsrfToken(),
  };
}

export function useSession() {
  const initialSession = readInitialSession();
  const [token, setToken] = useState<string | null>(initialSession.token);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [csrfToken, setCsrfTokenState] = useState<string | null>(initialSession.csrf);

  function applyAccessToken(accessToken: string, refreshToken?: string | null) {
    setAccessToken(accessToken);
    setToken(accessToken);
    if (refreshToken && refreshToken.trim()) {
      setRefreshToken(refreshToken.trim());
    }
  }

  function applyCsrfToken(csrf: string) {
    setCsrfToken(csrf);
    setCsrfTokenState(csrf);
  }

  function clearSession() {
    clearAccessToken();
    clearRefreshToken();
    clearCsrfToken();
    setToken(null);
    setUser(null);
    setCsrfTokenState(null);
  }

  return {
    token,
    user,
    setUser,
    setToken,
    applyAccessToken,
    applyCsrfToken,
    csrfToken,
    clearSession,
  };
}

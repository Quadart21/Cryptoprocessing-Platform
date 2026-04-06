import { useState } from "react";

import type { CurrentUser } from "../api";
import { clearAccessToken, clearCsrfToken, getAccessToken, getCsrfToken, setAccessToken, setCsrfToken } from "../storage";

export function useSession() {
  const [token, setToken] = useState<string | null>(() => getAccessToken());
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [csrfToken, setCsrfTokenState] = useState<string | null>(() => getCsrfToken());

  function applyAccessToken(accessToken: string) {
    setAccessToken(accessToken);
    setToken(accessToken);
  }

  function applyCsrfToken(csrf: string) {
    setCsrfToken(csrf);
    setCsrfTokenState(csrf);
  }

  function clearSession() {
    clearAccessToken();
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

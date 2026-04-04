import { useState } from "react";

import type { CurrentUser } from "../api";
import { clearAccessToken, getAccessToken, setAccessToken } from "../storage";

export function useSession() {
  const [token, setToken] = useState<string | null>(() => getAccessToken());
  const [user, setUser] = useState<CurrentUser | null>(null);

  function applyAccessToken(accessToken: string) {
    setAccessToken(accessToken);
    setToken(accessToken);
  }

  function clearSession() {
    clearAccessToken();
    setToken(null);
    setUser(null);
  }

  return {
    token,
    user,
    setUser,
    setToken,
    applyAccessToken,
    clearSession,
  };
}

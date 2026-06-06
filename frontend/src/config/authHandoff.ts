const HANDOFF_PREFIX = "cp_handoff=";

type AuthHandoffPayload = {
  t: string;
  c?: string | null;
};

function encodePayload(payload: AuthHandoffPayload): string {
  const json = JSON.stringify(payload);
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodePayload(encoded: string): AuthHandoffPayload {
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return JSON.parse(atob(`${normalized}${padding}`)) as AuthHandoffPayload;
}

export function buildAuthHandoffUrl(
  targetUrl: string,
  accessToken: string,
  csrfToken?: string | null,
): string {
  const url = new URL(
    targetUrl,
    typeof window !== "undefined" ? window.location.origin : "https://localhost",
  );
  url.hash = `${HANDOFF_PREFIX}${encodePayload({ t: accessToken, c: csrfToken ?? null })}`;
  return url.toString();
}

export function consumeAuthHandoffFromUrl(): {
  accessToken: string | null;
  csrfToken: string | null;
} {
  if (typeof window === "undefined") {
    return { accessToken: null, csrfToken: null };
  }

  const rawHash = window.location.hash.replace(/^#/, "");
  if (!rawHash.startsWith(HANDOFF_PREFIX)) {
    return { accessToken: null, csrfToken: null };
  }

  try {
    const parsed = decodePayload(rawHash.slice(HANDOFF_PREFIX.length));
    const accessToken = typeof parsed.t === "string" && parsed.t.trim() ? parsed.t : null;
    const csrfToken = typeof parsed.c === "string" && parsed.c.trim() ? parsed.c : null;
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
    return { accessToken, csrfToken };
  } catch {
    return { accessToken: null, csrfToken: null };
  }
}

export function isCrossOriginUrl(targetUrl: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const target = new URL(targetUrl, window.location.origin);
    return target.origin !== window.location.origin;
  } catch {
    return true;
  }
}

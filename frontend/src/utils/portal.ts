export type PortalMode = "admin" | "merchant";

function isIpHost(hostname: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
}

export function detectPortalMode(hostnameInput?: string): PortalMode {
  if (typeof window === "undefined" && !hostnameInput) {
    return "merchant";
  }
  const hostname = (hostnameInput ?? window.location.hostname).trim().toLowerCase();
  if (hostname === "admin" || hostname.startsWith("admin.")) {
    return "admin";
  }
  return "merchant";
}

export function buildPortalUrl(target: PortalMode, hostnameInput?: string): string | null {
  if (typeof window === "undefined" && !hostnameInput) {
    return null;
  }
  const hostname = (hostnameInput ?? window.location.hostname).trim().toLowerCase();
  const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
  const port = typeof window !== "undefined" && window.location.port ? `:${window.location.port}` : "";

  if (!hostname || hostname === "localhost" || isIpHost(hostname)) {
    return null;
  }

  if (target === "admin") {
    if (hostname.startsWith("admin.")) {
      return null;
    }
    return `${protocol}//admin.${hostname}${port}`;
  }

  if (!hostname.startsWith("admin.")) {
    return null;
  }
  const merchantHost = hostname.replace(/^admin\./, "");
  if (!merchantHost) {
    return null;
  }
  return `${protocol}//${merchantHost}${port}`;
}

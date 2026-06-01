import { resolveApiBaseUrl } from "../config/apiBase";

export type PublicPayment = {
  status: string;
  amount_crypto: string;
  crypto_currency: string;
  network: string;
  amount_fiat: string;
  fiat_currency: string;
  payment_address: string;
  qr_url: string | null;
  expires_at: string;
  merchant_order_id: string;
  merchant_name: string | null;
  return_url_success: string | null;
  return_url_failed: string | null;
};

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string };
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }
  } catch {
    // ignore
  }
  return `HTTP ${response.status}`;
}

export async function fetchPublicPayment(token: string): Promise<PublicPayment> {
  const response = await fetch(`${resolveApiBaseUrl()}/public/pay/${encodeURIComponent(token)}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json() as Promise<PublicPayment>;
}

export async function refreshPublicPayment(token: string): Promise<PublicPayment> {
  const response = await fetch(
    `${resolveApiBaseUrl()}/public/pay/${encodeURIComponent(token)}/refresh`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    },
  );
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json() as Promise<PublicPayment>;
}

export function resolvePayPageToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const match = window.location.pathname.match(/^\/pay\/([^/]+)\/?$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

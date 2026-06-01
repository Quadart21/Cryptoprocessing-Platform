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

export class PublicPaymentError extends Error {
  readonly status: number;
  readonly retryAfterSeconds: number | null;

  constructor(message: string, status: number, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "PublicPaymentError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isRateLimitedPaymentError(error: unknown): error is PublicPaymentError {
  return error instanceof PublicPaymentError && error.status === 429;
}

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

function parseRetryAfterSeconds(response: Response): number | null {
  const raw = response.headers.get("Retry-After");
  if (!raw) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function readPaymentResponse(response: Response): Promise<PublicPayment> {
  if (!response.ok) {
    throw new PublicPaymentError(
      await parseError(response),
      response.status,
      response.status === 429 ? parseRetryAfterSeconds(response) : null,
    );
  }
  return response.json() as Promise<PublicPayment>;
}

export async function fetchPublicPayment(token: string): Promise<PublicPayment> {
  const response = await fetch(`${resolveApiBaseUrl()}/public/pay/${encodeURIComponent(token)}`, {
    headers: { Accept: "application/json" },
  });
  return readPaymentResponse(response);
}

export async function refreshPublicPayment(token: string): Promise<PublicPayment> {
  const response = await fetch(
    `${resolveApiBaseUrl()}/public/pay/${encodeURIComponent(token)}/refresh`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    },
  );
  return readPaymentResponse(response);
}

export function resolvePayPageToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const match = window.location.pathname.match(/^\/pay\/([^/]+)\/?$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

import { NorenError, NorenSignatureError } from "./errors.js";
import { headerValue, verifyAndParse } from "./webhooks.js";

export const DEFAULT_BASE_URL = "https://api.noren.digital/api/v1/client";
const USER_AGENT = "noren-merchant-node/0.1.0";

/**
 * Accept a host, `/api/v1`, or the full client base URL.
 * @param {string | null | undefined} baseUrl
 */
export function normalizeBaseUrl(baseUrl) {
  const value = String(baseUrl ?? DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  if (!value) return DEFAULT_BASE_URL;
  if (value.endsWith("/api/v1/client")) return value;
  if (value.endsWith("/api/v1")) return `${value}/client`;
  return `${value}/api/v1/client`;
}

/**
 * @param {string | number} value
 */
export function money(value) {
  if (typeof value === "string") {
    const text = value.trim();
    if (!/^\d+(\.\d+)?$/.test(text)) {
      throw new TypeError(`amount is not a decimal: ${value}`);
    }
    return text;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("amount is not a finite number");
    return String(value);
  }
  throw new TypeError("amount must be a string or number");
}

/**
 * @param {string} value
 */
function pathSegment(value) {
  const text = String(value ?? "").trim();
  if (!text || text.includes("/") || text === "." || text === "..") {
    throw new TypeError("id must be a single path segment");
  }
  return encodeURIComponent(text);
}

export class NorenClient {
  /**
   * Secret key stays on the server.
   * @param {{
   *   publicKey?: string,
   *   secretKey?: string,
   *   public_key?: string,
   *   secret_key?: string,
   *   projectId?: string | null,
   *   project_id?: string | null,
   *   baseUrl?: string | null,
   *   base_url?: string | null,
   *   webhookSecret?: string | null,
   *   webhook_secret?: string | null,
   *   timeoutMs?: number,
   *   fetchImpl?: typeof fetch,
   * }} options
   */
  constructor(options = {}) {
    const publicKey = options.publicKey ?? options.public_key;
    const secretKey = options.secretKey ?? options.secret_key;
    if (!publicKey || !secretKey) {
      throw new TypeError("publicKey and secretKey are required");
    }
    this.publicKey = publicKey;
    this.secretKey = secretKey;
    this.projectId = options.projectId ?? options.project_id ?? null;
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? options.base_url);
    this.webhookSecret = options.webhookSecret ?? options.webhook_secret ?? null;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (typeof this.fetchImpl !== "function") {
      throw new TypeError("fetch is not available; pass fetchImpl or use Node 18+");
    }
  }

  /**
   * Reads NOREN_PUBLIC_KEY, NOREN_SECRET_KEY, and optional
   * NOREN_PROJECT_ID, NOREN_API_BASE, NOREN_WEBHOOK_SECRET.
   * @param {NodeJS.ProcessEnv} [env]
   */
  static fromEnv(env = process.env) {
    return new NorenClient({
      publicKey: env.NOREN_PUBLIC_KEY,
      secretKey: env.NOREN_SECRET_KEY,
      projectId: env.NOREN_PROJECT_ID || null,
      baseUrl: env.NOREN_API_BASE || null,
      webhookSecret: env.NOREN_WEBHOOK_SECRET || null,
    });
  }

  health() {
    return this.#request("GET", "/health");
  }

  /**
   * @param {{
   *   merchantOrderId?: string,
   *   merchant_order_id?: string,
   *   amountFiat?: string | number,
   *   amount_fiat?: string | number,
   *   projectId?: string,
   *   project_id?: string,
   *   fiatCurrency?: string,
   *   fiat_currency?: string,
   *   cryptoCurrency?: string,
   *   crypto_currency?: string,
   *   network?: string,
   *   metadata?: Record<string, unknown>,
   * }} input
   */
  async createInvoice(input) {
    const projectId = input.projectId ?? input.project_id ?? this.projectId;
    const merchantOrderId = input.merchantOrderId ?? input.merchant_order_id;
    const amountFiat = input.amountFiat ?? input.amount_fiat;
    if (!projectId) throw new TypeError("projectId is required");
    if (!merchantOrderId || !String(merchantOrderId).trim()) {
      throw new TypeError("merchantOrderId is required");
    }
    if (amountFiat == null) throw new TypeError("amountFiat is required");
    /** @type {Record<string, unknown>} */
    const body = {
      project_id: projectId,
      merchant_order_id: String(merchantOrderId),
      amount_fiat: money(amountFiat),
      fiat_currency: input.fiatCurrency ?? input.fiat_currency ?? "USD",
      crypto_currency: input.cryptoCurrency ?? input.crypto_currency ?? "USDT",
      network: input.network ?? "TRC20",
    };
    if (input.metadata != null) body.metadata = input.metadata;
    return this.#request("POST", "/invoices", { body });
  }

  /**
   * @param {string} invoiceId
   * @param {{ sync?: boolean }} [options]
   */
  async getInvoice(invoiceId, options = {}) {
    const query = options.sync ? { sync: "true" } : undefined;
    return this.#request("GET", `/invoices/${pathSegment(invoiceId)}`, { query });
  }

  /**
   * @param {{ limit?: number, offset?: number, sync?: boolean }} [options]
   */
  async listInvoices(options = {}) {
    /** @type {Record<string, string>} */
    const query = {
      limit: String(options.limit ?? 50),
      offset: String(options.offset ?? 0),
    };
    if (options.sync) query.sync = "true";
    const payload = await this.#request("GET", "/invoices", { query });
    if (!Array.isArray(payload)) {
      throw new NorenError("Invoice list response must be a JSON array.");
    }
    return payload;
  }

  /**
   * @param {string} invoiceId
   */
  async syncInvoice(invoiceId) {
    return this.#request("POST", `/invoices/${pathSegment(invoiceId)}/sync`);
  }

  /**
   * Credit an underpaid invoice for the amount that actually arrived.
   * @param {string} invoiceId
   */
  async acceptReceived(invoiceId) {
    return this.#request("POST", `/invoices/${pathSegment(invoiceId)}/accept-received`);
  }

  getRates() {
    return this.#request("GET", "/rates");
  }

  getBalance() {
    return this.#request("GET", "/balance");
  }

  /**
   * @param {{ limit?: number, offset?: number }} [options]
   */
  async listTransactions(options = {}) {
    const payload = await this.#request("GET", "/transactions", {
      query: {
        limit: String(options.limit ?? 50),
        offset: String(options.offset ?? 0),
      },
    });
    if (!Array.isArray(payload)) {
      throw new NorenError("Transaction list response must be a JSON array.");
    }
    return payload;
  }

  /**
   * @param {string} transactionId
   */
  async getTransaction(transactionId) {
    return this.#request("GET", `/transactions/${pathSegment(transactionId)}`);
  }

  /**
   * @param {Buffer | Uint8Array | string} rawBody
   * @param {string | null | undefined} signatureHeader
   * @param {{
   *   headers?: Record<string, string | string[] | undefined>,
   *   toleranceSeconds?: number | null,
   *   webhookSecret?: string | null,
   * }} [options]
   */
  parseWebhook(rawBody, signatureHeader, options = {}) {
    const secret = options.webhookSecret ?? this.webhookSecret;
    if (!secret) throw new NorenSignatureError("webhookSecret is not configured");
    let signature = signatureHeader ?? null;
    let timestamp = null;
    if (options.headers) {
      if (signature == null) signature = headerValue(options.headers, "X-Merset-Signature");
      timestamp = headerValue(options.headers, "X-Merset-Timestamp");
    }
    return verifyAndParse(rawBody, signature, secret, {
      timestampHeader: timestamp,
      toleranceSeconds: options.toleranceSeconds,
    });
  }

  /**
   * @param {string} method
   * @param {string} path
   * @param {{ query?: Record<string, string>, body?: Record<string, unknown> }} [options]
   */
  async #request(method, path, options = {}) {
    const url = new URL(this.baseUrl + path);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        url.searchParams.set(key, value);
      }
    }
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-API-Key": this.publicKey,
      "X-API-Secret": this.secretKey,
      "User-Agent": USER_AGENT,
    };
    /** @type {RequestInit} */
    const init = { method, headers };
    if (options.body != null) {
      init.body = JSON.stringify(options.body);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    init.signal = controller.signal;

    let response;
    try {
      response = await this.fetchImpl(url, init);
    } catch (error) {
      const aborted = error && typeof error === "object" && "name" in error && error.name === "AbortError";
      throw new NorenError(aborted ? "API request timed out" : `API request failed: ${error}`);
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let payload = null;
    if (text.trim()) {
      try {
        payload = JSON.parse(text);
      } catch {
        throw new NorenError(`Invalid JSON response (HTTP ${response.status})`, {
          statusCode: response.status,
          body: text,
        });
      }
    }
    if (response.status >= 400) {
      const { message, code, detail } = errorParts(payload, text);
      throw new NorenError(`API error HTTP ${response.status}: ${message}`, {
        statusCode: response.status,
        code,
        detail,
        body: text,
      });
    }
    return payload;
  }
}

/**
 * @param {unknown} payload
 * @param {string} raw
 */
function errorParts(payload, raw) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { message: raw.slice(0, 500) || "empty error body", code: null, detail: payload };
  }
  const record = /** @type {Record<string, unknown>} */ (payload);
  const detail = "detail" in record ? record.detail : record;
  let code = typeof record.code === "string" ? record.code : null;
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const nested = /** @type {Record<string, unknown>} */ (detail);
    if (typeof nested.code === "string") code = nested.code;
    const message = typeof nested.message === "string" && nested.message
      ? nested.message
      : JSON.stringify(detail);
    return { message, code, detail };
  }
  if (typeof detail === "string" && detail) {
    return { message: detail, code, detail };
  }
  return { message: JSON.stringify(payload), code, detail };
}

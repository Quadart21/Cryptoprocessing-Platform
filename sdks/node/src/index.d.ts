export const VERSION: string;
export const DEFAULT_BASE_URL: string;
export const SIGNATURE_HEADER: string;
export const EVENT_HEADER: string;
export const EVENT_ID_HEADER: string;
export const TIMESTAMP_HEADER: string;

export class NorenError extends Error {
  statusCode: number | null;
  code: string | null;
  detail: unknown;
  body: string | null;
}

export class NorenSignatureError extends NorenError {}

export interface NorenClientOptions {
  publicKey?: string;
  secretKey?: string;
  public_key?: string;
  secret_key?: string;
  projectId?: string | null;
  project_id?: string | null;
  baseUrl?: string | null;
  base_url?: string | null;
  webhookSecret?: string | null;
  webhook_secret?: string | null;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface InvoiceInput {
  merchantOrderId?: string;
  merchant_order_id?: string;
  amountFiat?: string | number;
  amount_fiat?: string | number;
  projectId?: string;
  project_id?: string;
  fiatCurrency?: string;
  fiat_currency?: string;
  cryptoCurrency?: string;
  crypto_currency?: string;
  network?: string;
  metadata?: Record<string, unknown>;
}

export interface JsonObject {
  [key: string]: unknown;
}

export interface WebhookHeaders {
  [key: string]: string | string[] | undefined;
}

export declare function normalizeBaseUrl(baseUrl?: string | null): string;
export declare function money(value: string | number): string;

export declare class NorenClient {
  publicKey: string;
  secretKey: string;
  projectId: string | null;
  baseUrl: string;
  webhookSecret: string | null;
  timeoutMs: number;
  constructor(options: NorenClientOptions);
  static fromEnv(env?: NodeJS.ProcessEnv): NorenClient;
  health(): Promise<JsonObject>;
  createInvoice(input: InvoiceInput): Promise<JsonObject>;
  getInvoice(invoiceId: string, options?: { sync?: boolean }): Promise<JsonObject>;
  listInvoices(options?: { limit?: number; offset?: number; sync?: boolean }): Promise<JsonObject[]>;
  syncInvoice(invoiceId: string): Promise<JsonObject>;
  acceptReceived(invoiceId: string): Promise<JsonObject>;
  getRates(): Promise<JsonObject>;
  getBalance(): Promise<JsonObject>;
  listTransactions(options?: { limit?: number; offset?: number }): Promise<JsonObject[]>;
  getTransaction(transactionId: string): Promise<JsonObject>;
  parseWebhook(
    rawBody: Buffer | Uint8Array | string,
    signatureHeader?: string | null,
    options?: {
      headers?: WebhookHeaders;
      toleranceSeconds?: number | null;
      webhookSecret?: string | null;
    },
  ): JsonObject;
}

export declare function headerValue(headers: WebhookHeaders | null | undefined, name: string): string | null;
export declare function verifyWebhookSignature(
  rawBody: Buffer | Uint8Array | string,
  signatureHeader: string | null | undefined,
  webhookSecret: string,
): boolean;
export declare function parseWebhook(rawBody: Buffer | Uint8Array | string): JsonObject;
export declare function verifyAndParse(
  rawBody: Buffer | Uint8Array | string,
  signatureHeader: string | null | undefined,
  webhookSecret: string,
  options?: { timestampHeader?: string | null; toleranceSeconds?: number | null; now?: Date },
): JsonObject;
export declare function isPaidStatus(status: string | null | undefined): boolean;
export declare function isUnderpaidStatus(status: string | null | undefined): boolean;
export declare function isFailedStatus(status: string | null | undefined): boolean;
export declare function isSettledStatus(
  status: string | null | undefined,
  amountReview?: { credited?: boolean } | null,
): boolean;

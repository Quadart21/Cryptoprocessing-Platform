import { createHmac, timingSafeEqual } from "node:crypto";

import { NorenError, NorenSignatureError } from "./errors.js";

export const SIGNATURE_HEADER = "X-Merset-Signature";
export const EVENT_HEADER = "X-Merset-Event";
export const EVENT_ID_HEADER = "X-Merset-Event-Id";
export const TIMESTAMP_HEADER = "X-Merset-Timestamp";

/** Money is credited and the order can be fulfilled. */
export const PAID_STATUSES = new Set(["paid", "confirmed", "overpaid"]);
/** Deposit is short. The invoice stays open until a top-up or accept-received. */
export const UNDERPAID_STATUSES = new Set(["underpaid"]);
export const FAILED_STATUSES = new Set(["expired", "cancelled", "canceled", "failed"]);

/**
 * @param {Record<string, string | string[] | undefined> | null | undefined} headers
 * @param {string} name
 * @returns {string | null}
 */
export function headerValue(headers, name) {
  if (!headers) return null;
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== target || value == null || value === "") continue;
    const picked = Array.isArray(value) ? value[0] : value;
    if (picked == null || picked === "") continue;
    return String(picked);
  }
  return null;
}

/**
 * HMAC-SHA256 of the raw body. Re-encoding JSON before the check will fail.
 * @param {Buffer | Uint8Array | string} rawBody
 * @param {string | null | undefined} signatureHeader
 * @param {string} webhookSecret
 */
export function verifyWebhookSignature(rawBody, signatureHeader, webhookSecret) {
  if (!signatureHeader || !webhookSecret) return false;
  const signature = String(signatureHeader).trim();
  const prefix = "sha256=";
  if (!signature.toLowerCase().startsWith(prefix)) return false;
  const digest = signature.slice(prefix.length);
  if (!/^[0-9a-fA-F]{64}$/.test(digest)) return false;

  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  const expected = createHmac("sha256", webhookSecret).update(body).digest("hex");
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(digest.toLowerCase(), "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * @param {Buffer | Uint8Array | string} rawBody
 * @returns {Record<string, unknown>}
 */
export function parseWebhook(rawBody) {
  const text = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : Buffer.from(rawBody).toString("utf8");
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new NorenError("Webhook body is not valid JSON.");
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new NorenError("Webhook body must be a JSON object.");
  }
  return payload;
}

/**
 * @param {string} value
 */
function parseTimestamp(value) {
  const parsed = new Date(String(value).trim());
  if (Number.isNaN(parsed.getTime())) {
    throw new NorenSignatureError("Webhook timestamp format is invalid.");
  }
  return parsed;
}

/**
 * @param {Buffer | Uint8Array | string} rawBody
 * @param {string | null | undefined} signatureHeader
 * @param {string} webhookSecret
 * @param {{ timestampHeader?: string | null, toleranceSeconds?: number | null, now?: Date }} [options]
 */
export function verifyAndParse(rawBody, signatureHeader, webhookSecret, options = {}) {
  if (!verifyWebhookSignature(rawBody, signatureHeader, webhookSecret)) {
    throw new NorenSignatureError("Webhook signature verification failed.");
  }

  const tolerance = options.toleranceSeconds;
  if (tolerance != null) {
    if (tolerance < 0) throw new TypeError("toleranceSeconds must be >= 0");
    if (!options.timestampHeader) {
      throw new NorenSignatureError("Webhook timestamp is missing.");
    }
    const deliveredAt = parseTimestamp(options.timestampHeader);
    const current = options.now ?? new Date();
    const skew = Math.abs(current.getTime() - deliveredAt.getTime()) / 1000;
    if (skew > tolerance) {
      throw new NorenSignatureError("Webhook timestamp is outside the allowed window.");
    }
  }

  return parseWebhook(rawBody);
}

/** @param {string | null | undefined} status */
export function isPaidStatus(status) {
  return PAID_STATUSES.has(normalizeStatus(status));
}

/** @param {string | null | undefined} status */
export function isUnderpaidStatus(status) {
  return UNDERPAID_STATUSES.has(normalizeStatus(status));
}

/** @param {string | null | undefined} status */
export function isFailedStatus(status) {
  return FAILED_STATUSES.has(normalizeStatus(status));
}

/**
 * Underpaid counts only after amount_review.credited is true.
 * @param {string | null | undefined} status
 * @param {{ credited?: boolean } | null | undefined} [amountReview]
 */
export function isSettledStatus(status, amountReview) {
  const normalized = normalizeStatus(status);
  if (PAID_STATUSES.has(normalized)) return true;
  if (UNDERPAID_STATUSES.has(normalized) && amountReview?.credited === true) return true;
  return false;
}

/** @param {string | null | undefined} status */
function normalizeStatus(status) {
  return String(status ?? "").trim().toLowerCase();
}

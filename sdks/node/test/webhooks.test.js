import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  NorenClient,
  NorenSignatureError,
  isFailedStatus,
  isPaidStatus,
  isSettledStatus,
  isUnderpaidStatus,
  verifyAndParse,
  verifyWebhookSignature,
} from "../src/index.js";

const SECRET = "merchant-webhook-secret";
const BODY = JSON.stringify({
  event: "invoice.confirmed",
  event_id: "evt_1",
  invoice: { id: "inv_1", status: "confirmed", merchant_order_id: "order-1" },
});

function sign(body, secret = SECRET) {
  const digest = createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${digest}`;
}

test("signature uses the raw body", () => {
  const signature = sign(BODY);
  assert.equal(verifyWebhookSignature(BODY, signature, SECRET), true);
  const pretty = JSON.stringify(JSON.parse(BODY), null, 2);
  assert.equal(verifyWebhookSignature(pretty, signature, SECRET), false);
});

test("wrong secret and tamper", () => {
  const signature = sign(BODY);
  assert.equal(verifyWebhookSignature(BODY, signature, "other"), false);
  assert.equal(verifyWebhookSignature(`${BODY} `, signature, SECRET), false);
  assert.equal(verifyWebhookSignature(BODY, "sha256=abcd", SECRET), false);
  assert.equal(verifyWebhookSignature(BODY, null, SECRET), false);
});

test("header case and tolerance", () => {
  const signature = sign(BODY);
  const sentAt = new Date("2026-11-02T12:00:00.000Z");
  const event = verifyAndParse(BODY, signature, SECRET, {
    timestampHeader: sentAt.toISOString(),
    toleranceSeconds: 300,
    now: new Date(sentAt.getTime() + 20_000),
  });
  assert.equal(event.event_id, "evt_1");

  const client = new NorenClient({
    publicKey: "pk",
    secretKey: "sk",
    webhookSecret: SECRET,
    fetchImpl: async () => new Response("{}", { status: 200 }),
  });
  const parsed = client.parseWebhook(Buffer.from(BODY), null, {
    headers: {
      "x-merset-signature": signature,
      "X-Merset-Timestamp": new Date().toISOString(),
    },
    toleranceSeconds: 300,
  });
  assert.equal(parsed.invoice.status, "confirmed");

  assert.throws(
    () =>
      verifyAndParse(BODY, signature, SECRET, {
        timestampHeader: sentAt.toISOString(),
        toleranceSeconds: 30,
        now: new Date(sentAt.getTime() + 10 * 60 * 1000),
      }),
    NorenSignatureError,
  );
});

test("status helpers", () => {
  assert.equal(isPaidStatus("Confirmed"), true);
  assert.equal(isPaidStatus("overpaid"), true);
  assert.equal(isPaidStatus("underpaid"), false);
  assert.equal(isUnderpaidStatus("underpaid"), true);
  assert.equal(isFailedStatus("cancelled"), true);
  assert.equal(isFailedStatus("canceled"), true);
  assert.equal(isSettledStatus("paid"), true);
  assert.equal(isSettledStatus("underpaid"), false);
  assert.equal(isSettledStatus("underpaid", { credited: true }), true);
  assert.equal(isSettledStatus("underpaid", { credited: false }), false);
});

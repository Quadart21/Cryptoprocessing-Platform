import assert from "node:assert/strict";
import test from "node:test";

import { NorenClient, NorenError, normalizeBaseUrl } from "../src/index.js";

function clientWith(handler) {
  return new NorenClient({
    publicKey: "pk_test",
    secretKey: "sk_test",
    projectId: "prj_1",
    baseUrl: "https://api.noren.digital",
    fetchImpl: async (url, init) => handler(url, init),
  });
}

test("base url normalization", () => {
  assert.equal(normalizeBaseUrl("https://api.noren.digital"), "https://api.noren.digital/api/v1/client");
  assert.equal(normalizeBaseUrl("https://api.noren.digital/api/v1/"), "https://api.noren.digital/api/v1/client");
  assert.equal(
    normalizeBaseUrl("https://api.noren.digital/api/v1/client"),
    "https://api.noren.digital/api/v1/client",
  );
});

test("createInvoice sends keys and string amount", async () => {
  const client = clientWith(async (url, init) => {
    assert.equal(init.method, "POST");
    assert.equal(String(url), "https://api.noren.digital/api/v1/client/invoices");
    assert.equal(init.headers["X-API-Key"], "pk_test");
    assert.equal(init.headers["X-API-Secret"], "sk_test");
    const body = JSON.parse(init.body);
    assert.equal(body.amount_fiat, "100.50");
    assert.equal(body.project_id, "prj_1");
    assert.equal(body.merchant_order_id, "order-1001");
    return new Response(
      JSON.stringify({ id: "inv_1", status: "pending", payment_page_url: "https://noren.digital/pay/abc" }),
      { status: 201 },
    );
  });
  const invoice = await client.createInvoice({
    merchantOrderId: "order-1001",
    amountFiat: "100.50",
    metadata: { source: "test" },
  });
  assert.equal(invoice.payment_page_url, "https://noren.digital/pay/abc");
});

test("API error exposes code", async () => {
  const client = clientWith(async () => {
    return new Response(
      JSON.stringify({
        detail: { code: "amount_out_of_range", message: "Сумма вне диапазона" },
      }),
      { status: 400 },
    );
  });
  await assert.rejects(
    () => client.createInvoice({ merchant_order_id: "order-1", amount_fiat: "1" }),
    (error) => {
      assert.ok(error instanceof NorenError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "amount_out_of_range");
      assert.match(error.message, /диапазона/);
      return true;
    },
  );
});

test("listInvoices query and acceptReceived path", async () => {
  const calls = [];
  const client = clientWith(async (url, init) => {
    calls.push({ url: String(url), method: init.method });
    if (String(url).includes("/accept-received")) {
      return new Response(JSON.stringify({ id: "inv_9", status: "confirmed" }), { status: 200 });
    }
    return new Response("[]", { status: 200 });
  });
  assert.deepEqual(await client.listInvoices({ limit: 2, offset: 4, sync: true }), []);
  assert.match(calls[0].url, /limit=2/);
  assert.match(calls[0].url, /offset=4/);
  assert.match(calls[0].url, /sync=true/);
  const accepted = await client.acceptReceived("inv_9");
  assert.equal(accepted.status, "confirmed");
  assert.match(calls[1].url, /\/invoices\/inv_9\/accept-received$/);
});

test("rejects a path segment with a slash", async () => {
  const client = clientWith(async () => new Response("{}", { status: 200 }));
  await assert.rejects(() => client.getInvoice("../admin"), TypeError);
});

test("fromEnv", () => {
  const client = NorenClient.fromEnv({
    NOREN_PUBLIC_KEY: "pk_env",
    NOREN_SECRET_KEY: "sk_env",
    NOREN_PROJECT_ID: "prj_env",
    NOREN_API_BASE: "https://sandbox.example",
  });
  assert.equal(client.publicKey, "pk_env");
  assert.equal(client.projectId, "prj_env");
  assert.equal(client.baseUrl, "https://sandbox.example/api/v1/client");
});

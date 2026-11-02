/**
 * Create an invoice with the merchant SDK.
 *
 *   NOREN_PUBLIC_KEY, NOREN_SECRET_KEY, NOREN_PROJECT_ID
 *   NOREN_API_BASE (optional)
 *
 *   node examples/create-invoice.mjs
 */

import { randomUUID } from "node:crypto";

import { NorenClient, NorenError } from "../src/index.js";

const client = NorenClient.fromEnv();
const orderId = process.env.NOREN_ORDER_ID || `order-${randomUUID().slice(0, 12)}`;

try {
  const invoice = await client.createInvoice({
    merchantOrderId: orderId,
    amountFiat: process.env.NOREN_INVOICE_AMOUNT || "15",
    cryptoCurrency: process.env.NOREN_CRYPTO || "USDT",
    network: process.env.NOREN_NETWORK || "TRC20",
  });
  console.log(`id:      ${invoice.id}`);
  console.log(`status:  ${invoice.status}`);
  console.log(`order:   ${invoice.merchant_order_id}`);
  console.log(`amount:  ${invoice.amount_crypto} ${invoice.crypto_currency}`);
  if (invoice.payment_page_url) console.log(`pay:     ${invoice.payment_page_url}`);
  if (invoice.payment_address) console.log(`address: ${invoice.payment_address}`);
} catch (error) {
  if (error instanceof NorenError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

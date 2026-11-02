import type { DocsArticle, DocsArticleKey } from "./types";

const articles: Record<DocsArticleKey, DocsArticle> = {
  quickstart: {
    sections: [
      {
        id: "keys",
        title: "Keys",
        blocks: [
          {
            kind: "p",
            text: "The Merchant API takes crypto payments: you create an invoice, the customer pays, and your backend learns about it from a webhook. Every example uses the Base URL. The /api/v1/client prefix is already included.",
          },
          {
            kind: "list",
            ordered: true,
            items: [
              "In the cabinet, open API keys and create a key.",
              "The public key stays visible. The secret is shown once — store it immediately.",
              "Keep both values on the backend only: environment variables or a secret store.",
              "Call GET /rates and pick a currency and network the customer can actually use.",
              "Create a test invoice with POST /invoices and send the customer a link or an address.",
              "Configure the webhook and send a test delivery before live orders.",
            ],
          },
          {
            kind: "note",
            tone: "warn",
            text: "Do not put the secret in a frontend, a mobile app, or a public repository. After a key rotation, update the server config immediately.",
          },
        ],
      },
      {
        id: "auth",
        title: "Authentication",
        blocks: [
          {
            kind: "p",
            text: "Invoices, balance, rates, and transactions are server-to-server. Send two headers on every such request. Header names are case-insensitive; the values must match exactly.",
          },
          {
            kind: "code",
            label: "Headers",
            text: "X-API-Key: <public_key>\nX-API-Secret: <secret_key>",
          },
          {
            kind: "params",
            rows: [
              {
                name: "X-API-Key",
                required: "yes",
                text: "The project public key.",
              },
              {
                name: "X-API-Secret",
                required: "yes",
                text: "The secret key. It authorizes API access. Never send it to the browser.",
              },
            ],
          },
          {
            kind: "p",
            text: "Webhook settings use the cabinet API: POST /auth/login returns a JWT for Authorization: Bearer. Invoices themselves are created with the API key pair, not the cabinet token.",
          },
        ],
      },
      {
        id: "first-invoice",
        title: "First invoice",
        blocks: [
          {
            kind: "p",
            text: "An invoice is a deposit request. You set a fiat amount; the platform quotes the crypto amount. merchant_order_id is your order number — you will reconcile the payment with it.",
          },
          {
            kind: "code",
            label: "Request",
            text: `curl -X POST "{{apiBase}}/invoices" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "<project_id>",
    "merchant_order_id": "order_1001",
    "amount_fiat": 100,
    "fiat_currency": "USD",
    "crypto_currency": "USDT",
    "network": "TRC20"
  }'`,
          },
          {
            kind: "params",
            rows: [
              { name: "project_id", required: "yes", text: "The project bound to this API key. Another project's id returns 400." },
              { name: "merchant_order_id", required: "yes", text: "Your order id, up to 255 characters. Store it next to the payment." },
              { name: "amount_fiat", required: "yes", text: "Amount due in fiat. Must be greater than zero." },
              { name: "fiat_currency", required: "no", text: "Currency of the amount. Defaults to USD." },
              { name: "crypto_currency", required: "no", text: "Token you expect. Defaults to USDT. Take the pair from GET /rates." },
              { name: "network", required: "no", text: "Network, for example TRC20. Defaults to TRC20. It must be listed in rates and available." },
              { name: "metadata", required: "no", text: "Any object for your own reconciliation. It is not echoed in the API response." },
            ],
          },
        ],
      },
      {
        id: "response",
        title: "What the response means",
        blocks: [
          {
            kind: "code",
            label: "Success · 201",
            text: `{
  "id": "inv_01J_DOCS_EXAMPLE",
  "project_id": "<project_id>",
  "merchant_order_id": "order_1001",
  "amount_fiat": "100.00",
  "fiat_currency": "USD",
  "amount_crypto": "100.25",
  "crypto_currency": "USDT",
  "network": "TRC20",
  "payment_page_url": "https://noren.digital/pay/abc123example",
  "checkout_delivery": "payment_page",
  "status": "pending",
  "expires_at": "2026-04-06T11:45:00Z"
}`,
          },
          {
            kind: "p",
            text: "Do not show the whole JSON to the customer. checkout_delivery decides the fields. payment_page gives only payment_page_url. h2h gives payment_address and qr_url, and no hosted link. A platform admin sets the mode; the merchant can see it but cannot switch it.",
          },
          {
            kind: "note",
            tone: "info",
            text: "amount_crypto is the amount the customer must send. The network matters: USDT on another network to this address will not be credited.",
          },
        ],
      },
      {
        id: "statuses",
        title: "Invoice statuses",
        blocks: [
          {
            kind: "p",
            text: "The status is on GET /invoices/{id} and on the webhook. Do not treat the create response as the final payment state.",
          },
          {
            kind: "table",
            headers: ["Status", "Meaning"],
            rows: [
              ["pending", "Invoice created, no transfer seen yet."],
              ["confirming", "Transfer found, waiting for network confirmations."],
              ["paid", "Amount received and being settled. An overpayment is credited here, for the amount that actually arrived."],
              ["confirmed", "Payment confirmed. You can close the order."],
              ["underpaid", "Less than expected arrived. The invoice stays open: the customer tops up the same address, or you accept what already arrived."],
              ["expired", "The invoice window ended with no new payment."],
              ["cancelled", "Invoice cancelled."],
              ["failed", "Error, including the wrong currency or network."],
              ["aml_frozen", "A deposit exists but funds are in compliance review. Do not close the order until the status moves."],
            ],
          },
        ],
      },
      {
        id: "errors",
        title: "Errors",
        blocks: [
          {
            kind: "p",
            text: "An error is an HTTP status plus JSON with detail. Fix 4xx on your side. Retry 5xx and timeouts with a pause.",
          },
          {
            kind: "code",
            label: "Amount out of range · 400",
            text: `{
  "detail": {
    "code": "amount_out_of_range",
    "message": "Amount is outside the allowed range.",
    "currency": "USDT",
    "network": "TRC20",
    "min_amount": "5",
    "max_amount": "5000"
  }
}`,
          },
          {
            kind: "list",
            items: [
              "401 — missing headers or a bad key.",
              "400 — bad body: wrong project_id, empty order id, or an amount outside the /rates limits.",
              "404 — this key cannot see that invoice or transaction.",
              "503 — the API is temporarily down. Retry.",
            ],
          },
        ],
      },
    ],
  },
  invoices: {
    sections: [
      {
        id: "create",
        title: "Create an invoice",
        blocks: [
          {
            kind: "p",
            text: "POST /invoices creates a deposit request. The fiat amount is converted into the crypto currency you choose. Call it from the backend when your order already exists and has a merchant_order_id.",
          },
          {
            kind: "p",
            text: "Auth: X-API-Key and X-API-Secret. Before the first live invoice, check GET /rates. min_deposit is the crypto limit. min_deposit_fiat is the USD guide.",
          },
          {
            kind: "code",
            label: "Request",
            text: `curl -X POST "{{apiBase}}/invoices" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "<project_id>",
    "merchant_order_id": "order_1001",
    "amount_fiat": 100,
    "fiat_currency": "USD",
    "crypto_currency": "USDT",
    "network": "TRC20"
  }'`,
          },
          {
            kind: "params",
            rows: [
              { name: "project_id", required: "yes", text: "Must match the key's project." },
              { name: "merchant_order_id", required: "yes", text: "Your order id. You look the payment up by it." },
              { name: "amount_fiat", required: "yes", text: "Fiat amount, greater than zero." },
              { name: "fiat_currency", required: "no", text: "Defaults to USD." },
              { name: "crypto_currency", required: "no", text: "Defaults to USDT. Use a pair from rates where client_available is true." },
              { name: "network", required: "no", text: "Defaults to TRC20. If the network has memo_required, do not drop the memo." },
            ],
          },
          {
            kind: "p",
            text: "The response id is the invoice_id for later calls. status right after create is usually pending. expires_at is the deadline: after it, do not expect a new transfer if the status is still pending.",
          },
        ],
      },
      {
        id: "list",
        title: "List invoices",
        blocks: [
          {
            kind: "p",
            text: "GET /invoices returns this key's invoices, newest first. Use it for reconciliation and support. For one order's live status, fetch by id.",
          },
          {
            kind: "code",
            label: "Request",
            text: `curl -X GET "{{apiBase}}/invoices?limit=20&offset=0" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "params",
            rows: [
              { name: "limit", required: "no", text: "Page size. Default 50, maximum 200." },
              { name: "offset", required: "no", text: "Offset for the next page. Default 0." },
              { name: "sync", required: "no", text: "true refreshes active invoices with the provider before responding. Slower, and it needs write access. Leave it false for a normal list." },
            ],
          },
        ],
      },
      {
        id: "get",
        title: "One invoice",
        blocks: [
          {
            kind: "p",
            text: "GET /invoices/{invoice_id} returns the current status, payment details, and — once a payment exists — settlement: gross, fee, and net. Use it when the webhook has not arrived yet, or to show the remaining amount on an underpayment.",
          },
          {
            kind: "code",
            label: "Request",
            text: `curl -X GET "{{apiBase}}/invoices/inv_01J_DOCS_EXAMPLE" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "p",
            text: "Query sync=true does the same work as POST /sync: the provider status is pulled into this response. Fine for a manual check. Do not poll it every second. The webhook is the main channel.",
          },
          {
            kind: "code",
            label: "Underpaid fragment",
            text: `{
  "status": "underpaid",
  "amount_review": {
    "kind": "underpaid",
    "expected_amount": "250",
    "received_amount": "249.84",
    "remaining_amount": "0.16",
    "credited": false
  }
}`,
          },
        ],
      },
      {
        id: "sync",
        title: "Sync status",
        blocks: [
          {
            kind: "p",
            text: "POST /invoices/{invoice_id}/sync asks the provider immediately and returns the same object as GET one invoice. Use it when a webhook was lost and the order is still open (pending, confirming, underpaid).",
          },
          {
            kind: "code",
            label: "Request",
            text: `curl -X POST "{{apiBase}}/invoices/inv_01J_DOCS_EXAMPLE/sync" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "note",
            tone: "info",
            text: "A successful sync does not replace the webhook. If the status became confirmed, still make sure you stored the event once, by event_id.",
          },
        ],
      },
      {
        id: "accept",
        title: "Accept an underpayment",
        blocks: [
          {
            kind: "p",
            text: "POST /invoices/{invoice_id}/accept-received credits the amount already received and stops waiting for a top-up. Call it only after the customer chose “keep this amount” on your H2H screen.",
          },
          {
            kind: "list",
            items: [
              "The invoice must be underpaid, and amount_review.received_amount must be known.",
              "On success the status moves to confirming or confirmed, and amount_review.credited becomes true.",
              "If the customer will top up, do not call this. A second transfer to the same address stays on this invoice. The webhook amount is cumulative.",
              "On hosted checkout the payer does this themselves. The button on /pay/{token} calls a public POST and does not use your API keys.",
            ],
          },
          {
            kind: "code",
            label: "Request",
            text: `curl -X POST "{{apiBase}}/invoices/inv_01J_DOCS_EXAMPLE/accept-received" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "note",
            tone: "warn",
            text: "You do not confirm an overpayment separately. It is credited as paid for the amount that arrived.",
          },
        ],
      },
    ],
  },
  checkout: {
    sections: [
      {
        id: "mode",
        title: "Which mode the project uses",
        blocks: [
          {
            kind: "p",
            text: "checkout_delivery decides what you show the payer. The same field is on POST /invoices, on GET, and inside the webhook invoice object.",
          },
          {
            kind: "table",
            headers: ["Mode", "What to give the customer"],
            rows: [
              ["payment_page", "Only payment_page_url. Address and QR stay on that page."],
              ["h2h", "payment_address and qr_url. The API does not return /pay/{token}. You render the screen."],
              ["both", "Every field. Kept for older integrations."],
            ],
          },
          {
            kind: "p",
            text: "The current mode is in the cabinet under Integration → Webhook. A platform admin changes it.",
          },
        ],
      },
      {
        id: "payment-page",
        title: "Hosted payment page",
        blocks: [
          {
            kind: "p",
            text: "The short path is a redirect or button to payment_page_url. /pay/{token} shows the amount, network, QR, timer, and status. You do not poll the chain.",
          },
          {
            kind: "code",
            label: "Response fragment",
            text: `{
  "payment_page_url": "https://noren.digital/pay/abc123example",
  "checkout_delivery": "payment_page"
}`,
          },
          {
            kind: "p",
            text: "If you wrap that page yourself, the public status needs no keys: GET /api/v1/public/pay/{token}. That path is not under the cabinet Base URL — it uses the payment site host.",
          },
        ],
      },
      {
        id: "h2h",
        title: "Your own screen (H2H)",
        blocks: [
          {
            kind: "p",
            text: "H2H is for an address and QR inside your app. Show the network, the exact amount_crypto, the address, and the memo when there is one. Ask the customer to copy the full amount. Rounding “about that much” becomes an underpayment.",
          },
          {
            kind: "code",
            label: "Response fragment",
            text: `{
  "payment_address": "TG9exampleAddress",
  "qr_url": "https://example.com/qr/inv_01J",
  "checkout_delivery": "h2h"
}`,
          },
          {
            kind: "list",
            items: [
              "Do not reuse an address across orders. It belongs to one invoice.",
              "Update status from the webhook. GET is the fallback.",
              "After expires_at, stop presenting the address as payable if the status is still pending.",
            ],
          },
        ],
      },
      {
        id: "underpaid",
        title: "Underpayment on the screen",
        blocks: [
          {
            kind: "p",
            text: "When less arrives, status becomes underpaid. amount_review explains the numbers: expected_amount is what you quoted, received_amount is what has arrived, remaining_amount is the top-up still due.",
          },
          {
            kind: "list",
            items: [
              "On hosted checkout the payer taps “Keep this amount” or sends the rest to the same address.",
              "On H2H show the same choice. “Keep” is POST /invoices/{id}/accept-received.",
              "A top-up does not create a new invoice. The next webhook has the same invoice.id and a cumulative amount.",
            ],
          },
        ],
      },
    ],
  },
  webhooks: {
    sections: [
      {
        id: "events",
        title: "Which events arrive",
        blocks: [
          {
            kind: "p",
            text: "The platform calls your URL when an invoice status changes. That is how you close an order. Do not poll GET in a loop.",
          },
          {
            kind: "table",
            headers: ["event", "When"],
            rows: [
              ["invoice.status_changed", "A live status change: transfer seen, confirmed, underpaid, or cancelled."],
              ["invoice.test_deposit", "A test from the cabinet or POST /webhooks/test. The invoice status is not changed. The body includes simulated: true."],
            ],
          },
          {
            kind: "p",
            text: "The event name is repeated in X-Merset-Event. Handle the body only after the signature checks out.",
          },
        ],
      },
      {
        id: "setup",
        title: "Where to send",
        blocks: [
          {
            kind: "p",
            text: "The URL and secret are per project. This call is cabinet API: the owner JWT and client.webhooks.write, not the payment API key pair.",
          },
          {
            kind: "code",
            label: "Save a webhook",
            text: `curl -X POST "{{apiBase}}/webhooks" \\
  -H "Authorization: Bearer <jwt_access>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "<project_id>",
    "webhook_url": "https://merchant.example.com/webhooks/noren",
    "webhook_secret": "merchant-webhook-secret"
  }'`,
          },
          {
            kind: "p",
            text: "webhook_url must be HTTPS and reachable from the internet. webhook_secret is your string; you use the same string to verify HMAC. Use the same secret as the CMS module if you install a plugin.",
          },
          {
            kind: "code",
            label: "Send a test",
            text: `curl -X POST "{{apiBase}}/webhooks/test" \\
  -H "Authorization: Bearer <jwt_access>" \\
  -H "Content-Type: application/json" \\
  -d '{ "project_id": "<project_id>" }'`,
          },
        ],
      },
      {
        id: "payload",
        title: "Request body",
        blocks: [
          {
            kind: "p",
            text: "The body is compact JSON. invoice fields match the invoice API and follow checkout_delivery: extra payment details are simply omitted.",
          },
          {
            kind: "code",
            label: "invoice.status_changed example",
            text: `{
  "event": "invoice.status_changed",
  "event_id": "wh_01J_DOCS_EXAMPLE",
  "sent_at": "2026-03-30T12:45:00+00:00",
  "invoice": {
    "id": "inv_01J_DOCS_EXAMPLE",
    "merchant_order_id": "order_1001",
    "status": "confirmed",
    "amount_fiat": "100.00",
    "fiat_currency": "USD",
    "amount_crypto": "100.25",
    "crypto_currency": "USDT",
    "network": "TRC20",
    "payment_page_url": "https://noren.digital/pay/abc123example",
    "checkout_delivery": "payment_page"
  },
  "transaction": {
    "id": "tx_01J_DOCS_EXAMPLE",
    "status": "confirmed",
    "gross_amount": "100.00",
    "total_fee": "1.10",
    "net_amount": "98.90",
    "currency": "USDT"
  }
}`,
          },
          {
            kind: "params",
            rows: [
              { name: "event_id", required: "yes", text: "Unique id of this delivery. Store it and ignore a repeat with the same id." },
              { name: "sent_at", required: "yes", text: "Send time, ISO-8601." },
              { name: "invoice.id", required: "yes", text: "Platform invoice. A second deposit on an underpayment keeps this id." },
              { name: "invoice.merchant_order_id", required: "yes", text: "Your order number from POST /invoices." },
              { name: "invoice.status", required: "yes", text: "Current status. Close the order on confirmed (or paid, if that is your policy)." },
              { name: "transaction", required: "no", text: "Present once a ledger row exists. net_amount is what remains after the fee. Null when nothing has been paid." },
            ],
          },
        ],
      },
      {
        id: "signature",
        title: "Signature",
        blocks: [
          {
            kind: "p",
            text: "The signature covers the raw request body, byte for byte. Do not parse JSON and serialize it again. A space or a different key order breaks HMAC.",
          },
          {
            kind: "list",
            ordered: true,
            items: [
              "Read the raw body as UTF-8.",
              "Take the project webhook_secret.",
              "Compute HMAC-SHA256(secret, body) and hex-encode it.",
              "Compare with X-Merset-Signature. The expected form is sha256=<hex>.",
              "Compare in constant time. On mismatch respond 401 and do not credit anything.",
              "If event_id was already handled, respond 2xx and return. Do not apply the payment twice.",
            ],
          },
          {
            kind: "code",
            label: "Check in Python",
            text: `import hmac
import hashlib

def signature_ok(secret: str, raw_body: bytes, header: str) -> bool:
    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    expected = f"sha256={digest}"
    return hmac.compare_digest(expected, header or "")`,
          },
          {
            kind: "table",
            headers: ["Header", "Why"],
            rows: [
              ["Content-Type", "application/json"],
              ["User-Agent", "Merset-Webhook/1.0"],
              ["X-Merset-Event", "Event name, for example invoice.status_changed"],
              ["X-Merset-Event-Id", "Same id as event_id in the body"],
              ["X-Merset-Timestamp", "Send time"],
              ["X-Merset-Signature", "sha256= plus the hex HMAC"],
            ],
          },
          {
            kind: "note",
            tone: "warn",
            text: "Respond 2xx only after you have stored the event. 4xx and 5xx are failures, and the platform retries.",
          },
        ],
      },
      {
        id: "retries",
        title: "Retries",
        blocks: [
          {
            kind: "p",
            text: "Delivery is tried up to three times, with a short pause between attempts. If none return 2xx, the delivery is recorded as failed. The invoice on the platform may already have a new status. Then read it with GET /invoices/{id} or POST /sync.",
          },
          {
            kind: "p",
            text: "A retry can arrive with a new event_id and the same invoice.id. Dedupe the delivery (event_id) and the business operation (do not credit one merchant_order_id twice).",
          },
        ],
      },
    ],
  },
  balance: {
    sections: [
      {
        id: "get",
        title: "Get the balance",
        blocks: [
          {
            kind: "p",
            text: "GET /balance returns the merchant settlement balance in the tenant currency, usually USDT. It is not the customer's wallet and not one invoice. It is what has already been booked to you.",
          },
          {
            kind: "code",
            label: "Request",
            text: `curl -X GET "{{apiBase}}/balance" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "code",
            label: "Success",
            text: `{
  "currency": "USDT",
  "available_amount": "980.50",
  "frozen_amount": "0",
  "pending_amount": "20.00",
  "locked_amount": "0",
  "total_amount": "1000.50",
  "hold_hours": 24,
  "next_release_at": "2026-04-07T11:30:00Z",
  "holds": [
    {
      "transaction_id": "tx_01J_DOCS_EXAMPLE",
      "invoice_id": "inv_01J_DOCS_EXAMPLE",
      "merchant_order_id": "order_1001",
      "amount": "98.90",
      "available_at": "2026-04-07T11:30:00Z"
    }
  ]
}`,
          },
        ],
      },
      {
        id: "fields",
        title: "What the amounts mean",
        blocks: [
          {
            kind: "params",
            rows: [
              { name: "available_amount", required: "yes", text: "Spendable. The amount field repeats this number." },
              { name: "pending_amount", required: "yes", text: "Paid, but still on hold and not available yet." },
              { name: "frozen_amount", required: "yes", text: "Frozen, for example during a review." },
              { name: "locked_amount", required: "yes", text: "Locked for an operation that is not finished." },
              { name: "total_amount", required: "yes", text: "Sum of the four parts above. This is not “how much you can withdraw”." },
              { name: "hold_hours", required: "yes", text: "How many hours a payment stays on hold before it becomes available." },
            ],
          },
          {
            kind: "p",
            text: "A withdrawal to an external address is created in the cabinet, not by this method. The balance API only reads the figures.",
          },
        ],
      },
      {
        id: "holds",
        title: "Holds",
        blocks: [
          {
            kind: "p",
            text: "holds lists payments that are not available yet. amount is already net, after the fee. available_at is when that row is released. next_release_at is the soonest release across the list.",
          },
          {
            kind: "note",
            tone: "info",
            text: "An empty holds list and pending_amount of 0 means nothing is on hold. available_amount can still be above zero.",
          },
        ],
      },
    ],
  },
  transactions: {
    sections: [
      {
        id: "list",
        title: "List operations",
        blocks: [
          {
            kind: "p",
            text: "GET /transactions is the ledger for your tenant: what arrived, which fee was taken, and what was credited. Invoices with no payment do not appear here.",
          },
          {
            kind: "code",
            label: "Request",
            text: `curl -X GET "{{apiBase}}/transactions?limit=20&offset=0" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "params",
            rows: [
              { name: "limit", required: "no", text: "Page size. Default 50, maximum 200." },
              { name: "offset", required: "no", text: "Offset. For the next page, pass how many rows you already received." },
            ],
          },
        ],
      },
      {
        id: "one",
        title: "One operation",
        blocks: [
          {
            kind: "p",
            text: "GET /transactions/{transaction_id} returns the same row as one list item. Take the id from the webhook (transaction.id) or from the list. Another key's id returns 404.",
          },
          {
            kind: "code",
            label: "Request",
            text: `curl -X GET "{{apiBase}}/transactions/tx_01J_DOCS_EXAMPLE" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "code",
            label: "Success",
            text: `{
  "id": "tx_01J_DOCS_EXAMPLE",
  "invoice_id": "inv_01J_DOCS_EXAMPLE",
  "gross_amount": "100.00",
  "total_fee": "1.10",
  "net_amount": "98.90",
  "currency": "USDT",
  "status": "confirmed",
  "invoice_status": "confirmed",
  "paid_at": "2026-04-06T11:40:00Z"
}`,
          },
        ],
      },
      {
        id: "fees",
        title: "Fee on the row",
        blocks: [
          {
            kind: "p",
            text: "Three fields are enough to reconcile. gross_amount is the payment before the fee. total_fee is the platform commission (a percent, but not below the minimum). net_amount is what belongs on the merchant balance: gross minus fee.",
          },
          {
            kind: "p",
            text: "The blockchain network fee is not inside these fields. It depends on TRC20, ERC20, and the other networks and is shown separately in the cabinet. The tariff itself is in Commissions.",
          },
          {
            kind: "note",
            tone: "info",
            text: "A freshly created invoice has no ledger row yet. A zero amount before payment is not an integration bug.",
          },
        ],
      },
    ],
  },
  rates: {
    sections: [
      {
        id: "list",
        title: "Currencies and networks",
        blocks: [
          {
            kind: "p",
            text: "GET /rates says what you can accept right now: currency, network, limits, and availability. Call it before creating an invoice and cache it only briefly. Limits and flags change.",
          },
          {
            kind: "code",
            label: "Request",
            text: `curl -X GET "{{apiBase}}/rates" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "code",
            label: "Response fragment",
            text: `{
  "items": [
    {
      "currency": "USDT",
      "networks": [
        {
          "network": "TRC20",
          "min_deposit": "5",
          "max_deposit": "5000",
          "min_deposit_fiat": "5",
          "max_deposit_fiat": "5000",
          "network_fee": "1",
          "client_available": true,
          "memo_required": false,
          "acquiring": true,
          "withdrawal": true
        }
      ]
    }
  ]
}`,
          },
        ],
      },
      {
        id: "fields",
        title: "How to read a network",
        blocks: [
          {
            kind: "params",
            rows: [
              { name: "currency", required: "yes", text: "Token code. Send it as crypto_currency." },
              { name: "network", required: "yes", text: "Network. Send it as network. USDT on TRC20 and USDT on ERC20 are different routes." },
              { name: "min_deposit / max_deposit", required: "yes", text: "Allowed range in crypto. An invoice outside the range returns amount_out_of_range." },
              { name: "min_deposit_fiat / max_deposit_fiat", required: "no", text: "The same range as a USD guide, so you can check amount_fiat first." },
              { name: "client_available", required: "yes", text: "true — you may offer this pair. false — do not create an invoice, even if the provider is still up." },
              { name: "acquiring", required: "yes", text: "true — accepting payments on this network is on." },
              { name: "withdrawal", required: "yes", text: "true — the network can be used for withdrawals." },
              { name: "memo_required", required: "yes", text: "true — a transfer without the memo or tag is not credited. Show it next to the address." },
              { name: "network_fee", required: "no", text: "A guide for the network fee. This is not the 0.4% platform tariff." },
              { name: "availability_reason", required: "no", text: "A short reason when the pair is off. Keep it for support. For the customer, hide the method." },
            ],
          },
        ],
      },
      {
        id: "choose",
        title: "What to put on the invoice",
        blocks: [
          {
            kind: "list",
            ordered: true,
            items: [
              "Keep networks where client_available and acquiring are true.",
              "Check that amount_fiat sits inside min_deposit_fiat and max_deposit_fiat.",
              "On POST /invoices send currency as crypto_currency and network as network.",
              "If memo_required, do not hide payment_memo from the invoice response on your H2H screen.",
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "An empty items list, or every client_available set to false, means acceptance is closed. Do not fall back to TRC20 out of habit.",
          },
        ],
      },
    ],
  },
  reference: {
    sections: [
      {
        id: "map",
        title: "Where each method lives",
        blocks: [
          {
            kind: "p",
            text: "Each method has its own page: why you call it, the fields, and a request and response example. This is the map.",
          },
          {
            kind: "links",
            items: [
              { to: "/invoices", title: "Invoices", text: "POST /invoices, list, one invoice, sync, and accept underpaid." },
              { to: "/balance", title: "Balance", text: "GET /balance — available, hold, frozen." },
              { to: "/transactions", title: "Transactions", text: "Ledger history and the fee on one row." },
              { to: "/rates", title: "Rates and limits", text: "GET /rates — currencies, networks, min/max." },
              { to: "/webhooks", title: "Webhooks", text: "Body, headers, and the HMAC check." },
              { to: "/checkout", title: "Checkout", text: "The /pay/{token} link, or address and QR." },
            ],
          },
        ],
      },
      {
        id: "auth",
        title: "Which authentication",
        blocks: [
          {
            kind: "table",
            headers: ["Method", "Headers"],
            rows: [
              ["GET /health", "No auth. Response: status ok, scope client."],
              ["POST /invoices, GET /invoices, GET /balance, GET /rates, GET /transactions", "X-API-Key and X-API-Secret"],
              ["POST /invoices/{id}/sync and /accept-received", "The same keys, with invoice write access."],
              ["POST /auth/login", "Body with email and password. Response is access_token."],
              ["POST /webhooks and POST /webhooks/test", "Authorization: Bearer <jwt>"],
            ],
          },
          {
            kind: "p",
            text: "The OpenAPI schema is at /openapi.json on the live API, and the interactive docs are at /docs. Examples in these sections already use your Base URL.",
          },
        ],
      },
    ],
  },
};

export const docsArticlesEn = articles;

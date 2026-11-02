#!/usr/bin/env python3
"""Create an invoice with the merchant SDK.

Environment:
  NOREN_PUBLIC_KEY, NOREN_SECRET_KEY, NOREN_PROJECT_ID
  NOREN_API_BASE (optional, default https://api.noren.digital)
"""

from __future__ import annotations

import os
import sys
import uuid

from noren import NorenClient, NorenError


def main() -> int:
    client = NorenClient.from_env()
    order_id = os.environ.get("NOREN_ORDER_ID") or f"order-{uuid.uuid4().hex[:12]}"
    amount = os.environ.get("NOREN_INVOICE_AMOUNT", "15")
    try:
        invoice = client.create_invoice(
            merchant_order_id=order_id,
            amount_fiat=amount,
            crypto_currency=os.environ.get("NOREN_CRYPTO", "USDT"),
            network=os.environ.get("NOREN_NETWORK", "TRC20"),
        )
    except NorenError as exc:
        print(exc, file=sys.stderr)
        return 1

    print(f"id:        {invoice.get('id')}")
    print(f"status:    {invoice.get('status')}")
    print(f"order:     {invoice.get('merchant_order_id')}")
    print(f"amount:    {invoice.get('amount_crypto')} {invoice.get('crypto_currency')}")
    page = invoice.get("payment_page_url")
    if page:
        print(f"pay:       {page}")
    if invoice.get("payment_address"):
        print(f"address:   {invoice.get('payment_address')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

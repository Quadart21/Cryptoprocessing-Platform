from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from noren import NorenClient, NorenError  # noqa: E402
from noren.client import normalize_base_url  # noqa: E402


def _client(handler):
    def transport(method, url, headers, body):
        return handler(method, url, headers, body)

    return NorenClient(
        public_key="pk_test",
        secret_key="sk_test",
        project_id="prj_1",
        base_url="https://api.noren.digital",
        transport=transport,
    )


class ClientTests(unittest.TestCase):
    def test_base_url_normalization(self):
        self.assertEqual(
            normalize_base_url("https://api.noren.digital"),
            "https://api.noren.digital/api/v1/client",
        )
        self.assertEqual(
            normalize_base_url("https://api.noren.digital/api/v1/"),
            "https://api.noren.digital/api/v1/client",
        )
        self.assertEqual(
            normalize_base_url("https://api.noren.digital/api/v1/client"),
            "https://api.noren.digital/api/v1/client",
        )

    def test_create_invoice_sends_keys_and_amount_as_string(self):
        seen = {}

        def handler(method, url, headers, body):
            seen["method"] = method
            seen["url"] = url
            seen["headers"] = headers
            seen["body"] = json.loads(body.decode())
            payload = {
                "id": "inv_1",
                "status": "pending",
                "payment_page_url": "https://noren.digital/pay/abc",
            }
            return 201, json.dumps(payload).encode()

        invoice = _client(handler).create_invoice(
            merchant_order_id="order-1001",
            amount_fiat="100.50",
            metadata={"source": "test"},
        )
        self.assertEqual(seen["method"], "POST")
        self.assertEqual(seen["url"], "https://api.noren.digital/api/v1/client/invoices")
        self.assertEqual(seen["headers"]["X-API-Key"], "pk_test")
        self.assertEqual(seen["headers"]["X-API-Secret"], "sk_test")
        self.assertEqual(seen["body"]["amount_fiat"], "100.50")
        self.assertEqual(seen["body"]["project_id"], "prj_1")
        self.assertEqual(seen["body"]["crypto_currency"], "USDT")
        self.assertEqual(invoice["payment_page_url"], "https://noren.digital/pay/abc")

    def test_api_error_exposes_code(self):
        def handler(method, url, headers, body):
            payload = {
                "detail": {
                    "code": "amount_out_of_range",
                    "message": "Сумма вне диапазона",
                }
            }
            return 400, json.dumps(payload, ensure_ascii=False).encode()

        with self.assertRaises(NorenError) as caught:
            _client(handler).create_invoice(merchant_order_id="order-1", amount_fiat=1)
        self.assertEqual(caught.exception.status_code, 400)
        self.assertEqual(caught.exception.code, "amount_out_of_range")
        self.assertIn("диапазона", str(caught.exception))

    def test_list_and_sync_query(self):
        def handler(method, url, headers, body):
            self.assertEqual(method, "GET")
            self.assertIn("limit=2", url)
            self.assertIn("offset=4", url)
            self.assertIn("sync=true", url)
            return 200, b"[]"

        self.assertEqual(_client(handler).list_invoices(limit=2, offset=4, sync=True), [])

    def test_accept_received_path(self):
        def handler(method, url, headers, body):
            self.assertEqual(method, "POST")
            self.assertTrue(url.endswith("/invoices/inv_9/accept-received"))
            return 200, b'{"id":"inv_9","status":"confirmed"}'

        invoice = _client(handler).accept_received("inv_9")
        self.assertEqual(invoice["status"], "confirmed")

    def test_rejects_float_amount(self):
        with self.assertRaises(TypeError):
            _client(lambda *args: (200, b"{}")).create_invoice(
                merchant_order_id="order-1",
                amount_fiat=10.5,  # type: ignore[arg-type]
            )

    def test_rejects_path_injection(self):
        with self.assertRaises(ValueError):
            _client(lambda *args: (200, b"{}")).get_invoice("../admin")

    def test_from_env(self):
        import os

        os.environ["NOREN_PUBLIC_KEY"] = "pk_env"
        os.environ["NOREN_SECRET_KEY"] = "sk_env"
        os.environ["NOREN_PROJECT_ID"] = "prj_env"
        os.environ["NOREN_API_BASE"] = "https://sandbox.example"
        try:
            client = NorenClient.from_env()
        finally:
            for key in (
                "NOREN_PUBLIC_KEY",
                "NOREN_SECRET_KEY",
                "NOREN_PROJECT_ID",
                "NOREN_API_BASE",
            ):
                os.environ.pop(key, None)
        self.assertEqual(client.public_key, "pk_env")
        self.assertEqual(client.project_id, "prj_env")
        self.assertEqual(client.base_url, "https://sandbox.example/api/v1/client")


if __name__ == "__main__":
    unittest.main()

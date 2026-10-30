#!/usr/bin/env python3
"""Проверки приёмника вебхуков и подтверждения заказа без сети."""

from __future__ import annotations

import hashlib
import hmac
import json
import tempfile
import threading
import unittest
from pathlib import Path

from noren_telegram_pay_bot import (
    OrderBook,
    load_state,
    make_webhook_handler,
    describe_webhook_dns,
    parse_amount,
    parse_command,
    parse_pay_args,
    payment_keyboard,
    pick_route,
    save_state,
    verify_signature,
    webhook_target,
)


def _invoice(**overrides: object) -> dict:
    payload = {
        "id": "inv_1",
        "merchant_order_id": "tg-order",
        "status": "pending",
        "amount_fiat": "10.00",
        "fiat_currency": "USD",
        "amount_crypto": "10.10",
        "crypto_currency": "USDT",
        "network": "TRC20",
        "payment_page_url": "https://noren.digital/pay/token123",
        "expires_at": "2026-10-30T20:00:00Z",
    }
    payload.update(overrides)
    return payload


class SignatureTests(unittest.TestCase):
    def test_matches_platform_header(self) -> None:
        body = b'{"event":"invoice.confirmed","event_id":"evt_1"}'
        secret = "merchant-webhook-secret"
        digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        self.assertTrue(verify_signature(secret, body, f"sha256={digest}"))

    def test_rejects_tampered_body(self) -> None:
        secret = "merchant-webhook-secret"
        digest = hmac.new(secret.encode(), b"{}", hashlib.sha256).hexdigest()
        self.assertFalse(verify_signature(secret, b'{"event":"x"}', f"sha256={digest}"))

    def test_empty_secret_skips_check(self) -> None:
        self.assertTrue(verify_signature("", b"{}", None))


class OrderFlowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.book = OrderBook()
        self.book.upsert_created(42, _invoice())

    def test_confirm_fulfills_once(self) -> None:
        payload = {
            "event": "invoice.confirmed",
            "event_id": "evt_confirm",
            "invoice": _invoice(status="confirmed"),
            "transaction": {"net_amount": "9.60", "currency": "USDT", "status": "confirmed"},
        }
        first = self.book.apply_webhook(payload)
        second = self.book.apply_webhook(payload)
        self.assertEqual(len(first), 1)
        self.assertIn("подтверждён", first[0].text.lower())
        self.assertIn("9.60", first[0].text)
        self.assertEqual(second, [])
        self.assertTrue(self.book.orders["inv_1"].fulfilled)

    def test_simulated_deposit_does_not_fulfill(self) -> None:
        messages = self.book.apply_webhook(
            {
                "event": "invoice.test_deposit",
                "event_id": "evt_test",
                "simulated": True,
                "invoice": _invoice(status="confirmed"),
            }
        )
        self.assertEqual(len(messages), 1)
        self.assertIn("не закрываю", messages[0].text)
        self.assertFalse(self.book.orders["inv_1"].fulfilled)
        self.assertEqual(self.book.orders["inv_1"].status, "pending")

    def test_confirming_then_paid(self) -> None:
        confirming = self.book.apply_webhook(
            {
                "event": "invoice.confirming",
                "event_id": "evt_c",
                "invoice": _invoice(
                    status="confirming",
                    network_confirmations_actual=2,
                    network_confirmations_required=20,
                ),
            }
        )
        self.assertIn("2/20", confirming[0].text)
        self.assertFalse(self.book.orders["inv_1"].fulfilled)
        paid = self.book.apply_invoice(
            self.book.orders["inv_1"],
            _invoice(status="paid"),
            simulated=False,
        )
        self.assertTrue(self.book.orders["inv_1"].fulfilled)
        self.assertIn("Депозит принят", paid[0].text)

    def test_state_roundtrip(self) -> None:
        self.book.apply_webhook(
            {"event": "invoice.confirmed", "event_id": "evt_save", "invoice": _invoice(status="confirmed")}
        )
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "state.json"
            save_state(path, self.book)
            loaded = load_state(path)
        self.assertTrue(loaded.orders["inv_1"].fulfilled)
        self.assertIn("evt_save", loaded.seen_event_ids)
        self.assertEqual(loaded.apply_webhook(
            {"event": "invoice.confirmed", "event_id": "evt_save", "invoice": _invoice(status="confirmed")}
        ), [])


class WebhookServerTests(unittest.TestCase):
    def test_rejects_bad_signature_and_accepts_valid(self) -> None:
        book = OrderBook()
        book.upsert_created(7, _invoice())
        delivered: list = []
        lock = threading.Lock()
        handler = make_webhook_handler(
            book,
            "secret",
            lock,
            delivered.extend,
            lambda: None,
        )
        body = json.dumps(
            {"event": "invoice.confirmed", "event_id": "evt_http", "invoice": _invoice(status="confirmed")}
        ).encode()
        from http.server import ThreadingHTTPServer
        from urllib.error import HTTPError
        from urllib.request import Request, urlopen

        httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        port = httpd.server_address[1]
        try:
            bad = Request(
                f"http://127.0.0.1:{port}/webhooks/noren",
                data=body,
                method="POST",
                headers={"Content-Type": "application/json", "X-Merset-Signature": "sha256=00"},
            )
            try:
                urlopen(bad, timeout=5)
                self.fail("expected 401")
            except HTTPError as exc:
                self.assertEqual(exc.code, 401)
            digest = hmac.new(b"secret", body, hashlib.sha256).hexdigest()
            good = Request(
                f"http://127.0.0.1:{port}/webhooks/noren",
                data=body,
                method="POST",
                headers={"Content-Type": "application/json", "X-Merset-Signature": f"sha256={digest}"},
            )
            with urlopen(good, timeout=5) as resp:
                payload = json.loads(resp.read().decode())
            self.assertTrue(payload["received"])
            self.assertTrue(book.orders["inv_1"].fulfilled)
            self.assertEqual(len(delivered), 1)
        finally:
            httpd.shutdown()
            httpd.server_close()


class ParseTests(unittest.TestCase):
    def test_command_and_amount(self) -> None:
        self.assertEqual(parse_command("/pay@ShopBot 12 USDT TRC20"), ("pay", "12 USDT TRC20"))
        self.assertEqual(parse_pay_args("12 USDT TRC20", default_amount="10", default_crypto="", default_network=""), ("12", "USDT", "TRC20"))
        self.assertEqual(parse_amount("10,5"), parse_amount("10.5"))

    def test_pick_route_prefers_usdt_trc20(self) -> None:
        rates = {
            "items": [
                {
                    "currency": "DOGE",
                    "networks": [{"network": "DOGE", "client_available": True, "acquiring": True}],
                },
                {
                    "currency": "USDT",
                    "networks": [{"network": "TRC20", "client_available": True, "acquiring": True}],
                },
            ]
        }
        self.assertEqual(pick_route(rates, "", ""), ("USDT", "TRC20"))

    def test_webhook_target_uses_kupik(self) -> None:
        self.assertEqual(webhook_target(""), "https://kupik.asia/webhooks/noren")
        self.assertEqual(webhook_target("https://kupik.asia"), "https://kupik.asia/webhooks/noren")
        self.assertEqual(
            webhook_target("https://kupik.asia/webhooks/noren"),
            "https://kupik.asia/webhooks/noren",
        )

    def test_unresolved_host_explains_dns(self) -> None:
        message = describe_webhook_dns("https://no-such-host.invalid/webhooks/noren")
        self.assertIsNotNone(message)
        assert message is not None
        self.assertIn("A/AAAA", message)

    def test_payment_keyboard(self) -> None:
        keyboard = payment_keyboard(_invoice())
        assert keyboard is not None
        self.assertEqual(keyboard["inline_keyboard"][0][0]["url"], "https://noren.digital/pay/token123")


if __name__ == "__main__":
    unittest.main()

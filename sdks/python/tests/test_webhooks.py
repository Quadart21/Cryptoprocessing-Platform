from __future__ import annotations

import hashlib
import hmac
import json
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from noren import (  # noqa: E402
    NorenClient,
    NorenSignatureError,
    is_failed_status,
    is_paid_status,
    is_settled_status,
    is_underpaid_status,
    verify_and_parse,
    verify_webhook_signature,
)

SECRET = "merchant-webhook-secret"
BODY = json.dumps(
    {
        "event": "invoice.confirmed",
        "event_id": "evt_1",
        "invoice": {"id": "inv_1", "status": "confirmed", "merchant_order_id": "order-1"},
    },
    ensure_ascii=False,
    separators=(",", ":"),
)


def _sign(body: str, secret: str = SECRET) -> str:
    digest = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    return f"sha256={digest}"


class WebhookTests(unittest.TestCase):
    def test_valid_signature_uses_raw_body(self):
        signature = _sign(BODY)
        self.assertTrue(verify_webhook_signature(BODY, signature, SECRET))
        pretty = json.dumps(json.loads(BODY), indent=2)
        self.assertFalse(verify_webhook_signature(pretty, signature, SECRET))

    def test_wrong_secret_and_tamper(self):
        signature = _sign(BODY)
        self.assertFalse(verify_webhook_signature(BODY, signature, "other"))
        self.assertFalse(verify_webhook_signature(BODY + " ", signature, SECRET))
        self.assertFalse(verify_webhook_signature(BODY, "sha256=abcd", SECRET))
        self.assertFalse(verify_webhook_signature(BODY, None, SECRET))

    def test_header_case_and_tolerance(self):
        signature = _sign(BODY)
        sent_at = datetime(2026, 11, 2, 12, 0, tzinfo=timezone.utc)
        event = verify_and_parse(
            BODY,
            signature,
            SECRET,
            timestamp_header=sent_at.isoformat().replace("+00:00", "Z"),
            tolerance_seconds=300,
            now=sent_at + timedelta(seconds=20),
        )
        self.assertEqual(event["event_id"], "evt_1")

        client = NorenClient("pk", "sk", webhook_secret=SECRET, transport=lambda *args: (200, b"{}"))
        current = datetime.now(timezone.utc)
        parsed = client.parse_webhook(
            BODY.encode(),
            None,
            headers={
                "x-merset-signature": signature,
                "X-Merset-Timestamp": current.isoformat(),
            },
            tolerance_seconds=300,
        )
        self.assertEqual(parsed["invoice"]["status"], "confirmed")

        with self.assertRaises(NorenSignatureError):
            verify_and_parse(
                BODY,
                signature,
                SECRET,
                timestamp_header=sent_at.isoformat(),
                tolerance_seconds=30,
                now=sent_at + timedelta(minutes=10),
            )

    def test_status_helpers(self):
        self.assertTrue(is_paid_status("Confirmed"))
        self.assertTrue(is_paid_status("overpaid"))
        self.assertFalse(is_paid_status("underpaid"))
        self.assertTrue(is_underpaid_status("underpaid"))
        self.assertTrue(is_failed_status("cancelled"))
        self.assertTrue(is_failed_status("canceled"))
        self.assertTrue(is_settled_status("paid"))
        self.assertFalse(is_settled_status("underpaid"))
        self.assertTrue(is_settled_status("underpaid", {"credited": True}))
        self.assertFalse(is_settled_status("underpaid", {"credited": False}))


if __name__ == "__main__":
    unittest.main()

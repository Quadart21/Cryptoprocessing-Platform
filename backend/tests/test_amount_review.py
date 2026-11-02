import unittest

from app.providers.crypto_cash_status import normalize_crypto_cash_status, resolve_crypto_cash_status
from app.services.amount_review import (
    build_amount_review,
    build_amount_review_notice,
    coerce_provider_status_for_amount_review,
    pin_received_settlement,
    review_needs_alert,
    should_keep_credited_invoice,
    upsert_amount_review,
)


UNDERPAID_WEBHOOK = {
    "id": "3e7b5c84-9f21-46d8-a05c-b27f4d1e8a36",
    "event": {
        "data": {
            "id": "a1d9c5f3-8e47-42b6-9c14-5f8b3a7d2e91",
            "amount": "249.84",
            "status": "Underpaid",
            "currency": "USDT",
            "usdtTotal": "249.390288",
            "exchangeRate": "1",
            "expectedAmount": "250",
            "receivedAmount": None,
            "requestedAmount": "250",
        },
        "event_type": "acquiring::underpaid",
    },
}

OVERPAID_WEBHOOK = {
    "event": {
        "data": {
            "amount": "480.523",
            "status": "Overpaid",
            "currency": "USDC",
            "usdtTotal": "479.42825",
            "exchangeRate": "0.99876234518902145673",
            "expectedAmount": "480",
            "receivedAmount": None,
        },
        "event_type": "acquiring::overpaid",
    }
}


class AmountReviewStatusTests(unittest.TestCase):
    def test_mismatch_statuses_are_not_auto_paid(self) -> None:
        self.assertEqual(normalize_crypto_cash_status("Underpaid"), "underpaid")
        self.assertEqual(normalize_crypto_cash_status("Overpaid"), "overpaid")
        self.assertEqual(normalize_crypto_cash_status("CanceledButUnderpaid"), "underpaid")
        self.assertEqual(normalize_crypto_cash_status("CanceledButOverpaid"), "overpaid")
        self.assertEqual(
            resolve_crypto_cash_status(status=None, event_type="acquiring::underpaid"),
            "underpaid",
        )

    def test_paid_webhook_does_not_auto_close_an_open_review(self) -> None:
        self.assertEqual(
            coerce_provider_status_for_amount_review(
                previous_status="underpaid",
                raw_normalized="paid",
                source="webhook",
            ),
            "underpaid",
        )
        self.assertEqual(
            coerce_provider_status_for_amount_review(
                previous_status="overpaid",
                raw_normalized="confirmed",
                source="sync",
            ),
            "overpaid",
        )

    def test_manual_confirm_is_allowed(self) -> None:
        self.assertEqual(
            coerce_provider_status_for_amount_review(
                previous_status="underpaid",
                raw_normalized="confirmed",
                source="manual",
            ),
            "confirmed",
        )

    def test_credited_invoice_is_not_reopened(self) -> None:
        self.assertTrue(should_keep_credited_invoice("confirmed", "underpaid"))
        self.assertFalse(should_keep_credited_invoice("underpaid", "overpaid"))


class AmountReviewSnapshotTests(unittest.TestCase):
    def test_underpaid_snapshot_uses_cumulative_amount(self) -> None:
        review = build_amount_review(
            UNDERPAID_WEBHOOK,
            provider_status="Underpaid",
            event_type="acquiring::underpaid",
        )
        self.assertIsNotNone(review)
        assert review is not None
        self.assertEqual(review["kind"], "underpaid")
        self.assertEqual(review["expected_amount"], "250")
        self.assertEqual(review["received_amount"], "249.84")
        self.assertEqual(review["delta_amount"], "-0.16")
        self.assertEqual(review["usdt_total"], "249.390288")
        self.assertEqual(review["currency"], "USDT")
        self.assertFalse(review["credited"])

    def test_overpaid_snapshot(self) -> None:
        review = build_amount_review(OVERPAID_WEBHOOK, provider_status="Overpaid")
        self.assertIsNotNone(review)
        assert review is not None
        self.assertEqual(review["kind"], "overpaid")
        self.assertEqual(review["received_amount"], "480.523")
        self.assertEqual(review["expected_amount"], "480")
        self.assertEqual(review["delta_amount"], "0.523")

    def test_pin_settlement_uses_received_amount(self) -> None:
        stored: dict = {}
        self.assertTrue(
            upsert_amount_review(
                stored,
                UNDERPAID_WEBHOOK,
                provider_status="Underpaid",
                event_type="acquiring::underpaid",
            )
        )
        self.assertTrue(pin_received_settlement(stored))
        self.assertEqual(stored["settlement_amount_crypto"], "249.84")
        self.assertEqual(stored["settlement_exchange_rate"], "1")
        self.assertTrue(stored["amount_review"]["credited"])

    def test_alert_only_when_review_opens_or_amount_changes(self) -> None:
        review = build_amount_review(UNDERPAID_WEBHOOK, provider_status="Underpaid")
        self.assertTrue(review_needs_alert("pending", None, review))
        self.assertFalse(review_needs_alert("underpaid", review, review))
        changed = dict(review or {})
        changed["received_amount"] = "249.10"
        self.assertTrue(review_needs_alert("underpaid", review, changed))

    def test_notice_names_the_received_sum(self) -> None:
        review = build_amount_review(UNDERPAID_WEBHOOK, provider_status="Underpaid")
        assert review is not None
        title, lines = build_amount_review_notice(
            merchant_name="Shop",
            invoice_id="inv-1",
            review=review,
        )
        self.assertIn("Недоплата", title)
        self.assertTrue(any("249.84 USDT" in line for line in lines))
        self.assertTrue(any("250 USDT" in line for line in lines))

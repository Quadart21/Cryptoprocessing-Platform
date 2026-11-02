import ast
import unittest
from pathlib import Path

from app.providers.crypto_cash_status import (
    acquiring_event_finalizes_credit,
    normalize_crypto_cash_status,
    provider_status_indicates_deposit_credit,
    resolve_crypto_cash_status,
)
from app.services.provider_settlement_rate import apply_settlement_fields_to_stored
from app.services.amount_review import (
    build_amount_review,
    build_amount_review_notice,
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
    def test_invoice_service_imports_provider_webhook_log(self) -> None:
        source = Path(__file__).resolve().parents[1] / "app" / "services" / "invoice_service.py"
        tree = ast.parse(source.read_text(encoding="utf-8-sig"))
        imported = False
        used = False
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module == "app.services.provider_webhook_log":
                imported = any(alias.name == "ProviderWebhookLogService" for alias in node.names)
            if isinstance(node, ast.Name) and node.id == "ProviderWebhookLogService":
                used = True
        self.assertTrue(imported)
        self.assertTrue(used)
    def test_mismatch_statuses_settle_as_paid(self) -> None:
        self.assertEqual(normalize_crypto_cash_status("Underpaid"), "paid")
        self.assertEqual(normalize_crypto_cash_status("Overpaid"), "paid")
        self.assertEqual(normalize_crypto_cash_status("CanceledButUnderpaid"), "paid")
        self.assertEqual(normalize_crypto_cash_status("CanceledButOverpaid"), "paid")
        self.assertEqual(
            resolve_crypto_cash_status(status=None, event_type="acquiring::underpaid"),
            "paid",
        )
        self.assertEqual(
            resolve_crypto_cash_status(status=None, event_type="acquiring::overpaid"),
            "paid",
        )
        self.assertTrue(provider_status_indicates_deposit_credit("Underpaid"))
        self.assertTrue(provider_status_indicates_deposit_credit("CanceledButOverpaid"))
        self.assertTrue(acquiring_event_finalizes_credit("acquiring::underpaid"))
        self.assertTrue(acquiring_event_finalizes_credit("acquiring::overpaid"))

    def test_credited_invoice_is_not_reopened(self) -> None:
        self.assertTrue(should_keep_credited_invoice("confirmed", "underpaid"))
        self.assertFalse(should_keep_credited_invoice("underpaid", "overpaid"))
        self.assertFalse(should_keep_credited_invoice("confirming", "underpaid"))


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

    def test_provider_settlement_uses_cumulative_amount_not_quote(self) -> None:
        stored: dict = {}
        apply_settlement_fields_to_stored(
            stored,
            UNDERPAID_WEBHOOK,
            provider_status="Underpaid",
        )
        self.assertEqual(stored["settlement_amount_crypto"], "249.84")
        self.assertNotEqual(stored["settlement_amount_crypto"], "250")

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
        self.assertTrue(any("автоматически" in line for line in lines))

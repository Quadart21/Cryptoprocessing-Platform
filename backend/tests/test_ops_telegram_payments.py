import unittest
from datetime import datetime, timezone
from decimal import Decimal

from app.services.ops_telegram_report import (
    build_daily_payment_lines,
    format_moscow_day_label,
    format_ops_money,
    previous_moscow_day_bounds,
    should_notify_ops_payment,
    telegram_thread_error_is_retryable,
)


class OpsPaymentNotifyTests(unittest.TestCase):
    def test_notifies_when_payment_is_first_seen(self) -> None:
        self.assertTrue(should_notify_ops_payment("pending", "confirming"))
        self.assertTrue(should_notify_ops_payment("pending", "paid"))
        self.assertTrue(should_notify_ops_payment("pending", "confirmed"))
        self.assertTrue(should_notify_ops_payment("cancelled", "confirming"))

    def test_does_not_repeat_when_confirmation_finishes(self) -> None:
        self.assertFalse(should_notify_ops_payment("confirming", "confirmed"))
        self.assertFalse(should_notify_ops_payment("paid", "confirmed"))
        self.assertFalse(should_notify_ops_payment("confirmed", "confirmed"))
        self.assertFalse(should_notify_ops_payment("pending", "pending"))
        self.assertFalse(should_notify_ops_payment("pending", "cancelled"))


class MoscowDayBoundsTests(unittest.TestCase):
    def test_midnight_moscow_closes_the_previous_day(self) -> None:
        # 02 Nov 2026 21:00 UTC = 03 Nov 2026 00:00 MSK.
        now = datetime(2026, 11, 2, 21, 0, tzinfo=timezone.utc)
        start, end = previous_moscow_day_bounds(now)
        self.assertEqual(start, datetime(2026, 11, 1, 21, 0, tzinfo=timezone.utc))
        self.assertEqual(end, datetime(2026, 11, 2, 21, 0, tzinfo=timezone.utc))
        self.assertEqual(format_moscow_day_label(start), "2 ноября 2026 (МСК)")

    def test_afternoon_still_reports_the_last_finished_day(self) -> None:
        # 02 Nov 2026 15:00 UTC = 02 Nov 2026 18:00 MSK.
        now = datetime(2026, 11, 2, 15, 0, tzinfo=timezone.utc)
        start, end = previous_moscow_day_bounds(now)
        self.assertEqual(start, datetime(2026, 10, 31, 21, 0, tzinfo=timezone.utc))
        self.assertEqual(end, datetime(2026, 11, 1, 21, 0, tzinfo=timezone.utc))
        self.assertEqual(format_moscow_day_label(start), "1 ноября 2026 (МСК)")


class DailyPaymentLinesTests(unittest.TestCase):
    def test_summary_lists_count_amount_provider_and_profit(self) -> None:
        lines = build_daily_payment_lines(
            day_label="2 ноября 2026 (МСК)",
            payment_count=3,
            gross=Decimal("1500"),
            provider_fee=Decimal("22.5"),
            profit=Decimal("30"),
            estimated_count=1,
            unpriced_count=0,
        )
        self.assertEqual(
            lines[:5],
            [
                "Сутки: 2 ноября 2026 (МСК)",
                "Платежей: 3",
                "Сумма: 1500.00 USDT",
                "Провайдер забрал: 22.50 USDT",
                "Ваша прибыль: 30.00 USDT",
            ],
        )
        self.assertIn("Оценочные, ещё без сетевого подтверждения: 1", lines)

    def test_money_keeps_small_fractions(self) -> None:
        self.assertEqual(format_ops_money(Decimal("1.2345")), "1.2345 USDT")
        self.assertEqual(format_ops_money(Decimal("0.2"), "USDT"), "0.20 USDT")


class TelegramThreadRetryTests(unittest.TestCase):
    def test_plain_group_and_missing_topic_are_retryable(self) -> None:
        self.assertTrue(
            telegram_thread_error_is_retryable("Bad Request: the chat is not a forum")
        )
        self.assertTrue(
            telegram_thread_error_is_retryable("Bad Request: message thread not found")
        )
        self.assertFalse(telegram_thread_error_is_retryable("Bad Request: chat not found"))
        self.assertFalse(telegram_thread_error_is_retryable(None))


if __name__ == "__main__":
    unittest.main()

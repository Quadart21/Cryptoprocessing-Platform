"""Чистые правила служебных платёжных уведомлений. Без БД и Telegram API."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

# Платёж уже увиден: повторный переход confirming → confirmed не шлёт второе сообщение.
PAYMENT_SEEN_STATUSES = frozenset({"confirming", "paid", "confirmed"})

# 00:00 Europe/Moscow. Пояс без перехода на летнее время, UTC+3 круглый год.
MOSCOW_TZ = ZoneInfo("Europe/Moscow")
MOSCOW_DAY_CLOSE_UTC_HOUR = 21

_MONTHS_GENITIVE = (
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
)

# Telegram rejects message_thread_id for a plain group and for a deleted topic.
_THREAD_RETRY_MARKERS = (
    "message thread not found",
    "thread not found",
    "message_thread_id",
    "the chat is not a forum",
    "topics are disabled",
    "not a forum",
)


def should_notify_ops_payment(previous_status: str, effective_status: str) -> bool:
    """Одно уведомление на платёж — в момент, когда деньги впервые увидены."""
    return (
        previous_status not in PAYMENT_SEEN_STATUSES
        and effective_status in PAYMENT_SEEN_STATUSES
    )


def previous_moscow_day_bounds(now: datetime | None = None) -> tuple[datetime, datetime]:
    """Границы последних завершённых суток по Москве, в UTC."""
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    local = current.astimezone(MOSCOW_TZ)
    end_local = local.replace(hour=0, minute=0, second=0, microsecond=0)
    start_local = end_local - timedelta(days=1)
    return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)


def format_moscow_day_label(start_utc: datetime) -> str:
    local = start_utc.astimezone(MOSCOW_TZ)
    return f"{local.day} {_MONTHS_GENITIVE[local.month - 1]} {local.year} (МСК)"


def format_ops_money(value: Decimal, currency: str = "USDT") -> str:
    amount = Decimal(value).quantize(Decimal("0.0001"))
    sign = "-" if amount < 0 else ""
    text = f"{abs(amount):.4f}".rstrip("0").rstrip(".")
    if "." not in text:
        text = f"{text}.00"
    elif len(text.split(".", 1)[1]) == 1:
        text = f"{text}0"
    return f"{sign}{text} {currency}"


def build_daily_payment_lines(
    *,
    day_label: str,
    payment_count: int,
    gross: Decimal,
    provider_fee: Decimal,
    profit: Decimal,
    estimated_count: int = 0,
    unpriced_count: int = 0,
    currency: str = "USDT",
) -> list[str]:
    lines = [
        f"Сутки: {day_label}",
        f"Платежей: {payment_count}",
        f"Сумма: {format_ops_money(gross, currency)}",
        f"Провайдер забрал: {format_ops_money(provider_fee, currency)}",
        f"Ваша прибыль: {format_ops_money(profit, currency)}",
    ]
    if estimated_count:
        lines.append(f"Оценочные, ещё без сетевого подтверждения: {estimated_count}")
    if unpriced_count:
        lines.append(f"Без суммы в {currency}: {unpriced_count}")
    return lines


def telegram_thread_error_is_retryable(error_text: str | None) -> bool:
    if not error_text:
        return False
    lowered = error_text.lower()
    return any(marker in lowered for marker in _THREAD_RETRY_MARKERS)

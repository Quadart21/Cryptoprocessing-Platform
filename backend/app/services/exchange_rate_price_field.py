from typing import Final

VALID_EXCHANGE_RATE_PRICE_FIELDS: Final[frozenset[str]] = frozenset({"last", "buy", "sell"})
DEFAULT_EXCHANGE_RATE_PRICE_FIELD: Final[str] = "last"

EXCHANGE_RATE_PRICE_FIELD_TO_JSON_KEY: Final[dict[str, str]] = {
    "last": "lastPrice",
    "buy": "buy",
    "sell": "sell",
}


def normalize_exchange_rate_price_field(value: str | None) -> str:
    normalized = str(value or DEFAULT_EXCHANGE_RATE_PRICE_FIELD).strip().lower()
    if normalized not in VALID_EXCHANGE_RATE_PRICE_FIELDS:
        return DEFAULT_EXCHANGE_RATE_PRICE_FIELD
    return normalized

from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invoice import Invoice
from app.models.transaction import Transaction
from app.services.exchange_rate_service import get_exchange_rate_service
from app.services.invoice_confirmations import (
    confirmations_fields_for_invoice,
    read_stored_confirmations,
)
from app.services.invoice_service import InvoiceService

RATE_KEYS = ("rate", "exchangeRate", "exchange_rate", "price", "conversionRate")
NETWORK_FEE_KEYS = ("networkFee", "network_fee", "blockchainFee", "minerFee", "gasFee")
UPDATED_AT_KEYS = ("updatedAt", "updated_at", "paidAt", "paid_at", "lastUpdate", "modifiedAt")


def _parse_decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value).replace(",", "."))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _first_non_empty(*values: Any) -> Any:
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return value
    return None


def _payload_item_candidates(stored_payload: dict | None) -> list[dict]:
    if not isinstance(stored_payload, dict):
        return []

    candidates: list[dict] = []
    for key in ("last_webhook_payload", "retrieve_response", "create_response"):
        payload = stored_payload.get(key)
        if not isinstance(payload, dict):
            continue
        data = payload.get("data")
        if not isinstance(data, dict):
            continue
        item = data.get("item")
        if isinstance(item, dict):
            candidates.append(item)

    event = stored_payload.get("event")
    if isinstance(event, dict):
        data = event.get("data")
        if isinstance(data, dict):
            candidates.append(data)

    return candidates


def _pick_from_items(items: list[dict], keys: tuple[str, ...]) -> Any:
    for item in items:
        for key in keys:
            value = item.get(key)
            if value is not None and value != "":
                return value
    return None


def extract_tx_hash(stored_payload: dict | None, items: list[dict]) -> str | None:
    if isinstance(stored_payload, dict):
        direct = stored_payload.get("tx_hash")
        if direct:
            return str(direct)
    picked = _pick_from_items(items, ("hash", "txHash", "tx_hash", "transactionHash"))
    return str(picked) if picked else None


def extract_network_commission(items: list[dict]) -> tuple[Decimal | None, str | None]:
    raw = _pick_from_items(items, NETWORK_FEE_KEYS)
    amount = _parse_decimal(raw)
    if amount is None:
        return None, None
    currency = _pick_from_items(items, ("networkFeeCurrency", "network_fee_currency", "feeCurrency"))
    return amount, str(currency).upper() if currency else None


def extract_provider_updated_at(items: list[dict]) -> datetime | None:
    raw = _pick_from_items(items, UPDATED_AT_KEYS)
    if not raw:
        return None
    if isinstance(raw, datetime):
        return raw
    text = str(raw).strip()
    if not text:
        return None
    normalized = text.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def extract_provider_rate(items: list[dict]) -> Decimal | None:
    return _parse_decimal(_pick_from_items(items, RATE_KEYS))


def resolve_last_updated_at(
    invoice: Invoice,
    items: list[dict],
) -> datetime:
    provider_updated = extract_provider_updated_at(items)
    if provider_updated is not None:
        return provider_updated
    if invoice.paid_at is not None:
        return invoice.paid_at
    if invoice.confirmed_at is not None:
        return invoice.confirmed_at
    return invoice.updated_at


def resolve_exchange_rate(
    *,
    amount_crypto: Decimal,
    gross_amount: Decimal | None,
    amount_fiat: Decimal,
    provider_rate: Decimal | None,
) -> Decimal | None:
    if amount_crypto <= Decimal("0"):
        return provider_rate
    if gross_amount is not None and gross_amount > Decimal("0"):
        return (gross_amount / amount_crypto).quantize(InvoiceService.AMOUNT_PRECISION)
    if amount_fiat > Decimal("0"):
        return (amount_fiat / amount_crypto).quantize(InvoiceService.AMOUNT_PRECISION)
    return provider_rate


async def build_invoice_transaction_details(
    db: AsyncSession,
    invoice: Invoice,
    transaction: Transaction | None,
    *,
    include_exchange_rate: bool = False,
) -> dict[str, Any]:
    stored_payload = invoice.raw_provider_payload_json or {}
    items = _payload_item_candidates(stored_payload)
    confirmations = await confirmations_fields_for_invoice(db, invoice)
    if confirmations["network_confirmations_required"] is None:
        _, seeded_required = read_stored_confirmations(invoice)
        confirmations["network_confirmations_required"] = seeded_required

    commission_currency = InvoiceService.BALANCE_CURRENCY
    gross_amount: Decimal | None = None
    processing_commission: Decimal | None = None
    platform_commission: Decimal | None = None
    is_estimate = True

    invoice_service = InvoiceService(db)
    if transaction is not None and transaction.gross_amount > Decimal("0"):
        gross_amount = Decimal(transaction.gross_amount).quantize(InvoiceService.AMOUNT_PRECISION)
        processing_commission = Decimal(transaction.provider_fee).quantize(InvoiceService.AMOUNT_PRECISION)
        platform_commission = (
            Decimal(transaction.platform_fee) + Decimal(transaction.turnover_fee)
        ).quantize(InvoiceService.AMOUNT_PRECISION)
        commission_currency = transaction.currency or commission_currency
        is_estimate = False
    elif invoice.status == "confirmed":
        try:
            gross_amount = await invoice_service.resolve_accounting_gross_amount(
                amount_crypto=Decimal(invoice.amount_crypto),
                crypto_currency=invoice.crypto_currency,
                fiat_currency=commission_currency,
                exchange_rate_markup=Decimal("0"),
            )
            provider_fee, platform_fee, turnover_fee, _net = await invoice_service._calculate_financials(
                tenant_id=invoice.tenant_id,
                gross_amount=gross_amount,
                fiat_currency=commission_currency,
            )
            processing_commission = provider_fee
            platform_commission = (platform_fee + turnover_fee).quantize(InvoiceService.AMOUNT_PRECISION)
        except ValueError:
            gross_amount = None

    display_fiat_currency = commission_currency if gross_amount is not None else invoice.fiat_currency
    rate_service = get_exchange_rate_service()
    crypto_upper = invoice.crypto_currency.strip().upper()
    fiat_upper = invoice.fiat_currency.strip().upper()
    stable_pair = (
        crypto_upper in rate_service.STABLECOIN_EQUIVALENTS
        and fiat_upper in rate_service.STABLECOIN_EQUIVALENTS
    )
    if gross_amount is not None:
        display_fiat = gross_amount
        display_fiat_currency = commission_currency
    elif stable_pair:
        display_fiat = Decimal(invoice.amount_fiat)
        display_fiat_currency = invoice.fiat_currency
    else:
        display_fiat = Decimal(invoice.amount_fiat)
        display_fiat_currency = invoice.fiat_currency
        is_estimate = True
    exchange_rate = None
    if include_exchange_rate and gross_amount is not None and Decimal(invoice.amount_crypto) > Decimal("0"):
        provider_rate = extract_provider_rate(items)
        exchange_rate = resolve_exchange_rate(
            amount_crypto=Decimal(invoice.amount_crypto),
            gross_amount=gross_amount,
            amount_fiat=Decimal(invoice.amount_fiat),
            provider_rate=provider_rate,
        )
    network_commission, network_commission_currency = extract_network_commission(items)
    if network_commission_currency is None and network_commission is not None:
        network_commission_currency = invoice.crypto_currency

    trading_pair = f"{invoice.crypto_currency}/{display_fiat_currency}"

    return {
        "operation_type": "sale",
        "created_at": invoice.created_at,
        "last_updated_at": resolve_last_updated_at(invoice, items),
        "paid_at": invoice.paid_at or (transaction.paid_at if transaction else None),
        "trading_pair": trading_pair,
        "amount_crypto": invoice.amount_crypto,
        "crypto_currency": invoice.crypto_currency,
        "amount_fiat": display_fiat,
        "fiat_currency": display_fiat_currency,
        "status": invoice.status,
        "exchange_id": invoice.provider_order_id,
        "wallet_address": invoice.payment_address or None,
        "tx_hash": extract_tx_hash(stored_payload, items),
        "exchange_rate": exchange_rate,
        "exchange_rate_currency": display_fiat_currency,
        "processing_commission": processing_commission,
        "platform_commission": platform_commission,
        "network_commission": network_commission,
        "network_commission_currency": network_commission_currency,
        "commission_currency": commission_currency,
        "network_confirmations_actual": confirmations["network_confirmations_actual"],
        "network_confirmations_required": confirmations["network_confirmations_required"],
        "is_estimate": is_estimate,
    }

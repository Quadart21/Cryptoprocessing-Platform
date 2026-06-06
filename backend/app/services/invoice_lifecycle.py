from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.models.invoice import Invoice
from app.services.checkout_delivery_service import CheckoutDeliveryService, CheckoutPaymentFields
from app.services.payment_memo import read_stored_payment_memo
from app.providers.crypto_cash_status import platform_status_indicates_payment


def invoice_payment_ttl() -> timedelta:
    return timedelta(minutes=settings.invoice_payment_ttl_minutes)


def compute_invoice_expires_at(*, now: datetime | None = None) -> datetime:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return current + invoice_payment_ttl()


def normalize_expires_at(expires_at: datetime) -> datetime:
    if expires_at.tzinfo is None:
        return expires_at.replace(tzinfo=timezone.utc)
    return expires_at


def is_invoice_expired(invoice: Invoice, *, now: datetime | None = None) -> bool:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return current > normalize_expires_at(invoice.expires_at)


def invoice_allows_payment_credentials(invoice: Invoice, *, now: datetime | None = None) -> bool:
    if invoice.status != "pending":
        return False
    return not is_invoice_expired(invoice, now=now)


def provider_status_indicates_payment(raw_normalized: str) -> bool:
    return platform_status_indicates_payment(raw_normalized)


def checkout_payment_fields(
    invoice: Invoice,
    *,
    mode: str | None,
    payment_page_url: str | None,
) -> CheckoutPaymentFields:
    fields = CheckoutDeliveryService.apply(
        mode,
        payment_page_url=payment_page_url,
        payment_address=invoice.payment_address,
        qr_url=invoice.qr_url,
    )
    if invoice_allows_payment_credentials(invoice):
        memo = read_stored_payment_memo(invoice.raw_provider_payload_json)
        return CheckoutPaymentFields(
            payment_page_url=fields.payment_page_url,
            payment_address=fields.payment_address,
            qr_url=fields.qr_url,
            payment_memo=memo,
            checkout_delivery=fields.checkout_delivery,
        )
    return CheckoutDeliveryService.mask_credentials(fields)

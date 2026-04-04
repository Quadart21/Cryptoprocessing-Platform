from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Protocol


@dataclass
class ProviderCreateInvoiceRequest:
    merchant_order_id: str
    amount_fiat: Decimal
    fiat_currency: str
    crypto_currency: str
    network: str


@dataclass
class ProviderCreateInvoiceResponse:
    provider_order_id: str
    amount_crypto: Decimal
    crypto_currency: str
    network: str
    payment_address: str
    qr_url: str | None
    expires_at: datetime
    raw_payload: dict


class PaymentProviderInterface(Protocol):
    def create_invoice(
        self, payload: ProviderCreateInvoiceRequest
    ) -> ProviderCreateInvoiceResponse: ...

    def get_invoice_status(self, external_id: str) -> dict: ...

    def list_currencies(self) -> dict: ...

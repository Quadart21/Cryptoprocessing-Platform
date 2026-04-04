from datetime import datetime, timedelta, timezone
from decimal import Decimal
from secrets import token_hex

from app.providers.base import (
    PaymentProviderInterface,
    ProviderCreateInvoiceRequest,
    ProviderCreateInvoiceResponse,
)


class CryptoCashMockProvider(PaymentProviderInterface):
    def create_invoice(
        self, payload: ProviderCreateInvoiceRequest
    ) -> ProviderCreateInvoiceResponse:
        rate = Decimal("1")
        if payload.crypto_currency.upper() == "BTC":
            rate = Decimal("65000")

        amount_crypto = (payload.amount_fiat / rate).quantize(Decimal("0.00000001"))
        provider_order_id = f"cc_{token_hex(8)}"
        payment_address = f"{payload.network.lower()}_{token_hex(16)}"
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
        raw_payload = {
            "provider": "crypto-cash-mock",
            "provider_order_id": provider_order_id,
            "amount_crypto": str(amount_crypto),
            "payment_address": payment_address,
            "network": payload.network,
        }
        return ProviderCreateInvoiceResponse(
            provider_order_id=provider_order_id,
            amount_crypto=amount_crypto,
            crypto_currency=payload.crypto_currency.upper(),
            network=payload.network.upper(),
            payment_address=payment_address,
            qr_url=f"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={payment_address}",
            expires_at=expires_at,
            raw_payload=raw_payload,
        )

    def get_invoice_status(self, external_id: str) -> dict:
        return {
            "code": 200,
            "data": {
                "item": {
                    "id": external_id,
                    "externalId": external_id,
                    "status": "Queued",
                }
            },
        }

    def list_currencies(self) -> dict:
        return {
            "code": 200,
            "data": {
                "items": [
                    {
                        "currency": "USDT",
                        "networks": [
                            {"name": "TRC20", "isMemoRequired": False},
                            {"name": "ERC20", "isMemoRequired": False},
                        ],
                        "limits": [
                            {
                                "network": "TRC20",
                                "ticker": "USDTTRC20",
                                "min_deposit": "5",
                                "max_deposit": "100000",
                                "min_withdraw": "10",
                                "network_fee": "1",
                                "availability": True,
                                "acquiring": True,
                                "withdrawal": True,
                            }
                        ],
                    },
                    {
                        "currency": "BTC",
                        "networks": [{"name": "BTC", "isMemoRequired": False}],
                        "limits": [
                            {
                                "network": "BTC",
                                "ticker": "BTC",
                                "min_deposit": "0.0001",
                                "max_deposit": "10",
                                "min_withdraw": "0.0005",
                                "network_fee": "0.00001",
                                "availability": True,
                                "acquiring": True,
                                "withdrawal": True,
                            }
                        ],
                    },
                ]
            },
        }

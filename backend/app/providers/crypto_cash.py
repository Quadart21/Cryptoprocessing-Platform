import base64
import hashlib
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
import requests
from requests.adapters import HTTPAdapter

from app.core.config import settings
from app.providers.base import (
    PaymentProviderInterface,
    ProviderCreateInvoiceRequest,
    ProviderCreateInvoiceResponse,
)
from app.services.api_usage_service import get_api_usage_service


class CryptoCashProviderError(Exception):
    def __init__(
        self,
        message: str,
        *,
        path: str | None = None,
        provider_code: int | str | None = None,
        errors: list[str] | None = None,
        payload: dict | None = None,
        http_status: int | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.path = path
        self.provider_code = provider_code
        self.errors = errors or []
        self.payload = payload
        self.http_status = http_status

    def to_public_detail(self) -> dict:
        return {
            "detail": self.message,
            "code": "provider_error",
            "message": self.message,
            "provider": "crypto-cash",
            "provider_code": str(self.provider_code) if self.provider_code is not None else None,
            "provider_errors": self.errors or None,
            "path": self.path,
            "http_status": self.http_status,
        }


def provider_error_http_status(error: CryptoCashProviderError) -> int:
    from fastapi import status

    if error.http_status and 400 <= error.http_status < 500:
        return status.HTTP_400_BAD_REQUEST

    normalized_text = " ".join([error.message, *error.errors]).lower()
    amount_keywords = ("min", "max", "limit", "amount", "sum", "сумм", "лимит", "миним", "максим")
    if any(keyword in normalized_text for keyword in amount_keywords):
        return status.HTTP_400_BAD_REQUEST

    return status.HTTP_502_BAD_GATEWAY


class CryptoCashProvider(PaymentProviderInterface):
    def __init__(self) -> None:
        if not settings.crypto_cash_public_key or not settings.crypto_cash_secret_key:
            raise CryptoCashProviderError(
                "Для Crypto-Cash нужны CRYPTO_CASH_PUBLIC_KEY и CRYPTO_CASH_SECRET_KEY."
            )
        self.base_url = settings.crypto_cash_api_base_url.rstrip("/")
        self.public_key = settings.crypto_cash_public_key
        self.secret_key = settings.crypto_cash_secret_key
        self.signature_mode = "legacy"
        self.private_key: Ed25519PrivateKey | None = None
        self._cache = get_cache_service()
        self._session = self._build_http_session()
        self._http_timeout = (
            settings.provider_http_connect_timeout_seconds,
            settings.provider_http_read_timeout_seconds,
        )

        if self._looks_like_ed25519_key(self.secret_key):
            try:
                self.private_key = Ed25519PrivateKey.from_private_bytes(
                    bytes.fromhex(self.secret_key)
                )
                self.signature_mode = "ed25519"
            except ValueError as exc:
                raise CryptoCashProviderError(
                    "Секретный ключ похож на ED25519, но не прошел валидацию."
                ) from exc

    def create_invoice(
        self, payload: ProviderCreateInvoiceRequest
    ) -> ProviderCreateInvoiceResponse:
        external_id = payload.merchant_order_id
        create_payload = self._build_sale_payload(payload, external_id)
        create_response = self._post(
            "/merchant/api/v1/balance/actions/sale/",
            create_payload,
        )
        retrieve_response = self.get_invoice_status(external_id)

        item = retrieve_response.get("data", {}).get("item", {}) or {}
        created_item = create_response.get("data", {}).get("item", {}) or {}

        payment_address = str(item.get("address") or created_item.get("address") or "")
        expected_amount = (
            item.get("expectedAmount")
            or item.get("requestedAmount")
            or item.get("amount")
            or payload.amount_fiat
        )
        amount_crypto = self._to_decimal(expected_amount)
        crypto_currency = str(payload.crypto_currency).upper()
        network = str(item.get("network") or payload.network).upper()
        memo = str(item.get("memo") or created_item.get("memo") or "")
        qr_data = f"{payment_address}?memo={memo}" if payment_address and memo else payment_address
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)

        raw_payload = {
            "provider": "crypto-cash",
            "create_response": create_response,
            "retrieve_response": retrieve_response,
            "memo": memo or None,
            "signature_mode": self.signature_mode,
        }
        return ProviderCreateInvoiceResponse(
            provider_order_id=str(item.get("id") or created_item.get("id") or external_id),
            amount_crypto=amount_crypto,
            crypto_currency=crypto_currency,
            network=network,
            payment_address=payment_address,
            qr_url=(
                f"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={qr_data}"
                if qr_data
                else None
            ),
            expires_at=expires_at,
            raw_payload=raw_payload,
        )

    def get_invoice_status(self, external_id: str) -> dict:
        status_payload = {
            "publicKey": self.public_key,
            "externalId": external_id,
        }
        return self._post(
            "/merchant/api/v1/balance/payments/retrieve/",
            status_payload,
        )

    def list_currencies(self) -> dict:
        cache_key = self._currencies_cache_key()
        cached = self._cache.get_json(cache_key)
        if isinstance(cached, dict):
            return cached

        payload = {"publicKey": self.public_key}
        try:
            response = self._post("/merchant/api/v1/crypto-currencies/list-in/", payload)
            self._cache.set_json(
                cache_key,
                response,
                ttl_seconds=settings.cache_provider_currencies_ttl_seconds,
            )
            return response
        except CryptoCashProviderError as exc:
            if exc.http_status not in {404, 405}:
                raise
        response = self._post("/merchant/api/v1/crypto-currencies/list/", payload)
        self._cache.set_json(
            cache_key,
            response,
            ttl_seconds=settings.cache_provider_currencies_ttl_seconds,
        )
        return response

    def _post(self, path: str, payload: dict) -> dict:
        data = self._encode_payload(payload)
        signature = self._sign(data)
        try:
            response = self._session.post(
                f"{self.base_url}{path}",
                json={"data": data, "signature": signature},
                headers={"Content-Type": "application/json"},
                timeout=self._http_timeout,
            )
            response.raise_for_status()
            parsed = response.json()
            self._ensure_success_response(path, parsed)
            get_api_usage_service().record_provider_outbound(path=path, error=False)
            return parsed
        except requests.HTTPError as exc:
            get_api_usage_service().record_provider_outbound(path=path, error=True)
            status_code = exc.response.status_code if exc.response is not None else None
            payload_json = self._safe_json(exc.response.text) if exc.response is not None else None
            provider_code, errors = self._extract_provider_error_fields(payload_json)
            response_payload = exc.response.text if exc.response is not None else str(exc)
            message = (
                f"Crypto-Cash HTTP {status_code}: {response_payload}"
                if status_code is not None
                else f"Crypto-Cash HTTP error: {response_payload}"
            )
            raise CryptoCashProviderError(
                message,
                path=path,
                provider_code=provider_code,
                errors=errors,
                payload=payload_json,
                http_status=status_code,
            ) from exc
        except requests.RequestException as exc:
            get_api_usage_service().record_provider_outbound(path=path, error=True)
            raise CryptoCashProviderError(
                f"Crypto-Cash request failed: {exc}",
                path=path,
            ) from exc
        except CryptoCashProviderError as exc:
            get_api_usage_service().record_provider_outbound(path=path, error=True)
            raise exc

    @staticmethod
    def _encode_payload(payload: dict) -> str:
        raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        return base64.b64encode(raw).decode("utf-8")

    def _sign(self, data: str) -> str:
        message = data.encode("utf-8")
        if self.signature_mode == "ed25519" and self.private_key is not None:
            signature = self.private_key.sign(message)
            return base64.b64encode(signature).decode("utf-8")

        digest = hashlib.sha256(self.secret_key.encode("utf-8") + message).digest()
        return base64.b64encode(digest).decode("utf-8")

    def _build_sale_payload(
        self,
        payload: ProviderCreateInvoiceRequest,
        external_id: str,
    ) -> dict[str, str]:
        request_payload: dict[str, str] = {
            "publicKey": self.public_key,
            "amount": self._format_amount(payload.amount_fiat),
            "externalId": external_id,
        }
        webhook_url = self._resolve_webhook_url()
        if webhook_url:
            request_payload["webhookUrl"] = webhook_url
        ticker = self._resolve_ticker(payload.crypto_currency, payload.network)
        if ticker:
            request_payload["ticker"] = ticker
            return request_payload

        request_payload["currency"] = payload.crypto_currency.upper()
        request_payload["network"] = payload.network.upper()
        return request_payload

    def _resolve_webhook_url(self) -> str | None:
        base = settings.public_api_base_url
        if not base:
            return None
        return f"{base.rstrip('/')}/internal/webhook/crypto-cash"

    def _resolve_ticker(self, currency: str, network: str) -> str | None:
        normalized_currency = currency.upper()
        normalized_network = network.upper()
        try:
            response = self.list_currencies()
        except CryptoCashProviderError:
            return None

        items = response.get("data", {}).get("items", [])
        for item in items:
            if str(item.get("currency") or "").upper() != normalized_currency:
                continue
            for limit in item.get("limits", []) or []:
                limit_network = str(limit.get("network") or "").upper()
                ticker = str(limit.get("ticker") or "").upper()
                if limit_network == normalized_network and ticker:
                    return ticker
        return None

    @staticmethod
    def _to_decimal(value: str | Decimal | int | float) -> Decimal:
        return Decimal(str(value).replace(",", "."))

    @staticmethod
    def _format_amount(value: Decimal) -> str:
        return format(value, "f")

    @staticmethod
    def _looks_like_ed25519_key(secret_key: str) -> bool:
        return len(secret_key) == 64 and all(
            char in "0123456789abcdefABCDEF" for char in secret_key
        )

    @staticmethod
    def _ensure_success_response(path: str, payload: dict) -> None:
        if not isinstance(payload, dict):
            raise CryptoCashProviderError(
                f"Crypto-Cash API returned invalid payload type for {path}.",
                path=path,
                payload={"raw": payload},
            )

        code, errors = CryptoCashProvider._extract_provider_error_fields(payload)
        if errors:
            raise CryptoCashProviderError(
                f"Crypto-Cash API rejected request for {path}.",
                path=path,
                provider_code=code,
                errors=errors,
                payload=payload,
            )

        if code is not None and str(code) != "200":
            raise CryptoCashProviderError(
                f"Crypto-Cash API code {code} for {path}.",
                path=path,
                provider_code=code,
                payload=payload,
            )

    @staticmethod
    def _safe_json(raw: str) -> dict | None:
        try:
            parsed = json.loads(raw)
        except (TypeError, json.JSONDecodeError):
            return None
        return parsed if isinstance(parsed, dict) else None

    @staticmethod
    def _extract_provider_error_fields(payload: dict | None) -> tuple[int | str | None, list[str]]:
        if not isinstance(payload, dict):
            return None, []

        code = payload.get("code")
        errors = payload.get("errors")
        messages = CryptoCashProvider._normalize_errors(errors)

        if not messages:
            for key in ("message", "error", "detail"):
                candidate = payload.get(key)
                if isinstance(candidate, str) and candidate.strip():
                    messages = [candidate.strip()]
                    break

        return code, messages

    @staticmethod
    def _build_http_session() -> requests.Session:
        session = requests.Session()
        adapter = HTTPAdapter(
            pool_connections=settings.provider_http_pool_connections,
            pool_maxsize=settings.provider_http_pool_maxsize,
            max_retries=0,
        )
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        return session

    def _currencies_cache_key(self) -> str:
        identity = f"{self.base_url}|{self.public_key}".encode("utf-8")
        digest = hashlib.sha256(identity).hexdigest()[:24]
        return f"provider:crypto_cash:currencies:{digest}"

    @staticmethod
    def _normalize_errors(errors: object) -> list[str]:
        if errors is None:
            return []
        if isinstance(errors, str):
            return [errors] if errors.strip() else []
        if isinstance(errors, dict):
            normalized: list[str] = []
            for key, value in errors.items():
                if isinstance(value, list):
                    for item in value:
                        text = str(item).strip()
                        if text:
                            normalized.append(f"{key}: {text}")
                else:
                    text = str(value).strip()
                    if text:
                        normalized.append(f"{key}: {text}")
            return normalized
        if isinstance(errors, list):
            normalized_list: list[str] = []
            for item in errors:
                if isinstance(item, str) and item.strip():
                    normalized_list.append(item.strip())
                elif isinstance(item, dict):
                    nested = CryptoCashProvider._normalize_errors(item)
                    normalized_list.extend(nested)
                else:
                    text = str(item).strip()
                    if text:
                        normalized_list.append(text)
            return normalized_list
        text = str(errors).strip()
        return [text] if text else []

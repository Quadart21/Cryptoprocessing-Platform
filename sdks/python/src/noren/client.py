"""HTTP client for https://api.noren.digital/api/v1/client."""

from __future__ import annotations

import json
import os
from decimal import Decimal, InvalidOperation
from typing import Any, Callable, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from noren.errors import NorenError, NorenSignatureError
from noren.webhooks import header_value, verify_and_parse

DEFAULT_BASE_URL = "https://api.noren.digital/api/v1/client"
_USER_AGENT = "noren-merchant-python/0.1.0"

# (method, url, headers, body) -> (status_code, response_body)
Transport = Callable[[str, str, dict[str, str], bytes | None], tuple[int, bytes]]


def normalize_base_url(base_url: str | None) -> str:
    """Accept a host, ``/api/v1``, or the full client base URL."""
    value = (base_url or DEFAULT_BASE_URL).strip().rstrip("/")
    if not value:
        return DEFAULT_BASE_URL
    if value.endswith("/api/v1/client"):
        return value
    if value.endswith("/api/v1"):
        return value + "/client"
    return value + "/api/v1/client"


def _money(value: str | int | Decimal) -> str:
    if isinstance(value, bool) or not isinstance(value, (str, int, Decimal)):
        raise TypeError("amount must be str, int, or Decimal")
    if isinstance(value, str):
        text = value.strip()
        if not text:
            raise ValueError("amount is empty")
        try:
            Decimal(text)
        except InvalidOperation as exc:
            raise ValueError(f"amount is not a decimal: {value!r}") from exc
        return text
    return format(Decimal(value), "f")


class NorenClient:
    """Server-side client. Keep the secret key off browsers and mobile apps.

    ``base_url`` may be the host (``https://api.noren.digital``),
    ``https://api.noren.digital/api/v1``, or the full client prefix.
    """

    def __init__(
        self,
        public_key: str,
        secret_key: str,
        *,
        project_id: str | None = None,
        base_url: str | None = None,
        webhook_secret: str | None = None,
        timeout: float = 30,
        transport: Transport | None = None,
    ) -> None:
        if not public_key or not secret_key:
            raise ValueError("public_key and secret_key are required")
        self.public_key = public_key
        self.secret_key = secret_key
        self.project_id = project_id
        self.base_url = normalize_base_url(base_url)
        self.webhook_secret = webhook_secret
        self.timeout = timeout
        self._transport = transport

    @classmethod
    def from_env(cls, **overrides: Any) -> "NorenClient":
        """Build a client from ``NOREN_PUBLIC_KEY``, ``NOREN_SECRET_KEY``, and optional env.

        Optional variables: ``NOREN_PROJECT_ID``, ``NOREN_API_BASE``, ``NOREN_WEBHOOK_SECRET``.
        """
        public_key = overrides.pop("public_key", None) or os.environ.get("NOREN_PUBLIC_KEY", "")
        secret_key = overrides.pop("secret_key", None) or os.environ.get("NOREN_SECRET_KEY", "")
        project_id = overrides.pop("project_id", None)
        if project_id is None:
            project_id = os.environ.get("NOREN_PROJECT_ID") or None
        base_url = overrides.pop("base_url", None)
        if base_url is None:
            base_url = os.environ.get("NOREN_API_BASE")
        webhook_secret = overrides.pop("webhook_secret", None)
        if webhook_secret is None:
            webhook_secret = os.environ.get("NOREN_WEBHOOK_SECRET")
        if overrides:
            unknown = ", ".join(sorted(overrides))
            raise TypeError(f"Unexpected arguments: {unknown}")
        return cls(
            public_key=public_key,
            secret_key=secret_key,
            project_id=project_id,
            base_url=base_url,
            webhook_secret=webhook_secret,
        )

    def health(self) -> dict[str, Any]:
        return self._request("GET", "/health")

    def create_invoice(
        self,
        *,
        merchant_order_id: str,
        amount_fiat: str | int | Decimal,
        project_id: str | None = None,
        fiat_currency: str = "USD",
        crypto_currency: str = "USDT",
        network: str = "TRC20",
        metadata: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create an invoice. Redirect the buyer to ``payment_page_url`` when present."""
        resolved_project = project_id or self.project_id
        if not resolved_project:
            raise ValueError("project_id is required")
        if not merchant_order_id or not str(merchant_order_id).strip():
            raise ValueError("merchant_order_id is required")
        body: dict[str, Any] = {
            "project_id": resolved_project,
            "merchant_order_id": str(merchant_order_id),
            "amount_fiat": _money(amount_fiat),
            "fiat_currency": fiat_currency,
            "crypto_currency": crypto_currency,
            "network": network,
        }
        if metadata is not None:
            body["metadata"] = dict(metadata)
        return self._request("POST", "/invoices", body=body)

    def get_invoice(self, invoice_id: str, *, sync: bool = False) -> dict[str, Any]:
        return self._request(
            "GET",
            f"/invoices/{_path_segment(invoice_id)}",
            query={"sync": "true"} if sync else None,
        )

    def list_invoices(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        sync: bool = False,
    ) -> list[dict[str, Any]]:
        query: dict[str, str] = {"limit": str(limit), "offset": str(offset)}
        if sync:
            query["sync"] = "true"
        payload = self._request("GET", "/invoices", query=query)
        if not isinstance(payload, list):
            raise NorenError("Invoice list response must be a JSON array.")
        return payload

    def iter_invoices(self, *, page_size: int = 50, sync: bool = False):
        """Yield invoices page by page until a short page is returned."""
        offset = 0
        while True:
            page = self.list_invoices(limit=page_size, offset=offset, sync=sync)
            yield from page
            if len(page) < page_size:
                break
            offset += page_size

    def sync_invoice(self, invoice_id: str) -> dict[str, Any]:
        return self._request("POST", f"/invoices/{_path_segment(invoice_id)}/sync")

    def accept_received(self, invoice_id: str) -> dict[str, Any]:
        """Credit an underpaid invoice for the amount that actually arrived."""
        return self._request("POST", f"/invoices/{_path_segment(invoice_id)}/accept-received")

    def get_rates(self) -> dict[str, Any]:
        return self._request("GET", "/rates")

    def get_balance(self) -> dict[str, Any]:
        return self._request("GET", "/balance")

    def list_transactions(self, *, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
        payload = self._request(
            "GET",
            "/transactions",
            query={"limit": str(limit), "offset": str(offset)},
        )
        if not isinstance(payload, list):
            raise NorenError("Transaction list response must be a JSON array.")
        return payload

    def get_transaction(self, transaction_id: str) -> dict[str, Any]:
        return self._request("GET", f"/transactions/{_path_segment(transaction_id)}")

    def parse_webhook(
        self,
        raw_body: bytes | str,
        signature_header: str | None,
        *,
        headers: Mapping[str, str] | None = None,
        tolerance_seconds: int | None = None,
        webhook_secret: str | None = None,
    ) -> dict[str, Any]:
        """Verify an inbound webhook with this client's webhook secret."""
        secret = webhook_secret if webhook_secret is not None else self.webhook_secret
        if not secret:
            raise NorenSignatureError("webhook_secret is not configured")
        signature = signature_header
        timestamp = None
        if headers is not None:
            if signature is None:
                signature = header_value(headers, "X-Merset-Signature")
            timestamp = header_value(headers, "X-Merset-Timestamp")
        return verify_and_parse(
            raw_body,
            signature,
            secret,
            timestamp_header=timestamp,
            tolerance_seconds=tolerance_seconds,
        )

    def _request(
        self,
        method: str,
        path: str,
        *,
        query: Mapping[str, str] | None = None,
        body: Mapping[str, Any] | None = None,
    ) -> Any:
        url = self.base_url + path
        if query:
            url = f"{url}?{urlencode(list(query.items()))}"
        encoded: bytes | None = None
        if body is not None:
            encoded = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-API-Key": self.public_key,
            "X-API-Secret": self.secret_key,
            "User-Agent": _USER_AGENT,
        }
        try:
            status, raw = self._send(method, url, headers, encoded)
        except NorenError:
            raise
        except (URLError, TimeoutError, OSError) as exc:
            raise NorenError(f"API request failed: {exc}") from exc

        text = raw.decode("utf-8", errors="replace")
        payload: Any
        if text.strip():
            try:
                payload = json.loads(text)
            except json.JSONDecodeError as exc:
                raise NorenError(
                    f"Invalid JSON response (HTTP {status})",
                    status_code=status,
                    body=text,
                ) from exc
        else:
            payload = None

        if status >= 400:
            message, code, detail = _error_parts(payload, text)
            raise NorenError(
                f"API error HTTP {status}: {message}",
                status_code=status,
                code=code,
                detail=detail,
                body=text,
            )
        return payload

    def _send(
        self,
        method: str,
        url: str,
        headers: dict[str, str],
        body: bytes | None,
    ) -> tuple[int, bytes]:
        if self._transport is not None:
            return self._transport(method, url, headers, body)

        request = Request(url, data=body, method=method)
        for key, value in headers.items():
            request.add_header(key, value)
        try:
            with urlopen(request, timeout=self.timeout) as response:
                return int(response.status), response.read()
        except HTTPError as exc:
            return int(exc.code), exc.read()


def _path_segment(value: str) -> str:
    text = str(value).strip()
    if not text or "/" in text or text in {".", ".."}:
        raise ValueError("id must be a single path segment")
    return text


def _error_parts(payload: Any, raw: str) -> tuple[str, str | None, Any]:
    if not isinstance(payload, dict):
        return (raw[:500] or "empty error body"), None, payload
    detail = payload.get("detail", payload)
    code = payload.get("code")
    if isinstance(code, str):
        resolved_code: str | None = code
    else:
        resolved_code = None
    if isinstance(detail, dict):
        nested = detail.get("code")
        if isinstance(nested, str):
            resolved_code = nested
        message = detail.get("message")
        if not isinstance(message, str) or not message:
            message = json.dumps(detail, ensure_ascii=False)
        return message, resolved_code, detail
    if isinstance(detail, str) and detail:
        return detail, resolved_code, detail
    return json.dumps(payload, ensure_ascii=False), resolved_code, detail

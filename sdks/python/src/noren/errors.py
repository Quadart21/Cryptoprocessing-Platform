"""Errors raised by the merchant client."""

from __future__ import annotations

from typing import Any


class NorenError(Exception):
    """API, network, or payload error."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        code: str | None = None,
        detail: Any = None,
        body: str | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.detail = detail
        self.body = body


class NorenSignatureError(NorenError):
    """Incoming webhook signature or timestamp did not match."""

"""
Полный mock стороннего мерчанта для песочницы CryptoProcessing.

Платформа шлёт POST на URL проекта (после DNS + webhook обычно https://<fqdn>/webhook).
Подпись тела: заголовок X-Merset-Signature = sha256=<hex_hmac_sha256(secret, raw_body)>
(аналогично backend/app/services/client_webhook_service.py).

Переменные окружения:
  WEBHOOK_SECRET     — тот же секрет, что в настройках webhook проекта в кабинете мерчанта.
                       Если пусто, подпись не проверяется (только для локальной отладки).
  CP_API_BASE        — базовый URL API платформы, например https://pay.example.com/api/v1/client
  CP_API_PUBLIC_KEY  — публичный ключ API (из выдачи при создании песочницы).
  CP_API_SECRET_KEY  — секретный ключ API.
  CP_PROJECT_ID      — UUID проекта песочницы.
  ENABLE_TOOLS       — если "1"/"true", включить POST /tools/create-invoice для смоук-теста.

Запуск: uvicorn mock_server:app --host 0.0.0.0 --port 8080
"""

from __future__ import annotations

import hashlib
import hmac
import html
import json
import os
import threading
import uuid
from collections import deque
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse
from pydantic import BaseModel, Field

MAX_EVENTS = 500
_events_lock = threading.Lock()
_events: deque[dict[str, Any]] = deque(maxlen=MAX_EVENTS)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _env_flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def _verify_hmac(secret: str, body: bytes, signature_header: str | None) -> bool:
    if not secret.strip():
        return True
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected_hex = signature_header[7:].strip().lower()
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, expected_hex)


def _append_event(kind: str, payload: dict[str, Any]) -> None:
    row = {"ts": _utc_now_iso(), "kind": kind, "payload": payload}
    with _events_lock:
        _events.appendleft(row)


app = FastAPI(title="CryptoProcessing Merchant Mock", version="0.1.0")


@app.get("/health")
async def health() -> PlainTextResponse:
    return PlainTextResponse("ok", status_code=200)


@app.post("/webhook")
async def merchant_webhook(request: Request) -> JSONResponse:
    secret = (os.environ.get("WEBHOOK_SECRET") or "").strip()
    raw = await request.body()
    sig = request.headers.get("X-Merset-Signature")
    if not _verify_hmac(secret, raw, sig):
        raise HTTPException(status_code=401, detail="Invalid or missing webhook signature.")

    try:
        data = json.loads(raw.decode("utf-8")) if raw else {}
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Body must be JSON.") from exc

    meta = {
        "headers": {
            "X-Merset-Event": request.headers.get("X-Merset-Event"),
            "X-Merset-Event-Id": request.headers.get("X-Merset-Event-Id"),
            "X-Merset-Timestamp": request.headers.get("X-Merset-Timestamp"),
        },
        "body": data,
    }
    _append_event("webhook", meta)
    return JSONResponse({"received": True, "event_id": data.get("event_id")})


@app.get("/api/events")
async def list_events(limit: int = 50) -> JSONResponse:
    lim = max(1, min(limit, MAX_EVENTS))
    with _events_lock:
        snap = list(_events)[:lim]
    return JSONResponse({"events": snap})


@app.get("/", response_class=HTMLResponse)
async def dashboard() -> HTMLResponse:
    with _events_lock:
        snap = list(_events)[:80]
    rows_html = []
    for ev in snap:
        pretty = html.escape(json.dumps(ev, ensure_ascii=False, indent=2))
        rows_html.append(f"<pre class=\"evt\">{pretty}</pre>")
    empty_html = '<p class="muted">Пока пусто — вызовите тест webhook из кабинета или дождитесь оплаты.</p>'
    events_block = "".join(rows_html) if rows_html else empty_html
    body = f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Merchant mock — входящие webhook</title>
  <style>
    body {{ font-family: system-ui, sans-serif; margin: 1rem; background: #0f1419; color: #e7ecf3; }}
    h1 {{ font-size: 1.25rem; }}
    .muted {{ color: #8b98a8; font-size: 0.9rem; }}
    pre.evt {{ background: #151c24; padding: 0.75rem; border-radius: 8px; overflow: auto; font-size: 12px; }}
    a {{ color: #6cb7ff; }}
  </style>
</head>
<body>
  <h1>CryptoProcessing — merchant mock</h1>
  <p class="muted">Последние события (в памяти процесса, до {MAX_EVENTS} шт.).
     POST платформы: <code>/webhook</code> · JSON: <a href="/api/events">/api/events</a></p>
  {events_block}
</body>
</html>"""
    return HTMLResponse(body)


class CreateInvoiceBody(BaseModel):
    amount_fiat: Decimal = Field(gt=0)
    fiat_currency: str = Field(default="USD", min_length=3, max_length=10)
    merchant_order_id: str | None = Field(default=None, max_length=255)


@app.post("/tools/create-invoice")
async def tools_create_invoice(body: CreateInvoiceBody) -> JSONResponse:
    if not _env_flag("ENABLE_TOOLS"):
        raise HTTPException(status_code=404, detail="Tools disabled. Set ENABLE_TOOLS=1.")

    base = (os.environ.get("CP_API_BASE") or "").strip().rstrip("/")
    pub = (os.environ.get("CP_API_PUBLIC_KEY") or "").strip()
    sec = (os.environ.get("CP_API_SECRET_KEY") or "").strip()
    project_id = (os.environ.get("CP_PROJECT_ID") or "").strip()
    if not base or not pub or not sec or not project_id:
        raise HTTPException(
            status_code=500,
            detail="Configure CP_API_BASE, CP_API_PUBLIC_KEY, CP_API_SECRET_KEY, CP_PROJECT_ID.",
        )

    order_id = body.merchant_order_id or f"mock-{uuid.uuid4().hex[:12]}"
    payload = {
        "project_id": project_id,
        "merchant_order_id": order_id,
        "amount_fiat": str(body.amount_fiat),
        "fiat_currency": body.fiat_currency,
        "crypto_currency": "USDT",
        "network": "TRC20",
    }

    url = f"{base}/invoices"
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                url,
                json=payload,
                headers={
                    "X-API-Key": pub,
                    "X-API-Secret": sec,
                    "Content-Type": "application/json",
                },
            )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    text = resp.text[:2000]
    _append_event(
        "create_invoice",
        {"request_url": url, "status_code": resp.status_code, "response_preview": text},
    )

    try:
        data = resp.json()
    except json.JSONDecodeError:
        data = {"raw": text}

    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=data)

    return JSONResponse(data)


"""Generate Merchant API PDF (Russian). Run: python docs/generate_merchant_pdf.py"""
from __future__ import annotations

import sys
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "Merchant_API_noren.digital.pdf"
FONT = Path(r"C:\Windows\Fonts\arial.ttf")

if not FONT.exists():
    FONT = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")

SECTIONS: list[tuple[str, list[str]]] = [
    (
        "Документация Merchant API — noren.digital",
        [
            "База API: https://noren.digital/api/v1/client",
            "OpenAPI (merchant): https://noren.digital/docs",
            "Схема JSON: https://noren.digital/openapi.json",
            "Health: GET https://noren.digital/api/v1/client/health",
        ],
    ),
    (
        "Аутентификация",
        [
            "1) API-ключ: заголовки X-API-Key и X-API-Secret на каждый запрос.",
            "   Ключ привязан к проекту: при POST /invoices поле project_id должно совпадать с проектом ключа.",
            "2) JWT: Authorization: Bearer <access_token>",
            "   Токен: POST /api/v1/client/auth/login (email, password, при 2FA — otp_code).",
            "   Роли платформы (superadmin, platform_*) не могут вызывать client API.",
            "С API-ключом проверки ролей пользователя нет; с JWT — проверяются права RBAC.",
        ],
    ),
    (
        "Официальный список методов (merchant OpenAPI)",
        [
            "GET  /api/v1/client/health",
            "POST /api/v1/client/auth/login",
            "POST /api/v1/client/invoices",
            "GET  /api/v1/client/invoices",
            "GET  /api/v1/client/invoices/{invoice_id}",
            "POST /api/v1/client/invoices/{invoice_id}/sync",
            "GET  /api/v1/client/balance",
            "GET  /api/v1/client/rates",
            "GET  /api/v1/client/transactions",
            "GET  /api/v1/client/transactions/{transaction_id}",
        ],
    ),
    (
        "POST /invoices — тело JSON",
        [
            "project_id (string, UUID) — проект;",
            "merchant_order_id (string, 1–255) — ваш id заказа;",
            "amount_fiat (decimal, > 0);",
            "fiat_currency (string, по умолчанию USD);",
            "crypto_currency (string, напр. USDT);",
            "network (string, напр. TRC20);",
            "metadata (object | null) — опционально.",
            "Ответ: id, project_id, merchant_order_id, provider_order_id, суммы, валюты, network,",
            "payment_address, qr_url, status, expires_at, created_at.",
            "Права: API-ключ или JWT с client.invoices.write.",
        ],
    ),
    (
        "GET /invoices, GET /invoices/{id}",
        [
            "Query: limit (по умолчанию 50, макс. 200), offset (>= 0).",
            "Права: client.invoices.read.",
            "Для API-ключа — только инвойсы проекта ключа.",
        ],
    ),
    (
        "POST /invoices/{id}/sync",
        [
            "Синхронизация статуса с платёжным провайдером.",
            "JWT: нужно право client.invoices.write.",
        ],
    ),
    (
        "GET /balance",
        [
            "Права: client.balance.read.",
            "Поля: currency, available_amount, locked_amount, total_amount, amount.",
        ],
    ),
    (
        "GET /rates",
        [
            "Права: client.rates.read.",
            "Ответ: items[] — валюты и networks с лимитами min/max deposit и флагами доступности.",
        ],
    ),
    (
        "Комиссия платформы",
        [
            "Стандартный тариф: 0,4% от суммы успешного платежа, но не ниже 7 USD (эквивалент в USDT при settlement).",
            "Формула: комиссия = max(сумма × 0,004, 7,00 USD); нетто = сумма − комиссия.",
            "Примеры: $500 → комиссия $7 (минимум); $1 000 → $7; $1 750 → $7 (порог); $2 000 → $8; $10 000 → $40.",
            "Порог минимума: платежи до $1 750 включительно — комиссия $7.",
            "Комиссия сети (blockchain) — отдельно от тарифа платформы.",
            "Детализация: GET /transactions — gross_amount, provider_fee, platform_fee, net_amount.",
        ],
    ),
    (
        "GET /transactions, GET /transactions/{id}",
        [
            "Права: client.transactions.read.",
            "Поля строки: id, tenant_id, project_id, invoice_id, gross_amount, provider_fee,",
            "platform_fee, turnover_fee, net_amount, currency, status, paid_at, created_at.",
            "Для API-ключа — фильтр по проекту ключа.",
        ],
    ),
    (
        "Дополнительно (кабинет, в основном JWT)",
        [
            "/auth/register, /auth/set-password, /auth/recover-password;",
            "/me; 2FA; смена пароля; уведомления;",
            "/cabinet, /onboarding/status;",
            "/projects; /api-keys/*; /webhooks, /webhooks/test;",
            "/accounting/summary — только JWT, client.accounting.read;",
            "POST/GET /payouts — только JWT, client.payouts.write / client.payouts.read;",
            "Публичные страницы: GET /public-pages, GET /public-pages/{slug} — без авторизации.",
        ],
    ),
    (
        "Исходящий webhook на URL мерчанта",
        [
            "POST JSON; User-Agent: Merset-Webhook/1.0;",
            "Заголовки: X-Merset-Event, X-Merset-Event-Id, X-Merset-Timestamp;",
            "X-Merset-Signature: sha256=<hex> — HMAC-SHA256(body UTF-8, JSON без лишних пробелов),",
            "секрет — webhook secret проекта.",
            "Тело: event, event_id, sent_at, invoice {...}, transaction {...} (если есть).",
            "Тест: event webhook.test.",
        ],
    ),
    (
        "Ошибки и лимиты",
        [
            "422: validation_error + массив errors;",
            "409: конфликт уникальности;",
            "Часто: detail + code request_error или internal_error.",
            "Rate limit: возможен ответ 429 при превышении лимитов.",
        ],
    ),
    (
        "Рекомендуемый поток",
        [
            "1) Кабинет: проект + API-ключ + webhook.",
            "2) GET /rates — соблюдать лимиты.",
            "3) POST /invoices — показать payment_address / QR.",
            "4) Webhook и/или GET инвойса, при необходимости POST .../sync.",
            "5) Сверка: GET /transactions, GET /balance.",
        ],
    ),
]


def main() -> None:
    if not FONT.exists():
        print("Не найден шрифт TTF (Arial/DejaVu). Укажите путь к .ttf в скрипте.", file=sys.stderr)
        sys.exit(1)

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()
    pdf.add_font("DocFont", "", str(FONT))
    pdf.set_font("DocFont", size=11)

    for title, lines in SECTIONS:
        pdf.set_font("DocFont", size=14)
        pdf.multi_cell(0, 8, title)
        pdf.ln(2)
        pdf.set_font("DocFont", size=10)
        for line in lines:
            pdf.multi_cell(0, 5, line)
            pdf.ln(1)
        pdf.ln(4)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT))
    print(f"Written: {OUT}")


if __name__ == "__main__":
    main()

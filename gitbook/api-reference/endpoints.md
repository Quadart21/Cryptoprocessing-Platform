# Примеры запросов

Запросы, ответы и типовые ошибки для всех merchant-методов.

Base URL: `https://api.noren.digital/api/v1/client`

---

## GET /health

**Назначение:** быстрый ping backend без авторизации.

**Авторизация:** нет

```bash
curl -X GET "https://api.noren.digital/api/v1/client/health"
```

**Успех:**

```json
{
  "status": "ok",
  "scope": "client"
}
```

**Ошибка:**

```
HTTP 503
{
  "detail": "Service unavailable.",
  "code": "service_unavailable"
}
```

---

## POST /auth/login

**Назначение:** получить JWT-токены для cabinet-only endpoints.

**Авторизация:** нет

```bash
curl -X POST "https://api.noren.digital/api/v1/client/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@example.com",
    "password": "StrongPass123!",
    "otp_code": "123456"
  }'
```

**Успех:**

```json
{
  "access_token": "<jwt_access>",
  "refresh_token": "<jwt_refresh>",
  "token_type": "bearer"
}
```

**Ошибка:**

```
HTTP 401
{
  "detail": "Неверный email или пароль.",
  "code": "request_error"
}
```

---

## POST /invoices

**Назначение:** создать счёт на оплату. Формат реквизитов в ответе определяется `checkout_delivery` проекта.

**Авторизация:** X-API-Key + X-API-Secret

**Заметки:**

* `project_id` должен принадлежать API-ключу.
* Перед созданием вызывайте `GET /rates`: `min_deposit` — в криптовалюте, `min_deposit_fiat` — ориентир в USD.
* `checkout_delivery`: `payment_page` → только `payment_page_url`; `h2h` → `payment_address` и `qr_url`; `both` → все поля.
* `payment_page_url` ведёт на hosted checkout (QR, таймер, статус).

```bash
curl -X POST "https://api.noren.digital/api/v1/client/invoices" \
  -H "X-API-Key: <public_key>" \
  -H "X-API-Secret: <secret_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "<project_id>",
    "merchant_order_id": "order_1001",
    "amount_fiat": 100,
    "fiat_currency": "USD",
    "crypto_currency": "USDT",
    "network": "TRC20"
  }'
```

**Успех:**

```json
{
  "id": "inv_01J_DOCS_EXAMPLE",
  "project_id": "<project_id>",
  "merchant_order_id": "order_1001",
  "provider_order_id": "cc_992211",
  "amount_fiat": "100.00",
  "fiat_currency": "USD",
  "amount_crypto": "100.25",
  "crypto_currency": "USDT",
  "network": "TRC20",
  "payment_page_url": "https://noren.digital/pay/abc123example",
  "checkout_delivery": "payment_page",
  "status": "pending",
  "expires_at": "2026-04-06T11:45:00Z",
  "created_at": "2026-04-06T11:30:00Z"
}
```

**Ошибка (сумма вне диапазона):**

```
HTTP 400
{
  "detail": {
    "code": "amount_out_of_range",
    "message": "Сумма 1 USDT для USDT/TRC20 вне допустимого диапазона (min 5 USDT, max 5000 USDT).",
    "currency": "USDT",
    "network": "TRC20",
    "min_amount": "5",
    "max_amount": "5000"
  }
}
```

---

## GET /invoices

**Назначение:** список инвойсов с пагинацией.

**Авторизация:** X-API-Key + X-API-Secret

```bash
curl -X GET "https://api.noren.digital/api/v1/client/invoices?limit=20&offset=0" \
  -H "X-API-Key: <public_key>" \
  -H "X-API-Secret: <secret_key>"
```

**Успех:** массив объектов инвойса (см. POST /invoices).

**Ошибка:**

```
HTTP 403
{
  "detail": "Недостаточно прав: client.invoices.read.",
  "code": "request_error"
}
```

---

## GET /invoices/{invoice\_id}

**Назначение:** текущий статус и реквизиты одного инвойса.

**Авторизация:** X-API-Key + X-API-Secret

```bash
curl -X GET "https://api.noren.digital/api/v1/client/invoices/<invoice_id>" \
  -H "X-API-Key: <public_key>" \
  -H "X-API-Secret: <secret_key>"
```

**Ошибка:**

```
HTTP 404
{
  "detail": "Инвойс не найден.",
  "code": "request_error"
}
```

---

## POST /invoices/{invoice\_id}/sync

**Назначение:** принудительно обновить статус инвойса у провайдера.

**Авторизация:** X-API-Key + X-API-Secret (или Bearer JWT с `client.invoices.write`)

```bash
curl -X POST "https://api.noren.digital/api/v1/client/invoices/<invoice_id>/sync" \
  -H "X-API-Key: <public_key>" \
  -H "X-API-Secret: <secret_key>"
```

**Ошибка:**

```
HTTP 403
{
  "detail": "Недостаточно прав: client.invoices.write."
}
```

---

## GET /rates

**Назначение:** список валют и сетей с лимитами депозита/вывода.

**Авторизация:** X-API-Key + X-API-Secret

```bash
curl -X GET "https://api.noren.digital/api/v1/client/rates" \
  -H "X-API-Key: <public_key>" \
  -H "X-API-Secret: <secret_key>"
```

**Успех (фрагмент):**

```json
{
  "items": [
    {
      "currency": "USDT",
      "networks": [
        {
          "network": "TRC20",
          "ticker": "USDTTRC",
          "min_deposit": "5",
          "max_deposit": "5000",
          "min_deposit_fiat": "5",
          "max_deposit_fiat": "5000",
          "availability": true,
          "client_available": true,
          "acquiring": true,
          "memo_required": false
        }
      ]
    }
  ]
}
```

---

## GET /balance

**Назначение:** доступный, замороженный и суммарный баланс.

**Авторизация:** X-API-Key + X-API-Secret

```bash
curl -X GET "https://api.noren.digital/api/v1/client/balance" \
  -H "X-API-Key: <public_key>" \
  -H "X-API-Secret: <secret_key>"
```

**Успех:**

```json
{
  "currency": "USDT",
  "amount": "9500.00",
  "available_amount": "9500.00",
  "frozen_amount": "321.34",
  "pending_amount": "0.00",
  "locked_amount": "120.00",
  "total_amount": "9941.34",
  "hold_hours": 24,
  "next_release_at": "2026-06-05T12:00:00Z",
  "holds": []
}
```

---

## GET /transactions

**Назначение:** история транзакций с breakdown комиссий.

**Авторизация:** X-API-Key + X-API-Secret

```bash
curl -X GET "https://api.noren.digital/api/v1/client/transactions?limit=20&offset=0" \
  -H "X-API-Key: <public_key>" \
  -H "X-API-Secret: <secret_key>"
```

**Успех (элемент массива):**

```json
{
  "id": "tx_01J_DOCS_EXAMPLE",
  "tenant_id": "<tenant_id>",
  "project_id": "<project_id>",
  "invoice_id": "inv_01J_DOCS_EXAMPLE",
  "gross_amount": "100.00",
  "provider_fee": "0.20",
  "platform_fee": "0.80",
  "turnover_fee": "0.10",
  "net_amount": "98.90",
  "currency": "USDT",
  "status": "confirmed",
  "paid_at": "2026-04-06T11:41:00Z",
  "created_at": "2026-04-06T11:30:00Z"
}
```

---

## GET /transactions/{transaction\_id}

**Назначение:** детали одной транзакции.

**Авторизация:** X-API-Key + X-API-Secret

```bash
curl -X GET "https://api.noren.digital/api/v1/client/transactions/<transaction_id>" \
  -H "X-API-Key: <public_key>" \
  -H "X-API-Secret: <secret_key>"
```

**Ошибка:**

```
HTTP 404
{
  "detail": "Транзакция не найдена.",
  "code": "request_error"
}
```

# Быстрый старт

Ключи, первый инвойс и авторизация — минимум шагов до тестового платежа.

## Пошаговое подключение

1. В кабинете мерчанта откройте раздел **API-ключи** и получите **public key** и **secret key**.
2. Сохраните оба значения **только на backend** вашего проекта.
3. Вызовите `GET /rates`, чтобы выбрать доступный токен и сеть.
4. Создайте тестовый инвойс через `POST /invoices`.
5. Формат checkout (payment page или H2H) задаёт администратор платформы для вашего проекта.
6. Отправьте клиенту `payment_page_url` или покажите адрес/QR — в зависимости от режима.
7. Проверьте статус через `GET /invoices/{invoice_id}` и при необходимости `POST /invoices/{invoice_id}/sync`.
8. Настройте webhook (JWT) и проверьте доставку через `POST /webhooks/test`.

## Где взять public и secret

* **Public key** виден в кабинете в разделе «API-ключи».
* **Secret key** показывается при создании или перевыпуске ключа — сохраните сразу.
* Secret **нельзя** хранить во frontend, браузере или публичном репозитории.

## Авторизация

### Server-to-server (оплаты, баланс, транзакции)

```http
X-API-Key: <public_key>
X-API-Secret: <secret_key>
```

### Кабинет (webhooks, профиль)

```http
Authorization: Bearer <jwt_access>
```

JWT получают через `POST /auth/login`. Массовые оплаты по-прежнему делаются через API-ключ.

{% hint style="warning" %}
После ротации ключей обновите конфигурацию backend без задержки.
{% endhint %}

## Первый инвойс

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

## Дальше

* [Checkout](checkout.md) — как отдавать клиенту ссылку или реквизиты
* [Webhooks](webhooks.md) — подтверждение оплаты на вашем backend
* [API Reference](api-reference/endpoints.md) — все методы с примерами

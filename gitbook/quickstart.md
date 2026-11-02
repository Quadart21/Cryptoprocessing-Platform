# Быстрый старт

Ключи, авторизация, первый счёт и как читать статус.

Base URL: `https://api.noren.digital/api/v1/client`

## Ключи

1. В кабинете откройте «API-ключи» и создайте ключ.
2. Public key можно посмотреть позже. Secret показывается один раз — сохраните сразу.
3. Оба значения держите только на backend.
4. Вызовите `GET /rates` и выберите валюту и сеть, где `client_available = true`.
5. Создайте тестовый счёт `POST /invoices`.
6. Настройте webhook и отправьте тест до боевых заказов.

Secret нельзя класть во frontend, приложение или публичный репозиторий.

## Авторизация

Оплаты, баланс, курсы и транзакции — server-to-server:

```http
X-API-Key: <public_key>
X-API-Secret: <secret_key>
```

Настройка webhook идёт через кабинет: `POST /auth/login` даёт JWT, его кладут в `Authorization: Bearer`. Сами счета создаются ключами.

## Первый счёт

`merchant_order_id` — ваш номер заказа. Сумма задаётся в фиате, в ответе будет `amount_crypto`, которую должен отправить клиент.

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

| Поле | Обязательно | Зачем |
| --- | --- | --- |
| `project_id` | да | Проект этого ключа. Чужой id вернёт 400. |
| `merchant_order_id` | да | Ваш id заказа, до 255 символов. |
| `amount_fiat` | да | Сумма в фиате, больше нуля. |
| `fiat_currency` | нет | По умолчанию `USD`. |
| `crypto_currency` | нет | По умолчанию `USDT`. Берите из `/rates`. |
| `network` | нет | По умолчанию `TRC20`. |
| `metadata` | нет | Ваш объект для сверки. В ответ не возвращается. |

Клиенту отдаёте не весь JSON. При `checkout_delivery = payment_page` — только `payment_page_url`. При `h2h` — `payment_address` и `qr_url`.

## Статусы

| Статус | Смысл |
| --- | --- |
| `pending` | Счёт создан, перевода ещё нет. |
| `confirming` | Перевод найден, ждём сеть. |
| `paid` | Сумма получена. Переплата зачисляется здесь по факту. |
| `confirmed` | Можно закрывать заказ. |
| `underpaid` | Пришло меньше. Заявка открыта: доплата на тот же адрес или приём уже пришедшего. |
| `expired` | Время вышло. |
| `cancelled` | Счёт отменён. |
| `failed` | Ошибка, в том числе неверная валюта или сеть. |
| `aml_frozen` | Депозит на проверке. Заказ не закрывайте. |

## Ошибки

Ошибка — HTTP-код и JSON с `detail`.

* `401` — нет заголовков или ключ неверный.
* `400` — чужой `project_id`, пустой заказ или сумма вне лимита (`amount_out_of_range`, смотрите `min_amount` / `max_amount`).
* `404` — счёт или транзакция не найдены у этого ключа.
* `503` — повторите запрос позже.

Дальше: [счета](api-reference/invoices.md), [webhook](webhooks.md), [SDK Python и Node.js](sdk.md).

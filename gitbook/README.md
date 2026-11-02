# Merchant API

Документация для магазинов и сервисов, которые принимают криптооплату.

Каждый раздел короткий: зачем метод, какие поля, пример запроса и что значит ответ.

## С чего начать

1. **Ключи** — public и secret только на backend.
2. **Курсы** — `GET /rates`, выбрать сеть и лимиты.
3. **Счёт** — `POST /invoices`.
4. **Webhook** — подтверждение оплаты на ваш URL.

## Окружение

| Параметр | Значение |
| --- | --- |
| Base URL | `https://api.noren.digital/api/v1/client` |
| OpenAPI | [https://noren.digital/openapi.json](https://noren.digital/openapi.json) |
| Swagger | [https://noren.digital/docs](https://noren.digital/docs) |
| Кабинет | [https://app.noren.digital](https://app.noren.digital) |
| Документация на сайте | [https://docs.noren.digital](https://docs.noren.digital) |

Префикс `/api/v1/client` уже входит в Base URL. В примерах пути выглядят как `/invoices` и `/rates`.

## Разделы

* [Быстрый старт](quickstart.md) — ключи, авторизация, первый счёт, статусы, ошибки
* [Счета](api-reference/invoices.md) — создать, список, один счёт, sync, недоплата
* [Баланс](api-reference/balance.md) — доступно и холд
* [Транзакции](api-reference/transactions.md) — проводка и комиссия
* [Курсы и лимиты](api-reference/rates.md) — валюты и сети
* [Checkout](checkout.md) — ссылка `/pay/{token}` или адрес и QR
* [Webhook](webhooks.md) — тело, заголовки, HMAC
* [Комиссии](commissions.md) — 0,4%, минимум $0,70

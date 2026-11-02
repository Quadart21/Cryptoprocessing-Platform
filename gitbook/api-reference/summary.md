# Сводка методов

Все merchant-методы в одной таблице.

Base URL: `https://api.noren.digital/api/v1/client`

Полные пути в OpenAPI включают префикс `/api/v1/client`.

| Метод | Путь | Авторизация |
| --- | --- | --- |
| GET | `/health` | Нет |
| POST | `/auth/login` | Нет |
| POST | `/invoices` | X-API-Key + X-API-Secret |
| GET | `/invoices` | X-API-Key + X-API-Secret |
| GET | `/invoices/{invoice_id}` | X-API-Key + X-API-Secret |
| POST | `/invoices/{invoice_id}/sync` | X-API-Key + X-API-Secret |
| POST | `/invoices/{invoice_id}/accept-received` | X-API-Key + X-API-Secret |
| GET | `/rates` | X-API-Key + X-API-Secret |
| GET | `/balance` | X-API-Key + X-API-Secret |
| GET | `/transactions` | X-API-Key + X-API-Secret |
| GET | `/transactions/{transaction_id}` | X-API-Key + X-API-Secret |

## Группы

### Проверка

* `GET /health` — ping без авторизации

### Доступ

* `POST /auth/login` — JWT для кабинета и webhooks

### Оплаты

* [Счета](invoices.md) — `POST /invoices`, список, один счёт, `sync`, `accept-received`
* [Курсы и лимиты](rates.md) — `GET /rates`

### Финансы

* [Баланс](balance.md) — `GET /balance`
* [Транзакции](transactions.md) — `GET /transactions`, `GET /transactions/{id}`

Пояснения и примеры — на страницах выше. Сырые curl по всем методам — [Примеры запросов](endpoints.md).

Кабинетные JWT-методы — [Кабинет (JWT)](cabinet.md).

Webhooks — [Webhooks](../webhooks.md).

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
| POST | `/invoices/{invoice_id}/sync` | X-API-Key + X-API-Secret (или JWT) |
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

* `POST /invoices`, `GET /invoices`, `GET /invoices/{id}`, `POST /invoices/{id}/sync`
* `GET /rates`

### Финансы

* `GET /balance`
* `GET /transactions`, `GET /transactions/{id}`

Подробные примеры curl и JSON — на странице [Примеры запросов](endpoints.md).

Кабинетные JWT-методы — [Кабинет (JWT)](cabinet.md).

Webhooks — [Webhooks](../webhooks.md).

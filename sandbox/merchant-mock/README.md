# Merchant mock (песочница)

Сервис имитирует **внешний магазин / бэкенд мерчанта** рядом с CryptoProcessing.

## Что умеет

- **`POST /webhook`** — принимает исходящие уведомления платформы (события по инвойсам, тест). Проверяет `X-Merset-Signature: sha256=...` так же, как платформа подписывает тело (`client_webhook_service`).
- **`GET /`** — простая страница с последними событиями.
- **`GET /api/events`** — JSON с историей (в памяти процесса).
- **`GET /health`** — проверка живости.
- **`POST /tools/create-invoice`** (если `ENABLE_TOOLS=1`) — создаёт тестовый инвойс через Client API (`POST .../invoices`).

## Быстрый запуск

```bash
cd sandbox/merchant-mock
docker compose up -d --build
```

На VPS откройте порт (например `80:8080` в `docker-compose.yml`), чтобы Cloudflare вёл трафик на origin.

## Секрет webhook

Значение **`WEBHOOK_SECRET`** в окружении контейнера должно совпадать с секретом webhook проекта в кабинете мерчанта песочницы (после «DNS + webhook» платформа генерирует новый секрет — скопируйте его из настроек проекта / webhook).

Если секрет пустой в mock — подпись **не** проверяется (только для отладки).

## Смоук-тест инвойса из mock

В `.env` или `environment` в compose задайте:

- `CP_API_BASE` — например `https://ваш-домен/api/v1/client`
- `CP_API_PUBLIC_KEY`, `CP_API_SECRET_KEY`, `CP_PROJECT_ID` — из выдачи при создании песочницы.
- `ENABLE_TOOLS=1`

Пример:

```bash
curl -sS -X POST "http://127.0.0.1:8080/tools/create-invoice" \
  -H "Content-Type: application/json" \
  -d '{"amount_fiat":"12.50","fiat_currency":"USD"}'
```

Платформа должна дернуть ваш `https://<FQDN>/webhook` при смене статуса; события появятся на `/`.

# Кабинет (JWT)

После `POST /auth/login` используйте `access_token` в заголовке `Authorization: Bearer <jwt>`.

Эти маршруты удобны для серверных BFF-прослоек рядом с кабинетом; массовые оплаты по-прежнему делаются через API-ключ.

## GET /me — текущий пользователь

```bash
curl -X GET "https://api.noren.digital/api/v1/client/me" \
  -H "Authorization: Bearer <jwt_access>"
```

```json
{
  "id": "<user_id>",
  "tenant_id": "<tenant_id>",
  "email": "owner@example.com",
  "full_name": "Owner",
  "role": "owner",
  "status": "active",
  "permissions": ["client.invoices.read", "client.invoices.write"],
  "totp_enabled": false
}
```

## GET /cabinet — проверка доступа

```bash
curl -X GET "https://api.noren.digital/api/v1/client/cabinet" \
  -H "Authorization: Bearer <jwt_access>"
```

```json
{
  "status": "ok",
  "message": "Добро пожаловать, Owner. Кабинет доступен."
}
```

## Webhooks (JWT)

Настройка и тест webhook — см. [Webhooks](../webhooks.md).

Требуется право `client.webhooks.write`.

# 1С:Предприятие

Примеры кода для **1С:УТ**, **1С:Розница**, **1С:УНФ** и других конфигураций с HTTP-сервисами.

## Что в комплекте

| Файл | Назначение |
| --- | --- |
| `http-service/NorenDigitalPayments.bsl` | HTTP-сервис: создание инвойса + приём webhook |
| `common-module/NorenAPI.bsl` | Общий модуль — вызовы Merchant API |
| `external-processing/CreateNorenPayment.bsl` | Кнопка «Оплатить криптой» на форме заказа |

## merchant_order_id

Используйте префикс **`1c-{номер_заказа}`** — так webhook сопоставит платёж с документом.

## Настройка HTTP-сервиса

1. Создайте HTTP-сервис `noren`, корневой URL `noren`.
2. Шаблоны URL:
   - `POST /v1/invoice` → `InvoiceCreate`
   - `POST /v1/webhook` → `WebhookReceive`
3. Опубликуйте базу на веб-сервере (Apache/IIS + 1C publication).
4. В кабинете мерчанта Webhook URL:

   `https://1c.example.com/noren/hs/noren/v1/webhook`

   (точный путь зависит от публикации — проверьте в конфигураторе.)

## Настройки API

Храните в **регистре сведений** или константах:

- `ApiBaseUrl` — `https://api.<домен>/api/v1/client`
- `PublicKey`, `SecretKey`, `ProjectId`
- `WebhookSecret` — для проверки `X-Merset-Signature`

## Создание инвойса из 1С

```bsl
Инвойс = NorenAPI.СоздатьИнвойс("00001234", 1500.00, "USD");
URL = Инвойс.payment_page_url; // открыть клиенту
```

## Webhook → проводки

В модуле `NorenЗаказы` (реализуйте под вашу конфигурацию):

- при `paid` / `confirmed` — установить признак оплаты, создать ПКО / закрыть заказ;
- при `expired` — вернуть заказ в «ожидает оплаты».

## HMAC подпись

Реализуйте `HMAC_SHA256` по [gitbook/webhooks.md](../gitbook/webhooks.md). В типовых конфигурациях часто используют функции БСП или `МенеджерКриптографии`.

## CommerceML / обмен с сайтом

Если магазин на WordPress/DLE, а учёт в 1С — достаточно webhook в 1С + обмен номерами заказов через `merchant_order_id`. Альтернатива: сайт создаёт инвойс, 1С только слушает webhook по своим заказам с префиксом `1c-`.

## Тест

1. `POST /webhooks/test` из кабинета мерчанта → HTTP 200 от 1С.
2. Создайте тестовый инвойс → откройте `payment_page_url`.
3. После оплаты проверьте запись в регистре оплат.

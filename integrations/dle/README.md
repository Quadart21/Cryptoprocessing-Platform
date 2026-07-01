# DataLife Engine (DLE)

Модуль оплаты для встроенного **Billing** DLE: пополнение баланса пользователя, платные подписки и т.п.

## Файлы

| Файл в репозитории | Куда положить на сервере |
| --- | --- |
| `integrations/dle/noren.php` | `engine/modules/billing/payment/noren.php` |
| `integrations/dle/noren_webhook.php` | `engine/modules/billing/payment/noren_webhook.php` |
| `integrations/dle/vendor/` | `engine/modules/billing/payment/vendor/` (вместе с noren.php) |

## Регистрация в админке

1. **Панель управления → Billing → Платёжные системы → Добавить**.
2. Имя модуля: `noren`, класс: `NOREN`.
3. Заполните API-ключи, project_id, webhook secret.
4. В кабинете мерчанта укажите Webhook URL:

   `https://ваш-сайт.ru/engine/modules/billing/payment/noren_webhook.php`

## merchant_order_id

Формат: `dle-{billing_invoice_id}` — по нему webhook помечает счёт оплаченным.

## Ограничения

- Нужен режим checkout **payment_page** (hosted checkout).
- Secret key только на сервере, не в шаблонах DLE.

## Свой интернет-магазин на DLE

Если используете не billing, а кастомные заказы — вызывайте Merchant API из PHP-модуля по аналогии с `NOREN::pay()` и обрабатывайте webhook в `noren_webhook.php`, меняя префикс `dle-` на свой.

# CMS-модули (WordPress, DLE, Tilda, 1С)

Готовые модули для подключения магазина без написания API с нуля.

## Скачивание

| Платформа | Архив |
| --- | --- |
| WordPress + WooCommerce | [/downloads/noren-wordpress.zip](/downloads/noren-wordpress.zip) |
| DataLife Engine | [/downloads/noren-dle.zip](/downloads/noren-dle.zip) |
| Tilda | [/downloads/noren-tilda.zip](/downloads/noren-tilda.zip) |
| 1С:Предприятие | [/downloads/noren-1c.zip](/downloads/noren-1c.zip) |
| Все модули | [/downloads/noren-integrations-all.zip](/downloads/noren-integrations-all.zip) |

Исходники: каталог `integrations/` в [репозитории](https://github.com/Quadart21/Cryptoprocessing-Platform/tree/main/integrations).

## Общая схема

1. Установите модуль на сайт / опубликуйте HTTP-сервис (1С).
2. Укажите API Base URL, `project_id`, public и secret keys.
3. Webhook URL из модуля → кабинет мерчанта; тот же **webhook secret** в модуле и кабинете.
4. Режим checkout: **payment_page** (редирект на `/pay/{token}`).
5. `merchant_order_id` с префиксом платформы: `wc-`, `dle-`, `tilda-`, `1c-`.

## WordPress

См. `integrations/wordpress/README.md` — плагин WooCommerce, webhook ` /wp-json/noren/v1/webhook`.

## DLE

Модуль billing + `noren_webhook.php`. Webhook URL: `https://site.ru/engine/modules/billing/payment/noren_webhook.php`.

## Tilda

PHP-bridge на вашем хостинге + HTML-форма в Zero Block. Secret key **только** на bridge.

## 1С

Примеры BSL: HTTP-сервис для webhook и `NorenAPI.СоздатьИнвойс()`.

## Дальше

* [Webhooks](webhooks.md) — подпись и формат payload
* [Checkout](checkout.md) — payment page / H2H

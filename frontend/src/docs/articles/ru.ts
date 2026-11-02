import type { DocsArticle, DocsArticleKey } from "./types";

const articles: Record<DocsArticleKey, DocsArticle> = {
  quickstart: {
    sections: [
      {
        id: "keys",
        title: "Ключи",
        blocks: [
          {
            kind: "p",
            text: "Merchant API принимает оплату в крипте: вы создаёте счёт, клиент платит, ваш backend узнаёт об этом по webhook. Все запросы идут на Base URL, префикс /api/v1/client уже входит в него.",
          },
          {
            kind: "list",
            ordered: true,
            items: [
              "В кабинете откройте «API-ключи» и создайте ключ.",
              "Public key можно посмотреть позже. Secret показывается один раз — сохраните его сразу.",
              "Оба значения храните только на backend: переменные окружения или секрет-хранилище.",
              "Вызовите GET /rates и выберите валюту и сеть, которые доступны клиенту.",
              "Создайте тестовый счёт POST /invoices и отдайте клиенту ссылку или адрес.",
              "Настройте webhook и проверьте доставку, прежде чем включать боевые заказы.",
            ],
          },
          {
            kind: "note",
            tone: "warn",
            text: "Secret нельзя класть во frontend, мобильное приложение или публичный репозиторий. После ротации ключей сразу обновите конфиг сервера.",
          },
        ],
      },
      {
        id: "auth",
        title: "Авторизация",
        blocks: [
          {
            kind: "p",
            text: "Оплаты, баланс, курсы и транзакции — это server-to-server. На каждый такой запрос добавьте два заголовка. Регистр имён заголовков не важен, значения — точные.",
          },
          {
            kind: "code",
            label: "Заголовки",
            text: "X-API-Key: <public_key>\nX-API-Secret: <secret_key>",
          },
          {
            kind: "params",
            rows: [
              {
                name: "X-API-Key",
                required: "да",
                text: "Публичный ключ проекта. Его можно показать в логах запроса, но лучше не светить лишний раз.",
              },
              {
                name: "X-API-Secret",
                required: "да",
                text: "Секретный ключ. Им подписывается доступ к API. Не передавайте его браузеру.",
              },
            ],
          },
          {
            kind: "p",
            text: "Настройка webhook в кабинетном API идёт отдельно: POST /auth/login возвращает JWT, его кладут в Authorization: Bearer. Сами счета создаются ключами, не токеном кабинета.",
          },
        ],
      },
      {
        id: "first-invoice",
        title: "Первый счёт",
        blocks: [
          {
            kind: "p",
            text: "Счёт — это заявка на пополнение. Сумма задаётся в фиате, платформа считает крипто-сумму по курсу. merchant_order_id — ваш номер заказа: по нему вы потом сверите оплату.",
          },
          {
            kind: "code",
            label: "Запрос",
            text: `curl -X POST "{{apiBase}}/invoices" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "<project_id>",
    "merchant_order_id": "order_1001",
    "amount_fiat": 100,
    "fiat_currency": "USD",
    "crypto_currency": "USDT",
    "network": "TRC20"
  }'`,
          },
          {
            kind: "params",
            rows: [
              { name: "project_id", required: "да", text: "Проект, к которому привязан API-ключ. Чужой project_id вернёт 400." },
              { name: "merchant_order_id", required: "да", text: "Ваш идентификатор заказа, до 255 символов. Храните его у себя рядом с платежом." },
              { name: "amount_fiat", required: "да", text: "Сумма к оплате в фиатной валюте. Больше нуля." },
              { name: "fiat_currency", required: "нет", text: "Валюта суммы. По умолчанию USD." },
              { name: "crypto_currency", required: "нет", text: "Какой токен ждёте. По умолчанию USDT. Берите пару из GET /rates." },
              { name: "network", required: "нет", text: "Сеть, например TRC20. По умолчанию TRC20. Должна быть в списке rates и доступна клиенту." },
              { name: "metadata", required: "нет", text: "Произвольный объект для вашей сверки. В ответ API не подмешивается." },
            ],
          },
        ],
      },
      {
        id: "response",
        title: "Что приходит в ответе",
        blocks: [
          {
            kind: "code",
            label: "Успех · 201",
            text: `{
  "id": "inv_01J_DOCS_EXAMPLE",
  "project_id": "<project_id>",
  "merchant_order_id": "order_1001",
  "amount_fiat": "100.00",
  "fiat_currency": "USD",
  "amount_crypto": "100.25",
  "crypto_currency": "USDT",
  "network": "TRC20",
  "payment_page_url": "https://noren.digital/pay/abc123example",
  "checkout_delivery": "payment_page",
  "status": "pending",
  "expires_at": "2026-04-06T11:45:00Z"
}`,
          },
          {
            kind: "p",
            text: "Клиенту отдаёте не весь JSON, а то, что разрешает checkout_delivery проекта. payment_page — только ссылку payment_page_url. h2h — адрес payment_address и qr_url, ссылки на страницу нет. Режим задаёт администратор платформы, мерчант его видит, но сам не переключает.",
          },
          {
            kind: "note",
            tone: "info",
            text: "amount_crypto — сумма, которую должен отправить клиент. Сверяйте сеть: перевод USDT в другой сети на этот адрес не зачислится.",
          },
        ],
      },
      {
        id: "statuses",
        title: "Статусы счёта",
        blocks: [
          {
            kind: "p",
            text: "Статус приходит и в GET /invoices/{id}, и в webhook. Ориентируйтесь на него, а не на разовый ответ создания счёта.",
          },
          {
            kind: "table",
            headers: ["Статус", "Что это значит"],
            rows: [
              ["pending", "Счёт создан, перевод ещё не виден."],
              ["confirming", "Перевод найден, ждём подтверждения сети."],
              ["paid", "Сумма получена и проводится. Переплата зачисляется здесь же, по факту."],
              ["confirmed", "Оплата подтверждена, можно закрывать заказ."],
              ["underpaid", "Пришло меньше. Заявка открыта: клиент доплачивает на тот же адрес или вы принимаете уже пришедшее."],
              ["expired", "Время счёта вышло, новой оплаты нет."],
              ["cancelled", "Счёт отменён."],
              ["failed", "Ошибка, в том числе неверная валюта или сеть."],
              ["aml_frozen", "Депозит есть, средства на проверке комплаенса. Заказ не закрывайте, пока статус не сменится."],
            ],
          },
        ],
      },
      {
        id: "errors",
        title: "Ошибки",
        blocks: [
          {
            kind: "p",
            text: "Ошибка — это HTTP-код и JSON с полем detail. 4xx исправляют на вашей стороне. 5xx и таймауты имеет смысл повторить с паузой.",
          },
          {
            kind: "code",
            label: "Сумма вне лимита · 400",
            text: `{
  "detail": {
    "code": "amount_out_of_range",
    "message": "Сумма вне допустимого диапазона.",
    "currency": "USDT",
    "network": "TRC20",
    "min_amount": "5",
    "max_amount": "5000"
  }
}`,
          },
          {
            kind: "list",
            items: [
              "401 — нет заголовков или ключ неверный.",
              "400 — ошибка в теле: чужой project_id, пустой заказ, сумма вне min/max из /rates.",
              "404 — счёт или транзакция не найдены у этого ключа.",
              "503 — API временно недоступен, повторите запрос.",
            ],
          },
        ],
      },
    ],
  },
  invoices: {
    sections: [
      {
        id: "create",
        title: "Создать счёт",
        blocks: [
          {
            kind: "p",
            text: "POST /invoices создаёт заявку на пополнение. Конвертация идёт из фиатной суммы в выбранную криптовалюту. Вызывайте метод с backend в момент, когда заказ у вас уже создан и у него есть merchant_order_id.",
          },
          {
            kind: "p",
            text: "Авторизация: X-API-Key и X-API-Secret. Перед первым боевым счётом сверьтесь с GET /rates: min_deposit — лимит в крипте, min_deposit_fiat — ориентир в USD.",
          },
          {
            kind: "code",
            label: "Запрос",
            text: `curl -X POST "{{apiBase}}/invoices" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "<project_id>",
    "merchant_order_id": "order_1001",
    "amount_fiat": 100,
    "fiat_currency": "USD",
    "crypto_currency": "USDT",
    "network": "TRC20"
  }'`,
          },
          {
            kind: "params",
            rows: [
              { name: "project_id", required: "да", text: "Должен совпадать с проектом ключа." },
              { name: "merchant_order_id", required: "да", text: "Ваш id заказа. По нему ищете оплату у себя." },
              { name: "amount_fiat", required: "да", text: "Сумма в фиате, больше нуля." },
              { name: "fiat_currency", required: "нет", text: "По умолчанию USD." },
              { name: "crypto_currency", required: "нет", text: "По умолчанию USDT. Берите из rates, где client_available = true." },
              { name: "network", required: "нет", text: "По умолчанию TRC20. Если у сети memo_required, адрес без memo не используйте." },
            ],
          },
          {
            kind: "p",
            text: "В ответе смотрите id — это invoice_id для следующих методов. status сразу после создания обычно pending. Срок жизни — expires_at: после него новый перевод не ждите, если статус так и остался pending.",
          },
        ],
      },
      {
        id: "list",
        title: "Список счетов",
        blocks: [
          {
            kind: "p",
            text: "GET /invoices возвращает счета ключа, новые сверху. Удобно для сверки и поддержки, не для моментального статуса одного заказа — для него есть GET по id.",
          },
          {
            kind: "code",
            label: "Запрос",
            text: `curl -X GET "{{apiBase}}/invoices?limit=20&offset=0" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "params",
            rows: [
              { name: "limit", required: "нет", text: "Сколько записей вернуть. По умолчанию 50, максимум 200." },
              { name: "offset", required: "нет", text: "Смещение для следующей страницы. По умолчанию 0." },
              { name: "sync", required: "нет", text: "true — перед ответом обновить активные счета у провайдера. Дольше и нужен доступ на запись. Для обычного списка оставляйте false." },
            ],
          },
        ],
      },
      {
        id: "get",
        title: "Один счёт",
        blocks: [
          {
            kind: "p",
            text: "GET /invoices/{invoice_id} — текущий статус, реквизиты и, когда оплата уже есть, блок settlement: gross, комиссия и net. Вызывайте, если webhook ещё не дошёл, или чтобы показать клиенту остаток при недоплате.",
          },
          {
            kind: "code",
            label: "Запрос",
            text: `curl -X GET "{{apiBase}}/invoices/inv_01J_DOCS_EXAMPLE" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "p",
            text: "Query sync=true делает то же, что отдельный POST /sync: статус подтягивается у провайдера прямо в этом ответе. Для редкой ручной проверки это нормально, в цикле каждую секунду — нет. Основной канал — webhook.",
          },
          {
            kind: "code",
            label: "Фрагмент ответа при недоплате",
            text: `{
  "status": "underpaid",
  "amount_review": {
    "kind": "underpaid",
    "expected_amount": "250",
    "received_amount": "249.84",
    "remaining_amount": "0.16",
    "credited": false
  }
}`,
          },
        ],
      },
      {
        id: "sync",
        title: "Синхронизировать статус",
        blocks: [
          {
            kind: "p",
            text: "POST /invoices/{invoice_id}/sync принудительно спрашивает провайдера и возвращает тот же объект, что GET одного счёта. Нужен, если webhook потерялся, а заказ ещё открыт (pending, confirming, underpaid).",
          },
          {
            kind: "code",
            label: "Запрос",
            text: `curl -X POST "{{apiBase}}/invoices/inv_01J_DOCS_EXAMPLE/sync" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "note",
            tone: "info",
            text: "Успешный sync не заменяет webhook. Если статус стал confirmed, всё равно проверьте, что событие записано у вас один раз — по event_id.",
          },
        ],
      },
      {
        id: "accept",
        title: "Принять недоплату",
        blocks: [
          {
            kind: "p",
            text: "POST /invoices/{invoice_id}/accept-received зачисляет уже пришедшую сумму и закрывает ожидание доплаты. Вызывайте только когда клиент сам выбрал «оставить эту сумму» в вашем H2H-экране.",
          },
          {
            kind: "list",
            items: [
              "Счёт должен быть в status = underpaid, а amount_review.received_amount — известен.",
              "После успеха статус уходит в confirming или confirmed, amount_review.credited становится true.",
              "Если клиент хочет доплатить — метод не вызывайте. Второй перевод на тот же адрес останется на этой заявке, amount в webhook будет накопительным.",
              "На hosted checkout то же действие делает сам плательщик: кнопка на /pay/{token} вызывает публичный POST без ваших ключей.",
            ],
          },
          {
            kind: "code",
            label: "Запрос",
            text: `curl -X POST "{{apiBase}}/invoices/inv_01J_DOCS_EXAMPLE/accept-received" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "note",
            tone: "warn",
            text: "Переплату отдельно подтверждать не нужно: она зачисляется по факту, заказ переходит в paid.",
          },
        ],
      },
    ],
  },
  checkout: {
    sections: [
      {
        id: "mode",
        title: "Какой режим у проекта",
        blocks: [
          {
            kind: "p",
            text: "checkout_delivery решает, что вы показываете плательщику. Поле одинаковое в ответе POST /invoices, в GET и внутри webhook, в объекте invoice.",
          },
          {
            kind: "table",
            headers: ["Режим", "Что отдавать клиенту"],
            rows: [
              ["payment_page", "Только payment_page_url. Адреса и QR в ответе нет — они на странице."],
              ["h2h", "payment_address и qr_url. Ссылку на /pay/{token} API не отдаёт, экран рисуете вы."],
              ["both", "Все поля сразу. Так оставляют старые интеграции."],
            ],
          },
          {
            kind: "p",
            text: "Текущий режим виден в кабинете, раздел «Интеграция → Webhook». Сменить его может администратор платформы.",
          },
        ],
      },
      {
        id: "payment-page",
        title: "Страница оплаты",
        blocks: [
          {
            kind: "p",
            text: "Самый короткий путь: редирект или кнопка на payment_page_url. Страница /pay/{token} сама показывает сумму, сеть, QR, таймер и статус. Вам не нужно опрашивать блокчейн.",
          },
          {
            kind: "code",
            label: "Фрагмент ответа",
            text: `{
  "payment_page_url": "https://noren.digital/pay/abc123example",
  "checkout_delivery": "payment_page"
}`,
          },
          {
            kind: "p",
            text: "Если рисуете свою оболочку вокруг той же страницы, публичный статус без ключей: GET /api/v1/public/pay/{token}. Этот URL не на Base URL кабинета — хост тот же, что у сайта оплаты.",
          },
        ],
      },
      {
        id: "h2h",
        title: "Свой экран (H2H)",
        blocks: [
          {
            kind: "p",
            text: "H2H нужен, когда адрес и QR живут в вашем приложении. Покажите сеть, точную amount_crypto, адрес и memo, если он есть. Просите копировать сумму целиком: округление «примерно столько» даёт underpaid.",
          },
          {
            kind: "code",
            label: "Фрагмент ответа",
            text: `{
  "payment_address": "TG9exampleAddress",
  "qr_url": "https://example.com/qr/inv_01J",
  "checkout_delivery": "h2h"
}`,
          },
          {
            kind: "list",
            items: [
              "Не кэшируйте адрес между заказами — он относится к конкретному счёту.",
              "Статус обновляйте по webhook. GET счёта — запасной путь.",
              "После expires_at перестаньте показывать адрес как рабочий, если статус всё ещё pending.",
            ],
          },
        ],
      },
      {
        id: "underpaid",
        title: "Недоплата на экране",
        blocks: [
          {
            kind: "p",
            text: "Когда пришло меньше, status становится underpaid, а amount_review объясняет цифры: expected_amount — сколько ждали, received_amount — сколько уже пришло, remaining_amount — сколько осталось дослать.",
          },
          {
            kind: "list",
            items: [
              "На hosted checkout плательщик сам жмёт «Оставить сумму» или доплачивает на тот же адрес.",
              "В H2H покажите тот же выбор. «Оставить» — это POST /invoices/{id}/accept-received.",
              "Доплата не создаёт новый счёт. Следующий webhook придёт с тем же invoice.id и накопленной суммой.",
            ],
          },
        ],
      },
    ],
  },
  webhooks: {
    sections: [
      {
        id: "events",
        title: "Какие события приходят",
        blocks: [
          {
            kind: "p",
            text: "Платформа сама вызывает ваш URL, когда у счёта меняется статус. Это основной способ закрыть заказ: не опрашивайте GET в цикле.",
          },
          {
            kind: "table",
            headers: ["event", "Когда"],
            rows: [
              ["invoice.status_changed", "Боевое изменение статуса: перевод найден, подтверждён, недоплата, отмена."],
              ["invoice.test_deposit", "Тестовая доставка из кабинета или POST /webhooks/test. Статус счёта в системе не меняется, в теле есть simulated: true."],
            ],
          },
          {
            kind: "p",
            text: "Имя события дублируется заголовком X-Merset-Event. Обрабатывайте тело только после проверки подписи.",
          },
        ],
      },
      {
        id: "setup",
        title: "Куда слать",
        blocks: [
          {
            kind: "p",
            text: "URL и секрет задаются на проект. Этот метод кабинетный: нужен JWT владельца и право client.webhooks.write, не пара API-ключей оплаты.",
          },
          {
            kind: "code",
            label: "Сохранить webhook",
            text: `curl -X POST "{{apiBase}}/webhooks" \\
  -H "Authorization: Bearer <jwt_access>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "<project_id>",
    "webhook_url": "https://merchant.example.com/webhooks/noren",
    "webhook_secret": "merchant-webhook-secret"
  }'`,
          },
          {
            kind: "p",
            text: "webhook_url должен отвечать по HTTPS и быть доступен снаружи. webhook_secret — ваша строка, её же используете при проверке HMAC. Тот же секрет, что в CMS-модуле, если подключаете плагин.",
          },
          {
            kind: "code",
            label: "Проверить доставку",
            text: `curl -X POST "{{apiBase}}/webhooks/test" \\
  -H "Authorization: Bearer <jwt_access>" \\
  -H "Content-Type: application/json" \\
  -d '{ "project_id": "<project_id>" }'`,
          },
        ],
      },
      {
        id: "payload",
        title: "Тело запроса",
        blocks: [
          {
            kind: "p",
            text: "Тело — JSON без лишних пробелов. Поля invoice совпадают с ответом API счёта и зависят от checkout_delivery: лишние реквизиты просто отсутствуют.",
          },
          {
            kind: "code",
            label: "Пример invoice.status_changed",
            text: `{
  "event": "invoice.status_changed",
  "event_id": "wh_01J_DOCS_EXAMPLE",
  "sent_at": "2026-03-30T12:45:00+00:00",
  "invoice": {
    "id": "inv_01J_DOCS_EXAMPLE",
    "merchant_order_id": "order_1001",
    "status": "confirmed",
    "amount_fiat": "100.00",
    "fiat_currency": "USD",
    "amount_crypto": "100.25",
    "crypto_currency": "USDT",
    "network": "TRC20",
    "payment_page_url": "https://noren.digital/pay/abc123example",
    "checkout_delivery": "payment_page"
  },
  "transaction": {
    "id": "tx_01J_DOCS_EXAMPLE",
    "status": "confirmed",
    "gross_amount": "100.00",
    "total_fee": "1.10",
    "net_amount": "98.90",
    "currency": "USDT"
  }
}`,
          },
          {
            kind: "params",
            rows: [
              { name: "event_id", required: "да", text: "Уникальный id этой доставки. Сохраните его и игнорируйте повтор с тем же id." },
              { name: "sent_at", required: "да", text: "Время отправки, ISO-8601." },
              { name: "invoice.id", required: "да", text: "Счёт на платформе. Второй депозит по недоплате приходит с тем же id." },
              { name: "invoice.merchant_order_id", required: "да", text: "Ваш номер заказа из POST /invoices." },
              { name: "invoice.status", required: "да", text: "Актуальный статус. Закрывайте заказ на confirmed (или paid — по вашей политике)." },
              { name: "transaction", required: "нет", text: "Появляется, когда есть проводка. net_amount — сколько останется мерчанту после комиссии. Пока оплаты нет, поле null." },
            ],
          },
        ],
      },
      {
        id: "signature",
        title: "Подпись",
        blocks: [
          {
            kind: "p",
            text: "Подпись считается от сырого тела запроса, байт в байт. Не разбирайте JSON и не сериализуйте заново — пробел или другой порядок ключей сломает HMAC.",
          },
          {
            kind: "list",
            ordered: true,
            items: [
              "Прочитайте сырое тело (raw body) как UTF-8.",
              "Возьмите webhook_secret проекта.",
              "Посчитайте HMAC-SHA256(secret, body) и переведите в hex.",
              "Сравните с заголовком X-Merset-Signature. Ожидаемый вид: sha256=<hex>.",
              "Сравнение делайте константным по времени. Если не сошлось — ответьте 401 и ничего не зачисляйте.",
              "Если event_id уже обработан — ответьте 2xx и выйдите, не проводите оплату второй раз.",
            ],
          },
          {
            kind: "code",
            label: "Проверка на Python",
            text: `import hmac
import hashlib

def signature_ok(secret: str, raw_body: bytes, header: str) -> bool:
    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    expected = f"sha256={digest}"
    return hmac.compare_digest(expected, header or "")`,
          },
          {
            kind: "table",
            headers: ["Заголовок", "Зачем"],
            rows: [
              ["Content-Type", "application/json"],
              ["User-Agent", "Merset-Webhook/1.0"],
              ["X-Merset-Event", "Имя события, например invoice.status_changed"],
              ["X-Merset-Event-Id", "Тот же id, что event_id в теле"],
              ["X-Merset-Timestamp", "Время отправки"],
              ["X-Merset-Signature", "sha256= и hex HMAC"],
            ],
          },
          {
            kind: "note",
            tone: "warn",
            text: "Отвечайте 2xx только после того, как событие записано у вас. 4xx и 5xx платформа считает неудачей и повторит доставку.",
          },
        ],
      },
      {
        id: "retries",
        title: "Повторы",
        blocks: [
          {
            kind: "p",
            text: "Доставка пробуется до трёх раз, с короткой паузой между попытками. Если все три не получили 2xx, событие остаётся ошибкой доставки — счёт при этом на платформе уже мог сменить статус. Тогда заберите его через GET /invoices/{id} или POST /sync.",
          },
          {
            kind: "p",
            text: "Повтор может прийти с новым event_id и тем же invoice.id. Дедуплицируйте и доставку (event_id), и бизнес-операцию (не зачисляйте один merchant_order_id дважды).",
          },
        ],
      },
    ],
  },
  balance: {
    sections: [
      {
        id: "get",
        title: "Получить баланс",
        blocks: [
          {
            kind: "p",
            text: "GET /balance возвращает расчётный баланс мерчанта в валюте тенанта, обычно USDT. Это не баланс кошелька клиента и не сумма одного счёта — это то, что уже проведено вам.",
          },
          {
            kind: "code",
            label: "Запрос",
            text: `curl -X GET "{{apiBase}}/balance" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "code",
            label: "Успех",
            text: `{
  "currency": "USDT",
  "available_amount": "980.50",
  "frozen_amount": "0",
  "pending_amount": "20.00",
  "locked_amount": "0",
  "total_amount": "1000.50",
  "hold_hours": 24,
  "next_release_at": "2026-04-07T11:30:00Z",
  "holds": [
    {
      "transaction_id": "tx_01J_DOCS_EXAMPLE",
      "invoice_id": "inv_01J_DOCS_EXAMPLE",
      "merchant_order_id": "order_1001",
      "amount": "98.90",
      "available_at": "2026-04-07T11:30:00Z"
    }
  ]
}`,
          },
        ],
      },
      {
        id: "fields",
        title: "Что означают суммы",
        blocks: [
          {
            kind: "params",
            rows: [
              { name: "available_amount", required: "да", text: "Можно использовать. Поле amount дублирует эту же цифру." },
              { name: "pending_amount", required: "да", text: "Уже оплачено, но ещё на холде и не доступно." },
              { name: "frozen_amount", required: "да", text: "Заморожено, например на время проверки." },
              { name: "locked_amount", required: "да", text: "Заблокировано под операцию, которую ещё не завершили." },
              { name: "total_amount", required: "да", text: "Сумма четырёх частей выше. Это не «сколько можно вывести»." },
              { name: "hold_hours", required: "да", text: "Сколько часов оплата держится до перехода в available." },
            ],
          },
          {
            kind: "p",
            text: "Вывод на внешний адрес оформляется в кабинете, не этим методом. API баланса только читает цифры.",
          },
        ],
      },
      {
        id: "holds",
        title: "Холды",
        blocks: [
          {
            kind: "p",
            text: "Массив holds — отдельные оплаты, которые ещё не стали available. amount здесь уже net, после комиссии. available_at — момент, когда эта сумма освободится. next_release_at — ближайший такой момент по всему списку.",
          },
          {
            kind: "note",
            tone: "info",
            text: "Пустой holds и pending_amount = 0 значат, что холда сейчас нет. available_amount при этом может быть больше нуля.",
          },
        ],
      },
    ],
  },
  transactions: {
    sections: [
      {
        id: "list",
        title: "Список операций",
        blocks: [
          {
            kind: "p",
            text: "GET /transactions — история проводок по вашему тенанту: сколько пришло, какая комиссия, сколько зачислено. Счета без оплаты здесь не появляются.",
          },
          {
            kind: "code",
            label: "Запрос",
            text: `curl -X GET "{{apiBase}}/transactions?limit=20&offset=0" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "params",
            rows: [
              { name: "limit", required: "нет", text: "Размер страницы. По умолчанию 50, максимум 200." },
              { name: "offset", required: "нет", text: "Смещение. Для второй страницы передайте уже полученное число записей." },
            ],
          },
        ],
      },
      {
        id: "one",
        title: "Одна операция",
        blocks: [
          {
            kind: "p",
            text: "GET /transactions/{transaction_id} возвращает ту же карточку, что элемент списка. id берите из webhook (transaction.id) или из списка. Чужой id этого ключа даст 404.",
          },
          {
            kind: "code",
            label: "Запрос",
            text: `curl -X GET "{{apiBase}}/transactions/tx_01J_DOCS_EXAMPLE" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "code",
            label: "Успех",
            text: `{
  "id": "tx_01J_DOCS_EXAMPLE",
  "invoice_id": "inv_01J_DOCS_EXAMPLE",
  "gross_amount": "100.00",
  "total_fee": "1.10",
  "net_amount": "98.90",
  "currency": "USDT",
  "status": "confirmed",
  "invoice_status": "confirmed",
  "paid_at": "2026-04-06T11:40:00Z"
}`,
          },
        ],
      },
      {
        id: "fees",
        title: "Комиссия в проводке",
        blocks: [
          {
            kind: "p",
            text: "Для сверки достаточно трёх полей. gross_amount — сумма платежа до удержания. total_fee — комиссия платформы (процент, но не ниже минимума). net_amount — то, что относится к балансу мерчанта: gross минус fee.",
          },
          {
            kind: "p",
            text: "Комиссия сети блокчейна в эти поля не входит. Она зависит от TRC20, ERC20 и остальных сетей и показывается отдельно в кабинете. Разбор тарифа — в разделе «Комиссии».",
          },
          {
            kind: "note",
            tone: "info",
            text: "Пока счёт только создан, проводки нет. Нулевая сумма в списке операций до оплаты — не ошибка интеграции, а ещё не прошедший платёж.",
          },
        ],
      },
    ],
  },
  rates: {
    sections: [
      {
        id: "list",
        title: "Список валют и сетей",
        blocks: [
          {
            kind: "p",
            text: "GET /rates говорит, чем можно принять оплату прямо сейчас: валюта, сеть, лимиты и доступность. Вызывайте перед созданием счёта и кэшируйте недолго — лимиты и флаги меняются.",
          },
          {
            kind: "code",
            label: "Запрос",
            text: `curl -X GET "{{apiBase}}/rates" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "code",
            label: "Фрагмент ответа",
            text: `{
  "items": [
    {
      "currency": "USDT",
      "networks": [
        {
          "network": "TRC20",
          "min_deposit": "5",
          "max_deposit": "5000",
          "min_deposit_fiat": "5",
          "max_deposit_fiat": "5000",
          "network_fee": "1",
          "client_available": true,
          "memo_required": false,
          "acquiring": true,
          "withdrawal": true
        }
      ]
    }
  ]
}`,
          },
        ],
      },
      {
        id: "fields",
        title: "Как читать сеть",
        blocks: [
          {
            kind: "params",
            rows: [
              { name: "currency", required: "да", text: "Код токена. Его же передаёте в crypto_currency." },
              { name: "network", required: "да", text: "Сеть. Её же передаёте в network. USDT в TRC20 и USDT в ERC20 — разные маршруты." },
              { name: "min_deposit / max_deposit", required: "да", text: "Допустимый диапазон в криптовалюте. Сумма счёта вне диапазона вернёт amount_out_of_range." },
              { name: "min_deposit_fiat / max_deposit_fiat", required: "нет", text: "Тот же диапазон, ориентир в USD, чтобы проверить amount_fiat до запроса." },
              { name: "client_available", required: "да", text: "true — эту пару можно предлагать плательщику. false — не создавайте счёт, даже если провайдер ещё жив." },
              { name: "acquiring", required: "да", text: "true — приём оплаты по этой сети включён." },
              { name: "withdrawal", required: "да", text: "true — сеть можно использовать для вывода." },
              { name: "memo_required", required: "да", text: "true — без memo или тега перевод не зачислится. Покажите его рядом с адресом." },
              { name: "network_fee", required: "нет", text: "Ориентир комиссии сети. Это не тариф платформы 0,4%." },
              { name: "availability_reason", required: "нет", text: "Короткая причина, если пара выключена. Покажите её в поддержке, клиенту достаточно скрыть способ оплаты." },
            ],
          },
        ],
      },
      {
        id: "choose",
        title: "Что выбрать для счёта",
        blocks: [
          {
            kind: "list",
            ordered: true,
            items: [
              "Оставьте сети с client_available и acquiring.",
              "Проверьте, что amount_fiat попадает в min_deposit_fiat и max_deposit_fiat.",
              "В POST /invoices передайте currency как crypto_currency и network как network.",
              "Если memo_required, в своём H2H-экране не прячьте payment_memo из ответа счёта.",
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "Пустой items или все client_available = false — приём сейчас закрыт. Не подставляйте TRC20 «по привычке».",
          },
        ],
      },
    ],
  },
  reference: {
    sections: [
      {
        id: "map",
        title: "Куда идти за методом",
        blocks: [
          {
            kind: "p",
            text: "Каждый метод разобран на своей странице: зачем вызывать, поля, пример запроса и ответа. Здесь — карта, чтобы не искать путь по сайдбару.",
          },
          {
            kind: "links",
            items: [
              { to: "/invoices", title: "Счета", text: "POST /invoices, список, один счёт, sync и приём недоплаты." },
              { to: "/balance", title: "Баланс", text: "GET /balance — доступно, холд, заморозка." },
              { to: "/transactions", title: "Транзакции", text: "История проводок и комиссия в одной операции." },
              { to: "/rates", title: "Курсы и лимиты", text: "GET /rates — валюты, сети, min/max." },
              { to: "/webhooks", title: "Webhook", text: "Тело, заголовки и проверка HMAC." },
              { to: "/checkout", title: "Checkout", text: "Ссылка /pay/{token} или адрес и QR." },
            ],
          },
        ],
      },
      {
        id: "auth",
        title: "Какая авторизация",
        blocks: [
          {
            kind: "table",
            headers: ["Метод", "Заголовки"],
            rows: [
              ["GET /health", "Без авторизации. Ответ: status ok, scope client."],
              ["POST /invoices, GET /invoices, GET /balance, GET /rates, GET /transactions", "X-API-Key и X-API-Secret"],
              ["POST /invoices/{id}/sync и /accept-received", "Те же ключи, нужен доступ на запись счетов."],
              ["POST /auth/login", "Тело с email и паролем. Ответ — access_token."],
              ["POST /webhooks и POST /webhooks/test", "Authorization: Bearer <jwt>"],
            ],
          },
          {
            kind: "p",
            text: "Полная схема в формате OpenAPI лежит на /openapi.json боевого API, интерактивно — на /docs. Примеры в этих разделах уже подставляют ваш Base URL.",
          },
        ],
      },
    ],
  },
};

export const docsArticlesRu = articles;

import { useMemo, useState } from "react";

type ApiDocumentationPanelProps = {
  apiBaseUrl: string;
  activeApiKeyPublic: string | null;
  selectedRoute: string;
  activeWebhookUrl: string | null;
  integrationCurl: string;
};

type EndpointItem = {
  method: "GET" | "POST";
  path: string;
  purpose: string;
  auth: string;
};

const ENDPOINTS: EndpointItem[] = [
  {
    method: "POST",
    path: "/api/v1/client/invoices",
    purpose: "Создать новый инвойс для оплаты.",
    auth: "X-API-Key + X-API-Secret",
  },
  {
    method: "GET",
    path: "/api/v1/client/invoices",
    purpose: "Получить список инвойсов по проекту/тенанту.",
    auth: "X-API-Key + X-API-Secret",
  },
  {
    method: "GET",
    path: "/api/v1/client/invoices/{invoice_id}",
    purpose: "Проверить статус конкретного инвойса.",
    auth: "X-API-Key + X-API-Secret",
  },
  {
    method: "POST",
    path: "/api/v1/client/invoices/{invoice_id}/sync",
    purpose: "Синхронизировать статус с провайдером вручную.",
    auth: "X-API-Key + X-API-Secret",
  },
  {
    method: "GET",
    path: "/api/v1/client/rates",
    purpose: "Получить доступные токены/сети и лимиты min/max.",
    auth: "X-API-Key + X-API-Secret",
  },
  {
    method: "GET",
    path: "/api/v1/client/transactions",
    purpose: "История транзакций и расчет комиссий.",
    auth: "X-API-Key + X-API-Secret",
  },
  {
    method: "GET",
    path: "/api/v1/client/balance",
    purpose: "Текущий клиентский баланс (USDT TRC20).",
    auth: "X-API-Key + X-API-Secret",
  },
  {
    method: "POST",
    path: "/api/v1/client/webhooks",
    purpose: "Настроить URL и secret для входящих webhook.",
    auth: "JWT или API-key",
  },
  {
    method: "POST",
    path: "/api/v1/client/webhooks/test",
    purpose: "Отправить тестовый webhook в endpoint мерчанта.",
    auth: "JWT или API-key",
  },
];

export function ApiDocumentationPanel({
  apiBaseUrl,
  activeApiKeyPublic,
  selectedRoute,
  activeWebhookUrl,
  integrationCurl,
}: ApiDocumentationPanelProps) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const backendOrigin = useMemo(() => {
    try {
      const url = new URL(apiBaseUrl);
      return `${url.protocol}//${url.host}`;
    } catch {
      return "";
    }
  }, [apiBaseUrl]);

  const docsUrl = backendOrigin ? `${backendOrigin}/docs` : "/docs";
  const openApiUrl = backendOrigin ? `${backendOrigin}/openapi.json` : "/openapi.json";

  const authHeadersExample = useMemo(
    () =>
      `X-API-Key: ${activeApiKeyPublic ?? "<public_key>"}\nX-API-Secret: <secret_key>`,
    [activeApiKeyPublic],
  );

  const createInvoiceExample = integrationCurl;

  const getInvoiceExample = useMemo(
    () =>
      `curl -X GET "${apiBaseUrl}/invoices/<invoice_id>" \\\n  -H "X-API-Key: ${
        activeApiKeyPublic ?? "<public_key>"
      }" \\\n  -H "X-API-Secret: <secret_key>"`,
    [apiBaseUrl, activeApiKeyPublic],
  );

  const webhookPayloadExample = useMemo(
    () =>
      JSON.stringify(
        {
          event: "invoice.confirmed",
          event_id: "evt_01J_DOCS_EXAMPLE",
          sent_at: "2026-03-30T12:45:00Z",
          invoice: {
            id: "inv_01J_DOCS_EXAMPLE",
            merchant_order_id: "order_102394",
            provider_order_id: "cc_992211",
            status: "confirmed",
            amount_fiat: "100.00",
            fiat_currency: "USD",
            amount_crypto: "100.25",
            crypto_currency: "USDT",
            network: "TRC20",
            payment_address: "TG9...example",
          },
          transaction: {
            id: "tx_01J_DOCS_EXAMPLE",
            status: "confirmed",
            gross_amount: "100.00",
            provider_fee: "0.20",
            platform_fee: "0.80",
            turnover_fee: "0.10",
            net_amount: "98.90",
            currency: "USDT",
          },
        },
        null,
        2,
      ),
    [],
  );

  const errorPayloadExample = useMemo(
    () =>
      JSON.stringify(
        {
          detail: {
            code: "amount_out_of_range",
            message: "Сумма 1.00 для USDT/TRC20 вне допустимого диапазона (min 5, max 5000).",
            currency: "USDT",
            network: "TRC20",
            amount: "1",
            min_amount: "5",
            max_amount: "5000",
          },
        },
        null,
        2,
      ),
    [],
  );

  async function handleCopy(value: string, title: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`Скопировано: ${title}`);
    } catch {
      setCopyMessage(`Не удалось скопировать: ${title}`);
    }
  }

  return (
    <article className="panel panel-span-2 api-docs-panel">
      <div className="panel-header api-docs-head">
        <div>
          <p className="eyebrow">Документация API</p>
          <h2>Подключение мерчанта к Noren Cash</h2>
        </div>
        <div className="api-docs-actions">
          <a className="ghost-button" href={docsUrl} rel="noreferrer" target="_blank">
            Swagger UI
          </a>
          <a className="ghost-button" href={openApiUrl} rel="noreferrer" target="_blank">
            OpenAPI JSON
          </a>
        </div>
      </div>

      <section className="api-docs-kpi-grid">
        <article className="detail-chip">
          <span>Base URL</span>
          <code className="detail-tech-value">{apiBaseUrl}</code>
        </article>
        <article className="detail-chip">
          <span>Активный контур</span>
          <code className="detail-tech-value">{selectedRoute}</code>
        </article>
        <article className="detail-chip">
          <span>Webhook URL</span>
          <code className="detail-tech-value">{activeWebhookUrl ?? "Не задан"}</code>
        </article>
      </section>

      <section className="api-docs-section">
        <div className="api-docs-section-head">
          <p className="eyebrow">Быстрый старт</p>
          <h3>Пошаговое подключение за 10 минут</h3>
        </div>
        <ol className="api-docs-steps">
          <li>Сгенерируйте активный API-ключ и сохраните `public` + `secret` в backend проекта.</li>
          <li>Вызовите `GET /rates` и выберите токен/сеть, которые разрешены платформой.</li>
          <li>Создайте тестовый инвойс через `POST /invoices`.</li>
          <li>Проверьте переход статуса через `GET /invoices/{`{invoice_id}`}` или `POST /sync`.</li>
          <li>Настройте webhook endpoint и отправьте тест через `/webhooks/test`.</li>
          <li>После успешного smoke-test включайте production поток оплат.</li>
        </ol>
      </section>

      <section className="api-docs-section">
        <div className="api-docs-section-head">
          <p className="eyebrow">Авторизация</p>
          <h3>HTTP-заголовки для сервер-сервер интеграции</h3>
        </div>
        <pre className="json-box">{authHeadersExample}</pre>
        <div className="action-row-inline">
          <button
            className="ghost-button"
            onClick={() => void handleCopy(authHeadersExample, "Заголовки авторизации")}
            type="button"
          >
            Копировать заголовки
          </button>
        </div>
      </section>

      <section className="api-docs-section">
        <div className="api-docs-section-head">
          <p className="eyebrow">Endpoint-матрица</p>
          <h3>Ключевые методы для приема оплат</h3>
        </div>
        <div className="api-docs-table-wrap">
          <table className="api-docs-table">
            <thead>
              <tr>
                <th>Метод</th>
                <th>Endpoint</th>
                <th>Назначение</th>
                <th>Auth</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((item) => (
                <tr key={`${item.method}:${item.path}`}>
                  <td>
                    <span
                      className={`status-pill ${
                        item.method === "GET" ? "status-pill-neutral" : "status-pill-ok"
                      }`}
                    >
                      {item.method}
                    </span>
                  </td>
                  <td>
                    <code>{item.path}</code>
                  </td>
                  <td>{item.purpose}</td>
                  <td>{item.auth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="api-docs-grid">
        <article className="result-box api-docs-code-card">
          <div className="api-docs-section-head">
            <p className="eyebrow">Пример 1</p>
            <h3>Создание инвойса</h3>
          </div>
          <pre className="json-box">{createInvoiceExample}</pre>
          <button
            className="ghost-button"
            onClick={() => void handleCopy(createInvoiceExample, "Пример создания инвойса")}
            type="button"
          >
            Копировать пример
          </button>
        </article>

        <article className="result-box api-docs-code-card">
          <div className="api-docs-section-head">
            <p className="eyebrow">Пример 2</p>
            <h3>Получить статус инвойса</h3>
          </div>
          <pre className="json-box">{getInvoiceExample}</pre>
          <button
            className="ghost-button"
            onClick={() => void handleCopy(getInvoiceExample, "Пример получения инвойса")}
            type="button"
          >
            Копировать пример
          </button>
        </article>
      </section>

      <section className="api-docs-grid">
        <article className="result-box api-docs-code-card">
          <div className="api-docs-section-head">
            <p className="eyebrow">Webhook</p>
            <h3>Формат входящего события</h3>
          </div>
          <pre className="json-box">{webhookPayloadExample}</pre>
          <p className="muted-text">
            Проверяйте подпись из `X-Merset-Signature`, `X-Merset-Timestamp` и `event_id`.
          </p>
          <button
            className="ghost-button"
            onClick={() => void handleCopy(webhookPayloadExample, "Пример webhook payload")}
            type="button"
          >
            Копировать payload
          </button>
        </article>

        <article className="result-box api-docs-code-card">
          <div className="api-docs-section-head">
            <p className="eyebrow">Ошибки</p>
            <h3>Структура ответа при невалидной сумме</h3>
          </div>
          <pre className="json-box">{errorPayloadExample}</pre>
          <ul className="integration-list">
            <li>Всегда логируйте поле `detail.code` и `detail.message`.</li>
            <li>Для 5xx включайте retry с backoff.</li>
            <li>Для 4xx исправляйте payload, повтор без изменений не нужен.</li>
          </ul>
          <button
            className="ghost-button"
            onClick={() => void handleCopy(errorPayloadExample, "Пример ошибки")}
            type="button"
          >
            Копировать ошибку
          </button>
        </article>
      </section>

      {copyMessage ? <p className="muted-text integration-copy-note">{copyMessage}</p> : null}
    </article>
  );
}

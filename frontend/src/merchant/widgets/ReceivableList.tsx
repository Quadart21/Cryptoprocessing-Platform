import { useCallback, useEffect, useMemo, useState } from "react";

import type { InvoiceItem, InvoiceWebhookTestResponse } from "../../api";
import { formatDecimal } from "../../utils/format";
import { invoiceMerchantBadgeClass, invoiceStatusLabelRu } from "../../utils/invoiceStatus";

import { InvoiceWebhookTestDialog } from "./InvoiceWebhookTestDialog";

const MERCHANT_INVOICE_PAGE_SIZE = 10;

export type ReceivableListProps = {
  invoices: InvoiceItem[];
  selectedClientInvoiceId: string | null;
  onSelectInvoice: (invoiceId: string) => void;
  onSyncInvoice: (invoiceId: string) => void;
  canSyncInvoices: boolean;
  webhookConfigured: boolean;
  canSendInvoiceWebhookTest: boolean;
  onInvoiceWebhookTest: (invoiceId: string) => Promise<InvoiceWebhookTestResponse>;
};

export function ReceivableList({
  invoices,
  selectedClientInvoiceId,
  onSelectInvoice,
  onSyncInvoice,
  canSyncInvoices,
  webhookConfigured,
  canSendInvoiceWebhookTest,
  onInvoiceWebhookTest,
}: ReceivableListProps) {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [webhookTestInvoice, setWebhookTestInvoice] = useState<InvoiceItem | null>(null);
  const [webhookTestLoading, setWebhookTestLoading] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<InvoiceWebhookTestResponse | null>(null);
  const [webhookTestError, setWebhookTestError] = useState<string | null>(null);

  const sortedInvoices = useMemo(() => {
    return [...invoices].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });
  }, [invoices]);

  const normalizedQuery = searchTerm.trim().toLowerCase();

  const filteredInvoices = useMemo(() => {
    if (!normalizedQuery) {
      return sortedInvoices;
    }
    return sortedInvoices.filter((invoice) => {
      const statusRu = invoiceStatusLabelRu(invoice.status).toLowerCase();
      const haystack = [
        invoice.merchant_order_id,
        invoice.payment_address,
        invoice.network,
        invoice.crypto_currency,
        invoice.fiat_currency,
        invoice.status,
        statusRu,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, sortedInvoices]);

  const totalCount = filteredInvoices.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / MERCHANT_INVOICE_PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageInvoices = useMemo(() => {
    const start = (page - 1) * MERCHANT_INVOICE_PAGE_SIZE;
    return filteredInvoices.slice(start, start + MERCHANT_INVOICE_PAGE_SIZE);
  }, [filteredInvoices, page]);

  const closeWebhookDialog = useCallback(() => {
    setWebhookTestInvoice(null);
    setWebhookTestResult(null);
    setWebhookTestError(null);
    setWebhookTestLoading(false);
  }, []);

  const openWebhookDialog = useCallback((invoice: InvoiceItem) => {
    setWebhookTestInvoice(invoice);
    setWebhookTestResult(null);
    setWebhookTestError(null);
  }, []);

  const canSubmitWebhookTest = webhookConfigured && canSendInvoiceWebhookTest;
  const webhookSubmitBlockedReason = !webhookConfigured
    ? "Укажите URL webhook для проекта в разделе «Проекты» или «Ключи», затем сохраните настройки."
    : !canSendInvoiceWebhookTest
      ? "Недостаточно прав: для отправки теста нужно право client.webhooks.write."
      : null;

  const handleSendWebhookTest = useCallback(async () => {
    if (!webhookTestInvoice || !webhookConfigured || !canSendInvoiceWebhookTest) {
      return;
    }
    setWebhookTestLoading(true);
    setWebhookTestError(null);
    setWebhookTestResult(null);
    try {
      const result = await onInvoiceWebhookTest(webhookTestInvoice.id);
      setWebhookTestResult(result);
    } catch (err) {
      setWebhookTestError(err instanceof Error ? err.message : "Не удалось отправить webhook.");
    } finally {
      setWebhookTestLoading(false);
    }
  }, [canSendInvoiceWebhookTest, onInvoiceWebhookTest, webhookConfigured, webhookTestInvoice]);

  return (
    <>
      <article className="mc-surface mc-surface--invoices-list">
        <header className="mc-surface-header mc-surface-header--row">
          <div>
            <p className="mc-surface-eyebrow">Платежи</p>
            <h2 className="mc-surface-title">Ваши инвойсы</h2>
            <p className="mc-surface-desc" style={{ marginBottom: 0 }}>
              Новые сверху. Поиск по заказу, адресу и статусу. Откройте карточку для адреса и QR или синхронизируйте
              статус с провайдером.
            </p>
          </div>
          {invoices.length > 0 ? (
            <span className="mc-invoice-count-pill muted-text">{invoices.length} всего</span>
          ) : null}
        </header>

        {invoices.length > 0 ? (
          <div className="tx-toolbar">
            <label>
              <span>Поиск</span>
              <input
                placeholder="Заказ, адрес, сеть, статус…"
                type="search"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPage(1);
                }}
              />
            </label>
          </div>
        ) : null}

        <div className="mc-rows">
          {invoices.length === 0 ? (
            <div className="mc-empty">Пока нет инвойсов — создайте первый в соседней форме.</div>
          ) : totalCount === 0 ? (
            <div className="mc-empty">Ничего не найдено — смените запрос или очистите поле поиска.</div>
          ) : (
            pageInvoices.map((invoice) => (
              <div
                className={`mc-row ${selectedClientInvoiceId === invoice.id ? "mc-row--active" : ""}`}
                key={invoice.id}
              >
                <div>
                  <div className="mc-row-head">
                    <p className="mc-row-title">{invoice.merchant_order_id}</p>
                    <time className="mc-row-date muted-text" dateTime={invoice.created_at}>
                      {formatInvoiceDate(invoice.created_at)}
                    </time>
                  </div>
                  <p className="mc-row-sub">
                    {formatDecimal(invoice.amount_crypto)} {invoice.crypto_currency} · учёт{" "}
                    {formatDecimal(invoice.amount_fiat)} {invoice.fiat_currency}
                  </p>
                  <p className="mc-row-sub mc-row-mono">{invoice.payment_address}</p>
                  <div className="mc-row-badges" style={{ marginTop: 8 }}>
                    <span className="mc-badge mc-badge-neutral">{invoice.network}</span>
                    <span className={invoiceMerchantBadgeClass(invoice.status)}>
                      {invoiceStatusLabelRu(invoice.status)}
                    </span>
                  </div>
                </div>
                <div className="mc-row-actions">
                  <button className="ghost-button" onClick={() => onSelectInvoice(invoice.id)} type="button">
                    Подробнее
                  </button>
                  <button
                    className="ghost-button"
                    onClick={() => openWebhookDialog(invoice)}
                    title="Тестовый webhook по этому инвойсу (ответ сервера в модальном окне)"
                    type="button"
                  >
                    Webhook
                  </button>
                  {canSyncInvoices ? (
                    <button className="ghost-button" onClick={() => onSyncInvoice(invoice.id)} type="button">
                      Синхронизировать
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        {totalCount > 0 ? (
          <div className="mc-tx-footer tx-footer">
            <p className="muted-text">
              Показано {(page - 1) * MERCHANT_INVOICE_PAGE_SIZE + 1}–
              {Math.min(page * MERCHANT_INVOICE_PAGE_SIZE, totalCount)} из {totalCount}
            </p>
            <div className="tx-pagination">
              <button className="ghost-button" disabled={page <= 1} onClick={() => setPage(page - 1)} type="button">
                Назад
              </button>
              <span className="tx-page-indicator">
                {page} / {totalPages}
              </span>
              <button
                className="ghost-button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                type="button"
              >
                Вперёд
              </button>
            </div>
          </div>
        ) : null}
      </article>

      <InvoiceWebhookTestDialog
        canSubmitTest={canSubmitWebhookTest}
        errorMessage={webhookTestError}
        invoice={webhookTestInvoice}
        lastResult={webhookTestResult}
        loading={webhookTestLoading}
        submitBlockedReason={webhookSubmitBlockedReason}
        onClose={closeWebhookDialog}
        onSend={handleSendWebhookTest}
      />
    </>
  );
}

function formatInvoiceDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

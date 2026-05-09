import { useCallback, useState } from "react";

import type { InvoiceItem, InvoiceWebhookTestResponse } from "../../api";
import { formatDecimal } from "../../utils/format";
import { invoiceMerchantBadgeClass, invoiceStatusLabelRu } from "../../utils/invoiceStatus";

import { InvoiceWebhookTestDialog } from "./InvoiceWebhookTestDialog";

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
  const [webhookTestInvoice, setWebhookTestInvoice] = useState<InvoiceItem | null>(null);
  const [webhookTestLoading, setWebhookTestLoading] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<InvoiceWebhookTestResponse | null>(null);
  const [webhookTestError, setWebhookTestError] = useState<string | null>(null);

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

  const handleSendWebhookTest = useCallback(async () => {
    if (!webhookTestInvoice) {
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
  }, [onInvoiceWebhookTest, webhookTestInvoice]);

  const webhookButtonDisabled = !webhookConfigured || !canSendInvoiceWebhookTest;
  const webhookTitle = !webhookConfigured
    ? "Сначала укажите URL webhook в разделе «Проекты»"
    : !canSendInvoiceWebhookTest
      ? "Недостаточно прав (нужно право настройки webhook)"
      : "Открыть тестовый webhook по этому инвойсу";

  return (
    <>
      <article className="mc-surface">
        <header className="mc-surface-header">
          <p className="mc-surface-eyebrow">Платежи</p>
          <h2 className="mc-surface-title">Инвойсы</h2>
          <p className="mc-surface-desc">
            Список счетов с суммой в крипте и учётом в фиате. Откройте карточку для адреса и QR или синхронизируйте
            статус.
          </p>
        </header>

        <div className="mc-rows">
          {invoices.length === 0 ? (
            <div className="mc-empty">Пока нет инвойсов — создайте первый в соседней форме.</div>
          ) : (
            invoices.map((invoice) => (
              <div
                className={`mc-row ${selectedClientInvoiceId === invoice.id ? "mc-row--active" : ""}`}
                key={invoice.id}
              >
                <div>
                  <p className="mc-row-title">{invoice.merchant_order_id}</p>
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
                    disabled={webhookButtonDisabled}
                    onClick={() => openWebhookDialog(invoice)}
                    title={webhookTitle}
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
      </article>

      <InvoiceWebhookTestDialog
        errorMessage={webhookTestError}
        invoice={webhookTestInvoice}
        lastResult={webhookTestResult}
        loading={webhookTestLoading}
        onClose={closeWebhookDialog}
        onSend={handleSendWebhookTest}
      />
    </>
  );
}

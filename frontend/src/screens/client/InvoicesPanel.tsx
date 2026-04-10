import type { InvoiceItem } from "../../api";

type InvoicesPanelProps = {
  invoices: InvoiceItem[];
  selectedClientInvoiceId: string | null;
  onSelectInvoice: (invoiceId: string) => void;
  onSyncInvoice: (invoiceId: string) => void;
};

export function InvoicesPanel({
  invoices,
  selectedClientInvoiceId,
  onSelectInvoice,
  onSyncInvoice,
}: InvoicesPanelProps) {
  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Инвойсы</p>
          <h2>Последние платежи</h2>
        </div>
      </div>
      <div className="tenant-list">
        {invoices.length === 0 ? (
          <p className="muted-text">Пока нет созданных инвойсов.</p>
        ) : (
          invoices.map((invoice) => (
            <article
              className={`tenant-card ${selectedClientInvoiceId === invoice.id ? "tenant-card-active" : ""}`}
              key={invoice.id}
            >
              <div>
                <strong>{invoice.merchant_order_id}</strong>
                <p>
                  {invoice.amount_crypto} {invoice.crypto_currency} / учет: {invoice.amount_fiat}{" "}
                  {invoice.fiat_currency}
                </p>
                <p>{invoice.payment_address}</p>
              </div>
              <div className="tenant-meta">
                <span>{invoice.network}</span>
                <span>{invoice.status}</span>
                <div className="action-row">
                  <button className="ghost-button" onClick={() => onSelectInvoice(invoice.id)} type="button">
                    Открыть
                  </button>
                  <button className="ghost-button" onClick={() => onSyncInvoice(invoice.id)} type="button">
                    Синхронизировать
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </article>
  );
}

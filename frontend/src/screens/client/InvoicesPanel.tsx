import type { InvoiceItem } from "../../api";
import { formatDecimal } from "../../utils/format";

type InvoicesPanelProps = {
  invoices: InvoiceItem[];
  selectedClientInvoiceId: string | null;
  onSelectInvoice: (invoiceId: string) => void;
  onSyncInvoice: (invoiceId: string) => void;
  canSyncInvoices: boolean;
};

function invoiceStatusBadge(status: string): string {
  const s = status.toLowerCase();
  if (s === "confirmed" || s === "paid") {
    return "mc-badge-ok";
  }
  if (s === "pending") {
    return "mc-badge-warn";
  }
  if (s === "failed" || s === "expired") {
    return "mc-badge-neutral";
  }
  return "mc-badge-neutral";
}

export function InvoicesPanel({
  invoices,
  selectedClientInvoiceId,
  onSelectInvoice,
  onSyncInvoice,
  canSyncInvoices,
}: InvoicesPanelProps) {
  return (
    <article className="mc-surface">
      <header className="mc-surface-header">
        <p className="mc-surface-eyebrow">Платежи</p>
        <h2 className="mc-surface-title">Инвойсы</h2>
        <p className="mc-surface-desc">
          Список счетов с суммой в крипте и учётом в фиате. Откройте карточку для адреса и QR или синхронизируйте статус.
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
                  <span className={`mc-badge ${invoiceStatusBadge(invoice.status)}`}>{invoice.status}</span>
                </div>
              </div>
              <div className="mc-row-actions">
                <button className="ghost-button" onClick={() => onSelectInvoice(invoice.id)} type="button">
                  Подробнее
                </button>
                {canSyncInvoices ? (
                  <button className="ghost-button" onClick={() => onSyncInvoice(invoice.id)} type="button">
                    Sync
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

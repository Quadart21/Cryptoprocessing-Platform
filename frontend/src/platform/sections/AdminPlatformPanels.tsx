import type { InvoiceItem, ProviderEventItem, TransactionItem } from "../../api";
import { formatDecimal, formatMoneyAmount } from "../../utils/format";
import {
  invoiceCompactPillClass,
  invoiceStatusLabelRu,
  invoiceStatusTone,
} from "../../utils/invoiceStatus";

type PlatformInvoicesPanelProps = {
  invoices: InvoiceItem[];
  className?: string;
  onSyncInvoice?: (invoiceId: string) => void;
};

type PlatformTransactionsPanelProps = {
  transactions: TransactionItem[];
  className?: string;
};

type PlatformEventsPanelProps = {
  events: ProviderEventItem[];
  className?: string;
};

export function PlatformInvoicesPanel({
  invoices,
  className = "panel",
  onSyncInvoice,
}: PlatformInvoicesPanelProps) {
  return (
    <article className={className}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Глобальные инвойсы</p>
          <h2>Последние инвойсы платформы</h2>
        </div>
      </div>
      <div className="tenant-list tenant-list--invoice-compact">
        {invoices.length === 0 ? (
          <p className="muted-text">Инвойсов пока нет.</p>
        ) : (
          invoices.map((invoice) => {
            const tone = invoiceStatusTone(invoice.status);
            return (
              <article
                className={`invoice-compact-row invoice-compact-row--${tone}`}
                key={invoice.id}
              >
                <div className="invoice-compact-row__main">
                  <strong className="invoice-compact-row__id">{invoice.merchant_order_id}</strong>
                  <span className="invoice-compact-row__amounts">
                    {formatDecimal(invoice.amount_fiat)} {invoice.fiat_currency} ·{" "}
                    {formatDecimal(invoice.amount_crypto)} {invoice.crypto_currency}
                  </span>
                </div>
                <div className="invoice-compact-row__meta">
                  <span className="invoice-compact-network">{invoice.network}</span>
                  <span className={invoiceCompactPillClass(invoice.status)}>
                    {invoiceStatusLabelRu(invoice.status)}
                  </span>
                  {onSyncInvoice ? (
                    <button className="ghost-button" onClick={() => onSyncInvoice(invoice.id)} type="button">
                      Синхронизировать
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </article>
  );
}

export function PlatformTransactionsPanel({
  transactions,
  className = "panel",
}: PlatformTransactionsPanelProps) {
  return (
    <article className={className}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Глобальные транзакции</p>
          <h2>Последние операции</h2>
        </div>
      </div>
      <div className="tenant-list">
        {transactions.length === 0 ? (
          <p className="muted-text">Транзакций пока нет.</p>
        ) : (
          transactions.map((transaction) => (
            <article className="tenant-card" key={transaction.id}>
              <div>
                <strong>{formatMoneyAmount(transaction.gross_amount, transaction.currency)}</strong>
                <p>Invoice: {transaction.invoice_id}</p>
                <p>Net: {formatMoneyAmount(transaction.net_amount, transaction.currency)}</p>
              </div>
              <div className="tenant-meta">
                <span>{transaction.status}</span>
                <span>{transaction.paid_at ?? "Не оплачено"}</span>
              </div>
            </article>
          ))
        )}
      </div>
    </article>
  );
}

export function PlatformEventsPanel({ events, className = "panel" }: PlatformEventsPanelProps) {
  return (
    <article className={className}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">События и webhook</p>
          <h2>Последние события платформы</h2>
        </div>
      </div>
      <div className="tenant-list">
        {events.length === 0 ? (
          <p className="muted-text">Событий пока нет.</p>
        ) : (
          events.map((event) => (
            <article className="tenant-card" key={event.id}>
              <div>
                <strong>{event.event_type}</strong>
                <p>Invoice: {event.invoice_id}</p>
                <p>Source: {event.source}</p>
              </div>
              <div className="tenant-meta">
                <span>{event.status}</span>
                <span>{event.created_at}</span>
              </div>
            </article>
          ))
        )}
      </div>
    </article>
  );
}

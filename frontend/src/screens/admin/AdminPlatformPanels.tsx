import type { InvoiceItem, ProviderEventItem, TransactionItem } from "../../api";

type PlatformInvoicesPanelProps = {
  invoices: InvoiceItem[];
  className?: string;
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
}: PlatformInvoicesPanelProps) {
  return (
    <article className={className}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Глобальные инвойсы</p>
          <h2>Последние инвойсы платформы</h2>
        </div>
      </div>
      <div className="tenant-list">
        {invoices.length === 0 ? (
          <p className="muted-text">Инвойсов пока нет.</p>
        ) : (
          invoices.map((invoice) => (
            <article className="tenant-card" key={invoice.id}>
              <div>
                <strong>{invoice.merchant_order_id}</strong>
                <p>
                  {invoice.amount_fiat} {invoice.fiat_currency} / {invoice.amount_crypto}{" "}
                  {invoice.crypto_currency}
                </p>
              </div>
              <div className="tenant-meta">
                <span>{invoice.network}</span>
                <span>{invoice.status}</span>
              </div>
            </article>
          ))
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
                <strong>
                  {transaction.gross_amount} {transaction.currency}
                </strong>
                <p>Invoice: {transaction.invoice_id}</p>
                <p>Net: {transaction.net_amount}</p>
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

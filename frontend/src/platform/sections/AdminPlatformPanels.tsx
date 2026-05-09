import { useEffect, useMemo, useState } from "react";

import type { InvoiceItem, ProviderEventItem, TransactionItem } from "../../api";
import { formatDecimal, formatMoneyAmount } from "../../utils/format";
import {
  invoiceCompactPillClass,
  invoiceStatusLabelRu,
  invoiceStatusTone,
} from "../../utils/invoiceStatus";

const PLATFORM_PANEL_PAGE_SIZE = 10;

function PanelPaginationFooter({
  page,
  pageSize,
  totalCount,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (next: number) => void;
}) {
  if (totalCount === 0) {
    return null;
  }
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  return (
    <div className="tx-footer platform-panel-footer">
      <p className="muted-text">
        Показано {start}–{end} из {totalCount}
      </p>
      <div className="tx-pagination">
        <button className="ghost-button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} type="button">
          Назад
        </button>
        <span className="tx-page-indicator">
          {page} / {totalPages}
        </span>
        <button
          className="ghost-button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          Вперёд
        </button>
      </div>
    </div>
  );
}

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
  const [page, setPage] = useState(1);
  const totalCount = invoices.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PLATFORM_PANEL_PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageInvoices = useMemo(() => {
    const start = (page - 1) * PLATFORM_PANEL_PAGE_SIZE;
    return invoices.slice(start, start + PLATFORM_PANEL_PAGE_SIZE);
  }, [invoices, page]);

  return (
    <article className={className}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Глобальные инвойсы</p>
          <h2>Последние инвойсы платформы</h2>
        </div>
      </div>
      <div className="tenant-list tenant-list--invoice-compact">
        {totalCount === 0 ? (
          <p className="muted-text">Инвойсов пока нет.</p>
        ) : (
          pageInvoices.map((invoice) => {
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
      <PanelPaginationFooter
        onPageChange={setPage}
        page={page}
        pageSize={PLATFORM_PANEL_PAGE_SIZE}
        totalCount={totalCount}
      />
    </article>
  );
}

export function PlatformTransactionsPanel({
  transactions,
  className = "panel",
}: PlatformTransactionsPanelProps) {
  const [page, setPage] = useState(1);
  const totalCount = transactions.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PLATFORM_PANEL_PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageTransactions = useMemo(() => {
    const start = (page - 1) * PLATFORM_PANEL_PAGE_SIZE;
    return transactions.slice(start, start + PLATFORM_PANEL_PAGE_SIZE);
  }, [transactions, page]);

  return (
    <article className={className}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Глобальные транзакции</p>
          <h2>Последние операции</h2>
        </div>
      </div>
      <div className="tenant-list">
        {totalCount === 0 ? (
          <p className="muted-text">Транзакций пока нет.</p>
        ) : (
          pageTransactions.map((transaction) => (
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
      <PanelPaginationFooter
        onPageChange={setPage}
        page={page}
        pageSize={PLATFORM_PANEL_PAGE_SIZE}
        totalCount={totalCount}
      />
    </article>
  );
}

export function PlatformEventsPanel({ events, className = "panel" }: PlatformEventsPanelProps) {
  const [page, setPage] = useState(1);
  const totalCount = events.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PLATFORM_PANEL_PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageEvents = useMemo(() => {
    const start = (page - 1) * PLATFORM_PANEL_PAGE_SIZE;
    return events.slice(start, start + PLATFORM_PANEL_PAGE_SIZE);
  }, [events, page]);

  return (
    <article className={className}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">События и webhook</p>
          <h2>Последние события платформы</h2>
        </div>
      </div>
      <div className="tenant-list">
        {totalCount === 0 ? (
          <p className="muted-text">Событий пока нет.</p>
        ) : (
          pageEvents.map((event) => (
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
      <PanelPaginationFooter
        onPageChange={setPage}
        page={page}
        pageSize={PLATFORM_PANEL_PAGE_SIZE}
        totalCount={totalCount}
      />
    </article>
  );
}

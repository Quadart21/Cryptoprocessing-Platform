import { useEffect, useMemo, useState } from "react";

import type { InvoiceItem, ProviderEventItem, TransactionItem } from "../../api";
import { ProviderEventList } from "../components/ProviderEventList";
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
  onRefreshInvoices?: () => void;
  canSyncInvoices?: boolean;
};

const POLL_ACTIVE_INVOICES_MS = 30_000;

function hasActiveInvoiceStatus(invoices: InvoiceItem[]): boolean {
  return invoices.some((invoice) => {
    const status = invoice.status.trim().toLowerCase();
    return status === "pending" || status === "confirming" || status === "paid";
  });
}

type PlatformTransactionsPanelProps = {
  transactions: TransactionItem[];
  className?: string;
  onRefreshTransactions?: () => void;
  canReconcileTransactions?: boolean;
};

function transactionDisplayStatus(transaction: TransactionItem): string {
  return transaction.invoice_status?.trim() || transaction.status;
}

function transactionNeedsReconcile(transaction: TransactionItem): boolean {
  const txStatus = transaction.status.trim().toLowerCase();
  const invoiceStatus = (transaction.invoice_status ?? transaction.status).trim().toLowerCase();
  if (txStatus === invoiceStatus) {
    return txStatus === "pending" || txStatus === "confirming";
  }
  const paidLike = new Set(["confirming", "paid", "confirmed"]);
  return paidLike.has(invoiceStatus) && txStatus === "pending";
}

type PlatformEventsPanelProps = {
  events: ProviderEventItem[];
  className?: string;
};

export function PlatformInvoicesPanel({
  invoices,
  className = "panel",
  onSyncInvoice,
  onRefreshInvoices,
  canSyncInvoices = false,
}: PlatformInvoicesPanelProps) {
  const [page, setPage] = useState(1);
  const totalCount = invoices.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PLATFORM_PANEL_PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (!canSyncInvoices || !onRefreshInvoices || !hasActiveInvoiceStatus(invoices)) {
      return;
    }
    onRefreshInvoices();
    const timer = window.setInterval(onRefreshInvoices, POLL_ACTIVE_INVOICES_MS);
    return () => window.clearInterval(timer);
  }, [canSyncInvoices, onRefreshInvoices, invoices]);

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
                  {onSyncInvoice && canSyncInvoices ? (
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
  onRefreshTransactions,
  canReconcileTransactions = false,
}: PlatformTransactionsPanelProps) {
  const [page, setPage] = useState(1);
  const totalCount = transactions.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PLATFORM_PANEL_PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (!canReconcileTransactions || !onRefreshTransactions) {
      return;
    }
    if (!transactions.some(transactionNeedsReconcile)) {
      return;
    }
    onRefreshTransactions();
    const timer = window.setInterval(onRefreshTransactions, POLL_ACTIVE_INVOICES_MS);
    return () => window.clearInterval(timer);
  }, [canReconcileTransactions, onRefreshTransactions, transactions]);

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
          pageTransactions.map((transaction) => {
            const displayStatus = transactionDisplayStatus(transaction);
            const grossIsEmpty =
              Number.parseFloat(transaction.gross_amount) === 0 &&
              displayStatus !== "pending";
            const grossLabel = grossIsEmpty
              ? transaction.amount_crypto && transaction.crypto_currency
                ? `${formatDecimal(transaction.amount_crypto)} ${transaction.crypto_currency} (до settlement)`
                : "Ожидает settlement"
              : formatMoneyAmount(transaction.gross_amount, transaction.currency);
            const netLabel = grossIsEmpty
              ? "—"
              : formatMoneyAmount(transaction.net_amount, transaction.currency);
            return (
            <article className="tenant-card" key={transaction.id}>
              <div>
                <strong>{grossLabel}</strong>
                <p>Invoice: {transaction.invoice_id}</p>
                <p>Net: {netLabel}</p>
              </div>
              <div className="tenant-meta">
                <span className={invoiceCompactPillClass(displayStatus)}>
                  {invoiceStatusLabelRu(displayStatus)}
                </span>
                <span>{transaction.paid_at ?? "Не оплачено"}</span>
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

export function PlatformEventsPanel({ events, className = "panel" }: PlatformEventsPanelProps) {
  const [page, setPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState<"all" | "webhook" | "sync">("all");
  const filteredEvents = useMemo(() => {
    if (sourceFilter === "all") {
      return events;
    }
    return events.filter((event) => event.source === sourceFilter);
  }, [events, sourceFilter]);
  const totalCount = filteredEvents.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PLATFORM_PANEL_PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageEvents = useMemo(() => {
    const start = (page - 1) * PLATFORM_PANEL_PAGE_SIZE;
    return filteredEvents.slice(start, start + PLATFORM_PANEL_PAGE_SIZE);
  }, [filteredEvents, page]);

  return (
    <article className={className}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">События и webhook</p>
          <h2>Crypto-Cash: webhook и статусы</h2>
          <p className="muted-text">
            Журнал в БД и в server logs:{" "}
            <code>journalctl -u cryptoprocessing -f | grep crypto_cash.webhook</code>
          </p>
        </div>
        <div className="platform-events-filter">
          <button
            className={sourceFilter === "all" ? "primary-button" : "ghost-button"}
            onClick={() => {
              setSourceFilter("all");
              setPage(1);
            }}
            type="button"
          >
            Все
          </button>
          <button
            className={sourceFilter === "webhook" ? "primary-button" : "ghost-button"}
            onClick={() => {
              setSourceFilter("webhook");
              setPage(1);
            }}
            type="button"
          >
            Webhook
          </button>
          <button
            className={sourceFilter === "sync" ? "primary-button" : "ghost-button"}
            onClick={() => {
              setSourceFilter("sync");
              setPage(1);
            }}
            type="button"
          >
            Sync
          </button>
        </div>
      </div>
      <ProviderEventList events={pageEvents} />
      <PanelPaginationFooter
        onPageChange={setPage}
        page={page}
        pageSize={PLATFORM_PANEL_PAGE_SIZE}
        totalCount={totalCount}
      />
    </article>
  );
}

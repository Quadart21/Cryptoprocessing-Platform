import { useEffect, useMemo, useState } from "react";

import type { InvoiceItem, ProviderEventItem, TransactionItem } from "../../api";
import { ProviderEventList } from "../components/ProviderEventList";
import { formatDecimal, formatMoneyAmount } from "../../utils/format";
import {
  invoiceCompactPillClass,
  invoiceStatusLabelRu,
  invoiceStatusTone,
} from "../../utils/invoiceStatus";
import { InvoiceStatusOverrideControl } from "../components/InvoiceStatusOverrideControl";

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
  isSuperadmin?: boolean;
  onUpdateTransactionStatus?: (transactionId: string, status: string) => void;
  loading?: boolean;
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
  isSuperadmin = false,
  onUpdateTransactionStatus,
  loading = false,
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
              {isSuperadmin && onUpdateTransactionStatus ? (
                <InvoiceStatusOverrideControl
                  currentStatus={displayStatus}
                  disabled={loading}
                  onApply={(status) => onUpdateTransactionStatus(transaction.id, status)}
                />
              ) : null}
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

type EventsSourceFilter = "all" | "webhook" | "sync";
type EventsStatusFilter = "all" | "processed" | "failed" | "other";

export function PlatformEventsPanel({ events, className = "panel" }: PlatformEventsPanelProps) {
  const [page, setPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState<EventsSourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<EventsStatusFilter>("all");
  const [query, setQuery] = useState("");

  const stats = useMemo(() => {
    let webhook = 0;
    let sync = 0;
    let failed = 0;
    for (const event of events) {
      if (event.source === "webhook") {
        webhook += 1;
      } else if (event.source === "sync") {
        sync += 1;
      }
      if (event.status.trim().toLowerCase() === "failed" || event.status.trim().toLowerCase() === "error") {
        failed += 1;
      }
    }
    return { total: events.length, webhook, sync, failed };
  }, [events]);

  const filteredEvents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      if (sourceFilter !== "all" && event.source !== sourceFilter) {
        return false;
      }
      const statusKey = event.status.trim().toLowerCase();
      if (statusFilter === "processed" && statusKey !== "processed") {
        return false;
      }
      if (statusFilter === "failed" && statusKey !== "failed" && statusKey !== "error") {
        return false;
      }
      if (statusFilter === "other" && (statusKey === "processed" || statusKey === "failed" || statusKey === "error")) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const haystack = [
        event.event_type,
        event.source,
        event.status,
        event.invoice_id,
        event.provider_event_id,
        event.provider_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [events, query, sourceFilter, statusFilter]);

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

  function applySource(next: EventsSourceFilter) {
    setSourceFilter(next);
    setPage(1);
  }

  function applyStatus(next: EventsStatusFilter) {
    setStatusFilter(next);
    setPage(1);
  }

  return (
    <article className={`${className} platform-events-panel`}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Мониторинг</p>
          <h2>События платформы</h2>
          <p className="muted-text platform-events-lead">
            Хронология webhook Crypto-Cash и синхронизаций статусов. Нажмите «Детали», чтобы увидеть
            payload и идентификаторы.
          </p>
        </div>
      </div>

      <div className="platform-events-stats" aria-label="Сводка по событиям">
        <div className="platform-events-stat">
          <span className="platform-events-stat__label">Всего</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="platform-events-stat">
          <span className="platform-events-stat__label">Webhook</span>
          <strong>{stats.webhook}</strong>
        </div>
        <div className="platform-events-stat">
          <span className="platform-events-stat__label">Синхронизация</span>
          <strong>{stats.sync}</strong>
        </div>
        <div className={`platform-events-stat${stats.failed ? " platform-events-stat--danger" : ""}`}>
          <span className="platform-events-stat__label">Ошибки</span>
          <strong>{stats.failed}</strong>
        </div>
      </div>

      <div className="platform-events-toolbar">
        <label className="platform-events-search">
          <span className="sr-only">Поиск по событиям</span>
          <input
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Поиск: тип, инвойс, event_id…"
            type="search"
            value={query}
          />
        </label>
        <div className="platform-events-filter" role="group" aria-label="Источник">
          {(
            [
              ["all", "Все"],
              ["webhook", "Webhook"],
              ["sync", "Синхронизация"],
            ] as const
          ).map(([value, label]) => (
            <button
              className={sourceFilter === value ? "primary-button" : "ghost-button"}
              key={value}
              onClick={() => applySource(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="platform-events-filter" role="group" aria-label="Статус обработки">
          {(
            [
              ["all", "Любой статус"],
              ["processed", "Обработано"],
              ["failed", "Ошибки"],
              ["other", "Прочее"],
            ] as const
          ).map(([value, label]) => (
            <button
              className={statusFilter === value ? "primary-button" : "ghost-button"}
              key={value}
              onClick={() => applyStatus(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ProviderEventList
        emptyLabel={
          events.length === 0
            ? "Событий пока нет — они появятся после webhook или синхронизации инвойсов."
            : "По выбранным фильтрам ничего не найдено."
        }
        events={pageEvents}
      />
      <PanelPaginationFooter
        onPageChange={setPage}
        page={page}
        pageSize={PLATFORM_PANEL_PAGE_SIZE}
        totalCount={totalCount}
      />
    </article>
  );
}

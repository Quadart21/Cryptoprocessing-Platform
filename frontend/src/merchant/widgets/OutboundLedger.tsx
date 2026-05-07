import type { TransactionItem } from "../../api";
import { formatDecimal, formatMoneyAmount } from "../../utils/format";

export type OutboundLedgerProps = {
  transactions: TransactionItem[];
  exportRows: TransactionItem[];
  totalCount: number;
  statusFilter: string;
  currencyFilter: string;
  searchTerm: string;
  statusOptions: string[];
  currencyOptions: string[];
  page: number;
  totalPages: number;
  pageSize: number;
  onStatusFilterChange: (next: string) => void;
  onCurrencyFilterChange: (next: string) => void;
  onSearchChange: (next: string) => void;
  onPageChange: (next: number) => void;
};

export function OutboundLedger({
  transactions,
  exportRows,
  totalCount,
  statusFilter,
  currencyFilter,
  searchTerm,
  statusOptions,
  currencyOptions,
  page,
  totalPages,
  pageSize,
  onStatusFilterChange,
  onCurrencyFilterChange,
  onSearchChange,
  onPageChange,
}: OutboundLedgerProps) {
  function handleExportCsv() {
    if (exportRows.length === 0) {
      return;
    }
    const header = [
      "created_at",
      "status",
      "currency",
      "gross_amount",
      "net_amount",
      "provider_fee",
      "platform_fee",
      "turnover_fee",
      "invoice_id",
      "transaction_id",
    ];
    const rows = exportRows.map((item) => [
      escapeCsv(item.created_at),
      escapeCsv(item.status),
      escapeCsv(item.currency),
      escapeCsv(item.gross_amount),
      escapeCsv(item.net_amount),
      escapeCsv(item.provider_fee),
      escapeCsv(item.platform_fee),
      escapeCsv(item.turnover_fee),
      escapeCsv(item.invoice_id),
      escapeCsv(item.id),
    ]);
    const csv = [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `transactions_${Date.now()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(href);
  }

  return (
    <article className="mc-surface mc-surface--span">
      <header className="mc-surface-header mc-surface-header--row">
        <div>
          <p className="mc-surface-eyebrow">Реестр</p>
          <h2 className="mc-surface-title">Операции</h2>
          <p className="mc-surface-desc" style={{ marginBottom: 0 }}>
            Фильтры, поиск и экспорт. На телефоне — карточки; на широком экране — таблица.
          </p>
        </div>
        <button className="ghost-button" onClick={handleExportCsv} type="button">
          Экспорт CSV
        </button>
      </header>

      <div className="tx-toolbar">
        <label>
          <span>Статус</span>
          <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
            <option value="all">Все</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Валюта</span>
          <select value={currencyFilter} onChange={(event) => onCurrencyFilterChange(event.target.value)}>
            <option value="all">Все</option>
            {currencyOptions.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
        <label className="tx-search">
          <span>Поиск</span>
          <input
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="invoice / transaction id"
            value={searchTerm}
          />
        </label>
      </div>

      <div className="mc-tx-cards">
        {transactions.length === 0 ? (
          <div className="mc-empty">Нет операций по фильтрам.</div>
        ) : (
          transactions.map((transaction) => (
            <article className="mc-tx-card" key={transaction.id}>
              <div className="mc-tx-card-top">
                <div className="mc-tx-card-amount">
                  {formatMoneyAmount(transaction.gross_amount, transaction.currency)}
                </div>
                <span className={`status-pill status-pill-${normalizeStatus(transaction.status)}`}>
                  {transaction.status}
                </span>
              </div>
              <div className="mc-tx-card-meta">
                <span>Net: {formatMoneyAmount(transaction.net_amount, transaction.currency)}</span>
                <span>
                  Комиссии:{" "}
                  {formatMoneyAmount(
                    sumFee(transaction.provider_fee, transaction.platform_fee, transaction.turnover_fee),
                    transaction.currency,
                  )}
                </span>
                <span className="mc-row-mono">{formatDate(transaction.created_at)}</span>
                <span className="mc-row-mono">inv: {transaction.invoice_id}</span>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="tx-table-wrap mc-hide-tx-table">
        <table className="tx-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Статус</th>
              <th>Сумма</th>
              <th>Net</th>
              <th>Комиссия</th>
              <th>Invoice</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td className="tx-empty" colSpan={6}>
                  Операций по выбранным фильтрам нет.
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{formatDate(transaction.created_at)}</td>
                  <td>
                    <span className={`status-pill status-pill-${normalizeStatus(transaction.status)}`}>
                      {transaction.status}
                    </span>
                  </td>
                  <td>{formatMoneyAmount(transaction.gross_amount, transaction.currency)}</td>
                  <td>{formatMoneyAmount(transaction.net_amount, transaction.currency)}</td>
                  <td>
                    {formatMoneyAmount(
                      sumFee(transaction.provider_fee, transaction.platform_fee, transaction.turnover_fee),
                      transaction.currency,
                    )}
                  </td>
                  <td className="tx-id-cell">{transaction.invoice_id}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mc-tx-footer tx-footer">
        <p className="muted-text">
          Показано {(page - 1) * pageSize + (transactions.length ? 1 : 0)}–
          {(page - 1) * pageSize + transactions.length} из {totalCount}
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
    </article>
  );
}

function escapeCsv(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function normalizeStatus(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized === "confirmed" || normalized === "paid") {
    return "ok";
  }
  if (normalized === "failed" || normalized === "expired") {
    return "bad";
  }
  return "neutral";
}

function formatDate(value: string): string {
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

function sumFee(providerFee: string, platformFee: string, turnoverFee: string): string {
  const provider = Number(providerFee);
  const platform = Number(platformFee);
  const turnover = Number(turnoverFee);
  const total =
    (Number.isFinite(provider) ? provider : 0) +
    (Number.isFinite(platform) ? platform : 0) +
    (Number.isFinite(turnover) ? turnover : 0);
  return formatDecimal(total, { minFractionDigits: 0, maxFractionDigits: 8 });
}

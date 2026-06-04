import type { InvoiceTransactionDetails } from "../../api";
import { formatDecimal } from "../../utils/format";
import { formatNetworkConfirmations } from "../../utils/networkConfirmations";
import { getInvoiceDetailStatusMeta } from "../../utils/invoiceStatus";

type InvoiceTransactionDetailsCardProps = {
  details: InvoiceTransactionDetails;
  compact?: boolean;
};

function isStableAsset(currency: string): boolean {
  const normalized = currency.trim().toUpperCase();
  return normalized === "USD" || normalized === "USDT" || normalized === "USDC";
}

function formatTxDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(parsed);
}

function truncateMiddle(value: string, head = 10, tail = 8): string {
  if (value.length <= head + tail + 3) {
    return value;
  }
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function formatRate(value: string | null, currency: string): string {
  if (!value) {
    return "—";
  }
  return `${formatDecimal(value, { maxFractionDigits: 8 })} ${currency}`;
}

function formatCommission(value: string | null, currency: string): string {
  if (value == null) {
    return "—";
  }
  return `${formatDecimal(value)} ${currency}`;
}

function formatNetworkCommission(
  value: string | null,
  currency: string | null,
  cryptoCurrency: string,
): string {
  if (value == null) {
    return `0 ${currency ?? cryptoCurrency}`;
  }
  const amount = formatDecimal(value);
  const label = currency ?? cryptoCurrency;
  return `${amount} ${label}`;
}

async function copyValue(value: string | null | undefined) {
  if (!value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    /* empty */
  }
}

function CopyableValue({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) {
    return (
      <div className="invoice-tx-copyable">
        <span>{label}</span>
        <strong>—</strong>
      </div>
    );
  }

  return (
    <div className="invoice-tx-copyable">
      <span>{label}</span>
      <div className="invoice-tx-copyable-row">
        <strong title={value} translate="no">
          {truncateMiddle(value)}
        </strong>
        <button className="ghost-button invoice-tx-copy-btn" onClick={() => void copyValue(value)} type="button">
          Копировать
        </button>
      </div>
    </div>
  );
}

export function InvoiceTransactionDetailsCard({
  details,
  compact = false,
}: InvoiceTransactionDetailsCardProps) {
  const statusMeta = getInvoiceDetailStatusMeta(details.status);
  const confirmationProgress = formatNetworkConfirmations(
    details.network_confirmations_actual,
    details.network_confirmations_required,
  );

  return (
    <section className={`invoice-modal-card invoice-tx-details${compact ? " invoice-tx-details--compact" : ""}`}>
      <div className="invoice-modal-card-header">
        <div>
          <p className="eyebrow">Транзакция</p>
          <h3>Детали платежа</h3>
        </div>
        <div className="invoice-tx-header-badges">
          {details.is_estimate ? <span className="mc-badge mc-badge-neutral">Расчёт</span> : null}
          <span className={`invoice-status-badge ${statusMeta.className}`}>{statusMeta.label}</span>
        </div>
      </div>

      <div className="invoice-tx-summary" role="table" aria-label="Сводка транзакции">
        <div className="invoice-tx-summary-row invoice-tx-summary-row--head" role="row">
          <span role="columnheader">Дата</span>
          <span role="columnheader">Тип</span>
          <span role="columnheader">Пара</span>
          <span role="columnheader">Крипто</span>
          <span role="columnheader">Фиат</span>
          <span role="columnheader">Статус</span>
        </div>
        <div className="invoice-tx-summary-row" role="row">
          <span role="cell">{formatTxDateTime(details.created_at)}</span>
          <span role="cell">Sale</span>
          <span role="cell">{details.trading_pair}</span>
          <span role="cell">
            {formatDecimal(details.amount_crypto)} {details.crypto_currency}
          </span>
          <span role="cell">
            {details.is_estimate &&
            !isStableAsset(details.crypto_currency) &&
            details.processing_commission == null
              ? "—"
              : `${formatDecimal(details.amount_fiat)} ${details.fiat_currency}`}
          </span>
          <span className="invoice-tx-summary-status" role="cell">
            {statusMeta.label}
          </span>
        </div>
      </div>

      <div className="invoice-tx-meta-grid">
        <div className="invoice-tx-meta-item">
          <span>Последнее изменение</span>
          <strong>{formatTxDateTime(details.last_updated_at)}</strong>
        </div>
        <CopyableValue label="ID обмена" value={details.exchange_id} />
        <CopyableValue label="Адрес кошелька" value={details.wallet_address} />
        <CopyableValue label="HASH" value={details.tx_hash} />
        {confirmationProgress ? (
          <div className="invoice-tx-meta-item">
            <span>Подтверждения сети</span>
            <strong>{confirmationProgress}</strong>
          </div>
        ) : null}
      </div>

      <div className="invoice-tx-fees">
        {details.exchange_rate != null ? (
          <div className="invoice-tx-fee">
            <span>Курс settlement</span>
            <strong>{formatRate(details.exchange_rate, details.exchange_rate_currency)}</strong>
          </div>
        ) : null}
        <div className="invoice-tx-fee">
          <span>Комиссия</span>
          <strong>{formatCommission(details.processing_commission, details.commission_currency)}</strong>
        </div>
        <div className="invoice-tx-fee">
          <span>Комиссия платформы</span>
          <strong>{formatCommission(details.platform_commission, details.commission_currency)}</strong>
        </div>
        <div className="invoice-tx-fee">
          <span>Комиссия сети</span>
          <strong>
            {formatNetworkCommission(
              details.network_commission,
              details.network_commission_currency,
              details.crypto_currency,
            )}
          </strong>
        </div>
      </div>

      {details.is_estimate ? (
        <p className="muted-text invoice-tx-note">
          Комиссии рассчитаны по текущим настройкам. Финальные суммы фиксируются после подтверждения сети.
        </p>
      ) : null}
      {!details.is_estimate && details.processing_commission == null ? (
        <p className="muted-text invoice-tx-note">
          Зачёт в USDT и комиссии появятся после полного подтверждения платежа в сети (
          {details.network_confirmations_actual ?? "?"}/{details.network_confirmations_required ?? "?"}).
        </p>
      ) : null}
    </section>
  );
}

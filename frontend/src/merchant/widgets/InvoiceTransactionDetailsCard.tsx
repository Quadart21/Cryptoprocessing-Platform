import type { InvoiceTransactionDetails } from "../../api";
import { useTranslation } from "../../i18n";
import { formatDecimal } from "../../utils/format";
import { formatNetworkConfirmations } from "../../utils/networkConfirmations";
import { invoiceDetailBadgeClass } from "../../utils/invoiceStatus";

type InvoiceTransactionDetailsCardProps = {
  details: InvoiceTransactionDetails;
  compact?: boolean;
};

const INVOICE_STATUS_KEYS = [
  "pending",
  "confirming",
  "paid",
  "confirmed",
  "expired",
  "cancelled",
  "failed",
] as const;

function formatTxDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
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
  const { t } = useTranslation();

  if (!value) {
    return (
      <div className="invoice-tx-copyable">
        <span>{label}</span>
        <strong>{t("common.dash")}</strong>
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
          {t("common.copy")}
        </button>
      </div>
    </div>
  );
}

function invoiceStatusLabel(status: string, t: (key: string) => string): string {
  const normalized = status.trim().toLowerCase();
  if (INVOICE_STATUS_KEYS.includes(normalized as (typeof INVOICE_STATUS_KEYS)[number])) {
    return t(`merchant.invoiceStatus.${normalized}`);
  }
  return status;
}

export function InvoiceTransactionDetailsCard({
  details,
  compact = false,
}: InvoiceTransactionDetailsCardProps) {
  const { t } = useTranslation();
  const statusLabel = invoiceStatusLabel(details.status, t);
  const statusClassName = invoiceDetailBadgeClass(details.status);
  const confirmationProgress = formatNetworkConfirmations(
    details.network_confirmations_actual,
    details.network_confirmations_required,
  );

  return (
    <section className={`invoice-modal-card invoice-tx-details${compact ? " invoice-tx-details--compact" : ""}`}>
      <div className="invoice-modal-card-header">
        <div>
          <p className="eyebrow">{t("merchant.widgets.invoiceTransactionDetailsCard.eyebrow")}</p>
          <h3>{t("merchant.widgets.invoiceTransactionDetailsCard.title")}</h3>
        </div>
        <div className="invoice-tx-header-badges">
          {details.is_estimate ? <span className="mc-badge mc-badge-neutral">{t("common.estimate")}</span> : null}
          <span className={`invoice-status-badge ${statusClassName}`}>{statusLabel}</span>
        </div>
      </div>

      <div
        className="invoice-tx-summary"
        role="table"
        aria-label={t("merchant.widgets.invoiceTransactionDetailsCard.summaryAria")}
      >
        <div className="invoice-tx-summary-row invoice-tx-summary-row--head" role="row">
          <span role="columnheader">{t("common.date")}</span>
          <span role="columnheader">{t("common.type")}</span>
          <span role="columnheader">{t("common.pair")}</span>
          <span role="columnheader">{t("common.crypto")}</span>
          <span role="columnheader">{t("common.fiat")}</span>
          <span role="columnheader">{t("common.status")}</span>
        </div>
        <div className="invoice-tx-summary-row" role="row">
          <span role="cell">{formatTxDateTime(details.created_at)}</span>
          <span role="cell">{t("merchant.widgets.invoiceTransactionDetailsCard.saleType")}</span>
          <span role="cell">{details.trading_pair}</span>
          <span role="cell">
            {formatDecimal(details.amount_crypto)} {details.crypto_currency}
          </span>
          <span role="cell">
            {formatDecimal(details.amount_fiat)} {details.fiat_currency}
          </span>
          <span className="invoice-tx-summary-status" role="cell">
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="invoice-tx-meta-grid">
        <div className="invoice-tx-meta-item">
          <span>{t("common.lastChange")}</span>
          <strong>{formatTxDateTime(details.last_updated_at)}</strong>
        </div>
        <CopyableValue label={t("common.exchangeId")} value={details.exchange_id} />
        <CopyableValue label={t("common.walletAddress")} value={details.wallet_address} />
        {details.payment_memo ? (
          <CopyableValue label={t("common.memoNotRequired")} value={details.payment_memo} />
        ) : null}
        <CopyableValue label={t("merchant.widgets.invoiceTransactionDetailsCard.hash")} value={details.tx_hash} />
        {confirmationProgress ? (
          <div className="invoice-tx-meta-item">
            <span>{t("common.networkConfirmations")}</span>
            <strong>{confirmationProgress}</strong>
          </div>
        ) : null}
      </div>

      <div className="invoice-tx-fees">
        {details.exchange_rate != null ? (
          <div className="invoice-tx-fee">
            <span>{t("common.settlementRate")}</span>
            <strong>{formatRate(details.exchange_rate, details.exchange_rate_currency)}</strong>
          </div>
        ) : null}
        {details.total_commission != null ? (
          <div className="invoice-tx-fee">
            <span>{t("merchant.widgets.invoiceTransactionDetailsCard.totalCommission")}</span>
            <strong>{formatCommission(details.total_commission, details.commission_currency)}</strong>
          </div>
        ) : (
          <>
            <div className="invoice-tx-fee">
              <span>{t("common.processingFee")}</span>
              <strong>{formatCommission(details.processing_commission, details.commission_currency)}</strong>
            </div>
            <div className="invoice-tx-fee">
              <span>{t("common.platformFee")}</span>
              <strong>{formatCommission(details.platform_commission, details.commission_currency)}</strong>
            </div>
          </>
        )}
        <div className="invoice-tx-fee">
          <span>{t("common.networkFeeLabel")}</span>
          <strong>
            {formatNetworkCommission(
              details.network_commission,
              details.network_commission_currency,
              details.crypto_currency,
            )}
          </strong>
        </div>
      </div>
    </section>
  );
}

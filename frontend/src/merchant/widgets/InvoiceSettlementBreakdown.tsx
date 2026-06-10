import type { InvoiceSettlement } from "../../api";
import { useTranslation } from "../../i18n";
import { formatDecimal } from "../../utils/format";
import { invoiceAccountingReady } from "../../utils/invoiceAccounting";

type InvoiceSettlementBreakdownProps = {
  settlement: InvoiceSettlement | null | undefined;
  invoiceStatus: string;
  exchangeRate?: string | null;
  exchangeRateCurrency?: string | null;
};

function formatMoney(amount: string, currency: string): string {
  return `${formatDecimal(amount)} ${currency}`;
}

function formatRate(value: string, currency: string): string {
  return `${formatDecimal(value, { maxFractionDigits: 8 })} ${currency}`;
}

export function InvoiceSettlementBreakdown({
  settlement,
  invoiceStatus,
  exchangeRate,
  exchangeRateCurrency,
}: InvoiceSettlementBreakdownProps) {
  const { t } = useTranslation();

  if (!invoiceAccountingReady({ status: invoiceStatus, settlement })) {
    return null;
  }

  if (!settlement) {
    return null;
  }

  const paidAtFormatted = settlement.paid_at
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(settlement.paid_at),
      )
    : null;

  return (
    <div className="invoice-modal-card invoice-settlement-card">
      <div className="invoice-modal-card-header">
        <div>
          <p className="eyebrow">{t("merchant.widgets.invoiceSettlementBreakdown.eyebrow")}</p>
          <h3>{t("merchant.widgets.invoiceSettlementBreakdown.title")}</h3>
        </div>
      </div>

      <dl className="invoice-settlement-rows">
        <div className="invoice-settlement-row invoice-settlement-row--crypto">
          <dt>{t("merchant.widgets.invoiceSettlementBreakdown.clientSent")}</dt>
          <dd>{formatMoney(settlement.amount_crypto, settlement.crypto_currency)}</dd>
        </div>
        {exchangeRate && exchangeRateCurrency ? (
          <div className="invoice-settlement-row">
            <dt>{t("common.settlementRate")}</dt>
            <dd>{formatRate(exchangeRate, exchangeRateCurrency)}</dd>
          </div>
        ) : null}
        <div className="invoice-settlement-row invoice-settlement-row--highlight">
          <dt>
            {t("merchant.widgets.invoiceSettlementBreakdown.creditIn", { currency: settlement.currency })}
          </dt>
          <dd>{formatMoney(settlement.gross_amount, settlement.currency)}</dd>
        </div>
        <div className="invoice-settlement-row invoice-settlement-row--fee-total">
          <dt>{t("merchant.widgets.invoiceSettlementBreakdown.commission")}</dt>
          <dd>{formatMoney(settlement.total_fee, settlement.currency)}</dd>
        </div>
        <div className="invoice-settlement-row invoice-settlement-row--net">
          <dt>{t("merchant.widgets.invoiceSettlementBreakdown.netCredit")}</dt>
          <dd>{formatMoney(settlement.net_amount, settlement.currency)}</dd>
        </div>
      </dl>

      {paidAtFormatted ? (
        <p className="muted-text invoice-settlement-note">
          {t("merchant.widgets.invoiceSettlementBreakdown.paidAt", { date: paidAtFormatted })}
        </p>
      ) : null}
    </div>
  );
}

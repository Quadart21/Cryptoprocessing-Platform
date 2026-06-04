import type { InvoiceSettlement } from "../../api";
import { formatDecimal } from "../../utils/format";
import { invoiceAccountingReady } from "../../utils/invoiceAccounting";

type InvoiceSettlementBreakdownProps = {
  settlement: InvoiceSettlement | null | undefined;
  invoiceStatus: string;
};

function formatMoney(amount: string, currency: string): string {
  return `${formatDecimal(amount)} ${currency}`;
}

export function InvoiceSettlementBreakdown({
  settlement,
  invoiceStatus,
}: InvoiceSettlementBreakdownProps) {
  if (!invoiceAccountingReady({ status: invoiceStatus, settlement })) {
    return null;
  }

  if (!settlement) {
    return null;
  }

  return (
    <div className="invoice-modal-card invoice-settlement-card">
      <div className="invoice-modal-card-header">
        <div>
          <p className="eyebrow">Расчёт</p>
          <h3>Детализация платежа</h3>
        </div>
      </div>

      <dl className="invoice-settlement-rows">
        <div className="invoice-settlement-row invoice-settlement-row--crypto">
          <dt>Клиент отправил</dt>
          <dd>
            {formatMoney(settlement.amount_crypto, settlement.crypto_currency)}
          </dd>
        </div>
        <div className="invoice-settlement-row invoice-settlement-row--highlight">
          <dt>Зачёт в {settlement.currency}</dt>
          <dd>{formatMoney(settlement.gross_amount, settlement.currency)}</dd>
        </div>
        <div className="invoice-settlement-row invoice-settlement-row--fee-total">
          <dt>Комиссия</dt>
          <dd>{formatMoney(settlement.total_fee, settlement.currency)}</dd>
        </div>
        <div className="invoice-settlement-row invoice-settlement-row--net">
          <dt>К зачислению</dt>
          <dd>{formatMoney(settlement.net_amount, settlement.currency)}</dd>
        </div>
      </dl>

      {settlement.paid_at ? (
        <p className="muted-text invoice-settlement-note">
          Оплачено:{" "}
          {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(
            new Date(settlement.paid_at),
          )}
        </p>
      ) : null}
    </div>
  );
}

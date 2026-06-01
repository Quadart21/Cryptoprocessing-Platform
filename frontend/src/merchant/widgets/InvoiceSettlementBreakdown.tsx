import type { InvoiceSettlement } from "../../api";
import { formatDecimal } from "../../utils/format";

type InvoiceSettlementBreakdownProps = {
  settlement: InvoiceSettlement | null | undefined;
  invoiceStatus: string;
  fallbackCurrency: string;
  fallbackAmountCrypto?: string | null;
  fallbackCryptoCurrency?: string | null;
};

function formatMoney(amount: string, currency: string): string {
  return `${formatDecimal(amount)} ${currency}`;
}

function isPaidLikeStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === "paid" || normalized === "confirmed";
}

export function InvoiceSettlementBreakdown({
  settlement,
  invoiceStatus,
  fallbackCurrency,
  fallbackAmountCrypto,
  fallbackCryptoCurrency,
}: InvoiceSettlementBreakdownProps) {
  const currency = settlement?.currency ?? fallbackCurrency;
  const amountCrypto = settlement?.amount_crypto ?? fallbackAmountCrypto ?? "0";
  const cryptoCurrency = settlement?.crypto_currency ?? fallbackCryptoCurrency ?? "—";
  const showFinal = settlement?.is_final ?? isPaidLikeStatus(invoiceStatus);

  if (!settlement) {
    return (
      <div className="invoice-modal-card invoice-settlement-card">
        <div className="invoice-modal-card-header">
          <div>
            <p className="eyebrow">Расчёт</p>
            <h3>Детализация платежа</h3>
          </div>
        </div>
        <p className="muted-text">
          {isPaidLikeStatus(invoiceStatus)
            ? "Данные расчёта появятся после синхронизации статуса."
            : "После оплаты здесь будет сумма клиента, комиссии и зачисление на баланс."}
        </p>
      </div>
    );
  }

  return (
    <div className="invoice-modal-card invoice-settlement-card">
      <div className="invoice-modal-card-header">
        <div>
          <p className="eyebrow">Расчёт</p>
          <h3>Детализация платежа</h3>
        </div>
        {!showFinal ? <span className="mc-badge mc-badge-neutral">Ожидает оплаты</span> : null}
      </div>

      <dl className="invoice-settlement-rows">
        <div className="invoice-settlement-row invoice-settlement-row--crypto">
          <dt>Клиент отправил</dt>
          <dd>
            {formatMoney(amountCrypto, cryptoCurrency)}
          </dd>
        </div>
        <div className="invoice-settlement-row invoice-settlement-row--highlight">
          <dt>Зачёт в {currency}</dt>
          <dd>{formatMoney(settlement.gross_amount, currency)}</dd>
        </div>
        <div className="invoice-settlement-row">
          <dt>Комиссия обработки</dt>
          <dd>{formatMoney(settlement.processing_fee, currency)}</dd>
        </div>
        <div className="invoice-settlement-row">
          <dt>Комиссия платформы</dt>
          <dd>{formatMoney(settlement.platform_fee, currency)}</dd>
        </div>
        <div className="invoice-settlement-row invoice-settlement-row--fee-total">
          <dt>Итого комиссий</dt>
          <dd>{formatMoney(settlement.total_fee, currency)}</dd>
        </div>
        <div className="invoice-settlement-row invoice-settlement-row--net">
          <dt>К зачислению</dt>
          <dd>{formatMoney(settlement.net_amount, currency)}</dd>
        </div>
      </dl>

      {!showFinal ? (
        <p className="muted-text invoice-settlement-note">
          Предварительный расчёт. Точные суммы фиксируются после подтверждения оплаты.
        </p>
      ) : settlement.paid_at ? (
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

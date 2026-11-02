import type { InvoiceAdminDetail, InvoiceAmountReview, ProjectItem, ProviderEventItem, TransactionItem } from "../../../api";
import { CopyableIdentifier } from "../../../components/CopyableIdentifier";
import { InvoiceTransactionDetailsCard } from "../../../merchant/widgets/InvoiceTransactionDetailsCard";
import { InvoiceStatusOverrideControl } from "../../components/InvoiceStatusOverrideControl";
import { ProviderEventList } from "../../components/ProviderEventList";
import { formatDecimal } from "../../../utils/format";
import { invoiceCompactPillClass, invoiceStatusLabelRu } from "../../../utils/invoiceStatus";
import {
  invoiceCanAttemptSettlementRepair,
  invoiceNeedsSettlementRepair,
} from "../../../utils/invoiceSettlementRepair";
import { formatWhen } from "./model";

type ClientCardInvoiceProps = {
  events: ProviderEventItem[];
  invoice: InvoiceAdminDetail;
  isSuperadmin: boolean;
  loading: boolean;
  projects: ProjectItem[];
  transaction: TransactionItem | undefined;
  onBack: () => void;
  onRepair: (invoiceId: string) => void;
  onSync: (invoiceId: string) => void;
  onUpdateStatus: (status: string) => void;
  onCreditReceived: () => void;
};

export function ClientCardInvoice({
  events,
  invoice,
  isSuperadmin,
  loading,
  projects,
  transaction,
  onBack,
  onRepair,
  onSync,
  onUpdateStatus,
  onCreditReceived,
}: ClientCardInvoiceProps) {
  const project = projects.find((item) => item.id === invoice.project_id);
  const showRepair = invoiceCanAttemptSettlementRepair(invoice, transaction);
  const repairLooksMisconverted = invoiceNeedsSettlementRepair(invoice, transaction);
  const payload = invoice.raw_provider_payload_json;

  return (
    <article className="cc-card cc-invoice">
      <div className="cc-invoice-head">
        <div>
          <button className="cc-back cc-detail-back" onClick={onBack} type="button">
            ← К списку инвойсов
          </button>
          <h3>{invoice.merchant_order_id}</h3>
          <p className="cc-hint">{project?.name ?? "Проект не найден"}</p>
        </div>
        <span className={invoiceCompactPillClass(invoice.status)}>{invoiceStatusLabelRu(invoice.status)}</span>
      </div>

      <div className="cc-metrics">
        <Metric label="Сумма" value={`${formatDecimal(invoice.amount_fiat)} ${invoice.fiat_currency}`} />
        <Metric label="Криптосумма" value={`${formatDecimal(invoice.amount_crypto)} ${invoice.crypto_currency}`} />
        <Metric label="Сеть" value={invoice.network || "—"} />
        {invoice.transaction_details?.exchange_rate ? (
          <Metric
            label="Курс settlement"
            value={`${formatDecimal(invoice.transaction_details.exchange_rate, { maxFractionDigits: 8 })} ${invoice.transaction_details.exchange_rate_currency}`}
          />
        ) : null}
      </div>

      {invoice.transaction_details ? <InvoiceTransactionDetailsCard compact details={invoice.transaction_details} /> : null}

      <div className="cc-id-stack">
        <CopyableIdentifier label="Invoice ID" value={invoice.id} variant="inline" />
        <CopyableIdentifier label="Provider order" value={invoice.provider_order_id} variant="inline" />
        <CopyableIdentifier label="Адрес оплаты" value={invoice.payment_address} variant="inline" />
        {invoice.payment_memo ? <CopyableIdentifier label="Memo" value={invoice.payment_memo} variant="inline" /> : null}
      </div>

      <dl className="cc-dl cc-dl-dates">
        <dt>Создан</dt>
        <dd>{formatWhen(invoice.created_at)}</dd>
        <dt>Истекает</dt>
        <dd>{formatWhen(invoice.expires_at)}</dd>
        <dt>Оплачен</dt>
        <dd>{formatWhen(invoice.paid_at)}</dd>
        <dt>Подтверждён</dt>
        <dd>{formatWhen(invoice.confirmed_at)}</dd>
      </dl>

      <AmountReviewPanel
        cryptoCurrency={invoice.crypto_currency}
        isSuperadmin={isSuperadmin}
        loading={loading}
        review={invoice.amount_review}
        onCredit={onCreditReceived}
      />

      {repairLooksMisconverted ? (
        <p className="cc-banner cc-banner-bad">
          Ошибка учёта: gross в USDT совпадает с суммой в {invoice.crypto_currency}. «Пересчитать settlement» пересчитает
          gross и комиссии по курсу.
        </p>
      ) : showRepair ? (
        <p className="cc-banner">
          Оплаченный altcoin-инвойс. При необходимости settlement в USDT можно пересчитать по текущему курсу.
        </p>
      ) : null}

      <div className="cc-actions">
        <button className="ghost-button" disabled={loading} onClick={() => onSync(invoice.id)} type="button">
          Синхронизировать
        </button>
        {showRepair ? (
          <button className="ghost-button danger-soft" disabled={loading} onClick={() => onRepair(invoice.id)} type="button">
            Пересчитать settlement
          </button>
        ) : null}
      </div>

      {isSuperadmin ? (
        <InvoiceStatusOverrideControl currentStatus={invoice.status} disabled={loading} onApply={onUpdateStatus} />
      ) : (
        <p className="cc-hint">Ручная смена статуса доступна только superadmin.</p>
      )}

      <details className="cc-disclosure">
        <summary>Сырой ответ провайдера</summary>
        {payload ? (
          <pre className="json-box">{JSON.stringify(payload, null, 2)}</pre>
        ) : (
          <p className="cc-hint">Payload пуст.</p>
        )}
      </details>
      <details className="cc-disclosure" open>
        <summary>События Crypto-Cash · {events.length}</summary>
        <ProviderEventList compact events={events} />
      </details>
    </article>
  );
}

function AmountReviewPanel({
  review,
  cryptoCurrency,
  isSuperadmin,
  loading,
  onCredit,
}: {
  review: InvoiceAmountReview | null;
  cryptoCurrency: string;
  isSuperadmin: boolean;
  loading: boolean;
  onCredit: () => void;
}) {
  if (!review) {
    return null;
  }
  const currency = review.currency || cryptoCurrency;
  const receivedLabel = review.received_amount
    ? `${formatDecimal(review.received_amount)} ${currency}`
    : "сумма ещё не известна";
  const open = !review.credited;
  return (
    <div className={`cc-banner ${open ? "cc-banner-wait" : ""}`}>
      <div>
        <strong>{open ? "Сумма не совпала — только ручное зачисление" : "Зачислено по фактической сумме"}</strong>
        <p>
          {open
            ? "Провайдер такие платежи сам не проводит. Подтвердите ровно то, что пришло."
            : "Платёж проведён на сумму, которая реально пришла, а не на сумму счёта."}
        </p>
        <dl className="cc-dl">
          <dt>Ожидали</dt>
          <dd>{review.expected_amount ? `${formatDecimal(review.expected_amount)} ${currency}` : "—"}</dd>
          <dt>Пришло</dt>
          <dd>{receivedLabel}</dd>
          <dt>Разница</dt>
          <dd>{review.delta_amount ? `${formatDecimal(review.delta_amount)} ${currency}` : "—"}</dd>
          {review.usdt_total ? (
            <>
              <dt>USDT у провайдера</dt>
              <dd>{formatDecimal(review.usdt_total)} USDT</dd>
            </>
          ) : null}
        </dl>
      </div>
      {open && isSuperadmin ? (
        <button className="primary-button" disabled={loading || !review.received_amount} onClick={onCredit} type="button">
          Зачислить {receivedLabel}
        </button>
      ) : null}
      {open && !isSuperadmin ? <p>Подтвердить сумму может только superadmin.</p> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="cc-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

import type { InvoiceAdminDetail, ProjectItem, ProviderEventItem, TransactionItem } from "../../../api";
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="cc-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

import type { PayoutRequestItem } from "../../api";
import { formatDecimal } from "../../utils/format";
import { StatusPill } from "./client-card/fields";
import { formatWhen, payoutStatusLabel, payoutStatusTone } from "./client-card/model";

type TenantPayoutsPanelProps = {
  payouts: PayoutRequestItem[];
  loading: boolean;
  onApprove: (payoutId: string) => void;
  onReject: (payoutId: string) => void;
};

export function TenantPayoutsPanel({ payouts, loading, onApprove, onReject }: TenantPayoutsPanelProps) {
  if (payouts.length === 0) {
    return <p className="cc-empty">Запросов на вывод пока нет.</p>;
  }

  return (
    <div className="cc-list">
      {payouts.map((payout) => (
        <article className="cc-record" key={payout.id}>
          <div className="cc-record-main">
            <strong>
              {formatDecimal(payout.amount_requested)} {payout.currency}
            </strong>
            <p>
              {payout.project_name ?? "Проект не указан"} · {payout.network}
            </p>
            <p className="cc-mono cc-break">{payout.destination_address}</p>
            {payout.amount_approved ? (
              <p className="cc-hint">
                Одобрено {formatDecimal(payout.amount_approved)} {payout.currency}
              </p>
            ) : null}
            {payout.review_comment ? <p className="cc-hint">Комментарий: {payout.review_comment}</p> : null}
          </div>
          <div className="cc-record-side">
            <StatusPill tone={payoutStatusTone(payout.status)}>{payoutStatusLabel(payout.status)}</StatusPill>
            <time dateTime={payout.created_at}>{formatWhen(payout.created_at)}</time>
            {payout.status === "pending_review" ? (
              <div className="cc-actions">
                <button className="primary-button" disabled={loading} onClick={() => onApprove(payout.id)} type="button">
                  Одобрить
                </button>
                <button className="ghost-button" disabled={loading} onClick={() => onReject(payout.id)} type="button">
                  Отклонить
                </button>
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

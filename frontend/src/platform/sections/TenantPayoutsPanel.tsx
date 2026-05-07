import type { PayoutRequestItem } from "../../api";
import { formatDecimal } from "../../utils/format";

type TenantPayoutsPanelProps = {
  payouts: PayoutRequestItem[];
  loading: boolean;
  onApprove: (payoutId: string) => void;
  onReject: (payoutId: string) => void;
};

export function TenantPayoutsPanel({
  payouts,
  loading,
  onApprove,
  onReject,
}: TenantPayoutsPanelProps) {
  return (
    <div className="detail-section">
      <h3>Запросы на вывод (USDT TRC20)</h3>
      <div className="tenant-list">
        {payouts.length === 0 ? (
          <p className="muted-text">Запросов на вывод пока нет.</p>
        ) : (
          payouts.map((payout) => (
            <article className="tenant-card" key={payout.id}>
              <div>
                <strong>
                  {formatDecimal(payout.amount_requested)} {payout.currency}
                </strong>
                <p>Проект: {payout.project_name ?? payout.project_id ?? "не указан"}</p>
                <p>{payout.network}</p>
                <p>{payout.destination_address}</p>
                <p>Комментарий: {payout.review_comment ?? "нет"}</p>
              </div>
              <div className="tenant-meta">
                <span>{payout.status}</span>
                <span>{payout.created_at}</span>
                {payout.status === "pending_review" ? (
                  <div className="action-row">
                    <button
                      className="primary-button"
                      disabled={loading}
                      onClick={() => onApprove(payout.id)}
                      type="button"
                    >
                      Одобрить
                    </button>
                    <button
                      className="ghost-button"
                      disabled={loading}
                      onClick={() => onReject(payout.id)}
                      type="button"
                    >
                      Отклонить
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

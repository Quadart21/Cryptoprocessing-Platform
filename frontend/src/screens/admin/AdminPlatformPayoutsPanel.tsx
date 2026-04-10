import type { PayoutRequestItem } from "../../api";

type AdminPlatformPayoutsPanelProps = {
  payouts: PayoutRequestItem[];
  loading: boolean;
  onApprove: (payoutId: string) => void;
  onReject: (payoutId: string) => void;
  onOpenTenant: (tenantId: string) => void;
};

export function AdminPlatformPayoutsPanel({
  payouts,
  loading,
  onApprove,
  onReject,
  onOpenTenant,
}: AdminPlatformPayoutsPanelProps) {
  return (
    <section className="panel panel-span-2">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Выплаты</p>
          <h2>Глобальный список заявок на вывод</h2>
        </div>
      </div>

      <div className="tenant-list">
        {payouts.length === 0 ? (
          <p className="muted-text">Заявок на вывод пока нет.</p>
        ) : (
          payouts.map((payout) => (
            <article className="tenant-card" key={payout.id}>
              <div>
                <strong>
                  {payout.amount_requested} {payout.currency}
                </strong>
                <p>Проект: {payout.project_name ?? payout.project_id ?? "Не указан"}</p>
                <p>Клиент: {payout.tenant_name ?? payout.tenant_id}</p>
                <p>Кошелек: {payout.destination_address}</p>
                <p>Сеть: {payout.network}</p>
                <p>Комментарий: {payout.review_comment ?? "нет"}</p>
              </div>
              <div className="tenant-meta">
                <span>{payout.status}</span>
                <span>{payout.created_at}</span>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onOpenTenant(payout.tenant_id)}
                >
                  К проекту
                </button>
                {payout.status === "pending_review" ? (
                  <div className="action-row">
                    <button
                      type="button"
                      className="primary-button"
                      disabled={loading}
                      onClick={() => onApprove(payout.id)}
                    >
                      Подтвердить
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={loading}
                      onClick={() => onReject(payout.id)}
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
    </section>
  );
}

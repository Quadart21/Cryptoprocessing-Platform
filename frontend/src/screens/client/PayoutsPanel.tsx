import { FormEvent } from "react";

import type { CreatePayoutPayload, PayoutRequestItem, ProjectItem } from "../../api";

type PayoutsPanelProps = {
  projects: ProjectItem[];
  payoutForm: CreatePayoutPayload;
  payouts: PayoutRequestItem[];
  loading: boolean;
  onPayoutFormChange: (next: CreatePayoutPayload) => void;
  onCreatePayout: (event: FormEvent<HTMLFormElement>) => void;
};

export function PayoutsPanel({
  projects,
  payoutForm,
  payouts,
  loading,
  onPayoutFormChange,
  onCreatePayout,
}: PayoutsPanelProps) {
  return (
    <article className="panel panel-span-2">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Вывод средств</p>
          <h2>Запрос на вывод USDT TRC20</h2>
        </div>
      </div>

      <div className="dashboard-grid client-grid">
        <form className="form integration-form" onSubmit={onCreatePayout}>
          <label>
            <span>Проект</span>
            <select
              value={payoutForm.project_id}
              onChange={(event) => onPayoutFormChange({ ...payoutForm, project_id: event.target.value })}
            >
              <option value="">Выберите проект</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Сумма (USDT)</span>
            <input
              min="0.01"
              onChange={(event) =>
                onPayoutFormChange({ ...payoutForm, amount: Number(event.target.value) })
              }
              step="0.00000001"
              type="number"
              value={payoutForm.amount || ""}
            />
          </label>
          <label>
            <span>Кошелек TRC20</span>
            <input
              onChange={(event) =>
                onPayoutFormChange({
                  ...payoutForm,
                  destination_address: event.target.value,
                })
              }
              placeholder="T..."
              value={payoutForm.destination_address}
            />
          </label>
          <label>
            <span>Комментарий (опционально)</span>
            <input
              onChange={(event) =>
                onPayoutFormChange({
                  ...payoutForm,
                  note: event.target.value,
                })
              }
              placeholder="Например: вывод за март"
              value={payoutForm.note ?? ""}
            />
          </label>
          <div className="result-box hint-box">
            <p>Сеть фиксирована: TRC20</p>
            <p>Валюта фиксирована: USDT</p>
            <p>После отправки сумма уйдёт в locked до решения администратора.</p>
          </div>
          <button className="primary-button" disabled={loading} type="submit">
            {loading ? "Отправляем..." : "Отправить запрос на вывод"}
          </button>
        </form>

        <div className="tenant-list">
          {payouts.length === 0 ? (
            <p className="muted-text">Запросов на вывод пока нет.</p>
          ) : (
            payouts.map((payout) => (
              <article className="tenant-card" key={payout.id}>
                <div>
                  <strong>
                    {payout.amount_requested} {payout.currency}
                  </strong>
                  <p>{payout.network}</p>
                  <p>{payout.destination_address}</p>
                  <p>{payout.review_comment ?? "Без комментария"}</p>
                </div>
                <div className="tenant-meta">
                  <span>{payout.status}</span>
                  <span>{payout.created_at}</span>
                  {payout.amount_approved ? <span>Approved: {payout.amount_approved}</span> : null}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </article>
  );
}

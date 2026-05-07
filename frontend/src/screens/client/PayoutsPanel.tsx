import { FormEvent } from "react";

import type { CreatePayoutPayload, PayoutRequestItem, ProjectItem } from "../../api";
import { formatDecimal } from "../../utils/format";

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
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));

  return (
    <article className="mc-surface mc-surface--span">
      <header className="mc-surface-header">
        <p className="mc-surface-eyebrow">Ликвидность</p>
        <h2 className="mc-surface-title">Вывод средств</h2>
        <p className="mc-surface-desc">
          Запрос на вывод в USDT (TRC20). После отправки сумма уходит в locked до решения администратора.
        </p>
      </header>

      <div className="mc-split mc-split--balanced">
        <form className="mc-form mc-nested" onSubmit={onCreatePayout}>
          <label className="mc-field">
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
          <label className="mc-field">
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
          <label className="mc-field">
            <span>Адрес TRC20</span>
            <input
              onChange={(event) =>
                onPayoutFormChange({
                  ...payoutForm,
                  destination_address: event.target.value,
                })
              }
              placeholder="T…"
              value={payoutForm.destination_address}
            />
          </label>
          <label className="mc-field">
            <span>Комментарий</span>
            <small>Необязательно</small>
            <input
              onChange={(event) =>
                onPayoutFormChange({
                  ...payoutForm,
                  note: event.target.value,
                })
              }
              placeholder="Например: вывод за период"
              value={payoutForm.note ?? ""}
            />
          </label>
          <div className="mc-hint-box">
            <p>Сеть и валюта фиксированы: USDT, TRC20.</p>
          </div>
          <button className="primary-button" disabled={loading} type="submit">
            {loading ? "Отправляем…" : "Отправить запрос"}
          </button>
        </form>

        <div className="mc-nested">
          <p className="mc-surface-eyebrow" style={{ marginBottom: 12 }}>
            История запросов
          </p>
          <div className="mc-rows">
            {payouts.length === 0 ? (
              <div className="mc-empty">Запросов пока нет.</div>
            ) : (
              payouts.map((payout) => (
                <div className="mc-row" key={payout.id}>
                  <div>
                    <p className="mc-row-title">
                      {formatDecimal(payout.amount_requested)} {payout.currency}
                    </p>
                    <p className="mc-row-sub">
                      {payout.project_name ??
                        (payout.project_id ? projectNameById.get(payout.project_id) : null) ??
                        "Проект не указан"}
                    </p>
                    <p className="mc-row-sub mc-row-mono">{payout.destination_address}</p>
                    <p className="mc-row-sub" style={{ fontSize: 12 }}>
                      {payout.review_comment ?? "—"}
                    </p>
                  </div>
                  <div className="mc-row-badges">
                    <span className="mc-badge mc-badge-neutral">{payout.status}</span>
                    <span className="mc-badge mc-badge-neutral" style={{ fontWeight: 600 }}>
                      {payout.network}
                    </span>
                    {payout.amount_approved ? (
                      <span className="mc-badge mc-badge-ok">✓ {formatDecimal(payout.amount_approved)}</span>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

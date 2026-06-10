import { FormEvent } from "react";

import type { CreatePayoutPayload, PayoutRequestItem, ProjectItem } from "../../api";
import { useTranslation } from "../../i18n";
import { formatDecimal } from "../../utils/format";

export type PayoutDeskProps = {
  projects: ProjectItem[];
  payoutForm: CreatePayoutPayload;
  payouts: PayoutRequestItem[];
  loading: boolean;
  onPayoutFormChange: (next: CreatePayoutPayload) => void;
  onCreatePayout: (event: FormEvent<HTMLFormElement>) => void;
};

export function PayoutDesk({
  projects,
  payoutForm,
  payouts,
  loading,
  onPayoutFormChange,
  onCreatePayout,
}: PayoutDeskProps) {
  const { t } = useTranslation();
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));

  return (
    <article className="mc-surface mc-surface--span">
      <header className="mc-surface-header">
        <p className="mc-surface-eyebrow">{t("merchant.widgets.payoutDesk.eyebrow")}</p>
        <h2 className="mc-surface-title">{t("merchant.widgets.payoutDesk.title")}</h2>
        <p className="mc-surface-desc">{t("merchant.widgets.payoutDesk.description")}</p>
      </header>

      <div className="mc-split mc-split--balanced">
        <form className="mc-form mc-nested" onSubmit={onCreatePayout}>
          <label className="mc-field">
            <span>{t("merchant.widgets.payoutDesk.project")}</span>
            <select
              value={payoutForm.project_id}
              onChange={(event) => onPayoutFormChange({ ...payoutForm, project_id: event.target.value })}
            >
              <option value="">{t("common.selectProject")}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mc-field">
            <span>{t("merchant.widgets.payoutDesk.amountUsdt")}</span>
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
            <span>{t("merchant.widgets.payoutDesk.trc20Address")}</span>
            <input
              onChange={(event) =>
                onPayoutFormChange({
                  ...payoutForm,
                  destination_address: event.target.value,
                })
              }
              placeholder={t("merchant.widgets.payoutDesk.addressPlaceholder")}
              value={payoutForm.destination_address}
            />
          </label>
          <label className="mc-field">
            <span>{t("merchant.widgets.payoutDesk.comment")}</span>
            <small>{t("common.optional")}</small>
            <input
              onChange={(event) =>
                onPayoutFormChange({
                  ...payoutForm,
                  note: event.target.value,
                })
              }
              placeholder={t("merchant.widgets.payoutDesk.commentPlaceholder")}
              value={payoutForm.note ?? ""}
            />
          </label>
          <div className="mc-hint-box">
            <p>{t("merchant.widgets.payoutDesk.fixedNetworkHint")}</p>
          </div>
          <button className="primary-button" disabled={loading} type="submit">
            {loading
              ? t("merchant.widgets.payoutDesk.submitSending")
              : t("merchant.widgets.payoutDesk.submitSend")}
          </button>
        </form>

        <div className="mc-nested">
          <p className="mc-surface-eyebrow" style={{ marginBottom: 12 }}>
            {t("merchant.widgets.payoutDesk.historyEyebrow")}
          </p>
          <div className="mc-rows">
            {payouts.length === 0 ? (
              <div className="mc-empty">{t("merchant.widgets.payoutDesk.emptyHistory")}</div>
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
                        t("common.projectNotSpecified")}
                    </p>
                    <p className="mc-row-sub mc-row-mono">{payout.destination_address}</p>
                    <p className="mc-row-sub" style={{ fontSize: 12 }}>
                      {payout.review_comment ?? t("common.dash")}
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

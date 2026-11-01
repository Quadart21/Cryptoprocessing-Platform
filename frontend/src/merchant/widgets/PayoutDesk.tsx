import { FormEvent, useEffect, useMemo, useState } from "react";

import type { BalanceResponse, CreatePayoutPayload, PayoutRequestItem, ProjectItem } from "../../api";
import { useLocale, useTranslation } from "../../i18n";
import { formatDecimal } from "../../utils/format";

const TRC20_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{25,45}$/;
const AMOUNT_SCALE = 100_000_000n;

type HistoryFilter = "all" | "pending_review" | "processed" | "rejected";

type FieldErrors = {
  project?: string;
  amount?: string;
  address?: string;
};

export type PayoutDeskProps = {
  balance: BalanceResponse | null;
  projects: ProjectItem[];
  payoutForm: CreatePayoutPayload;
  payouts: PayoutRequestItem[];
  loading: boolean;
  onPayoutFormChange: (next: CreatePayoutPayload) => void;
  onCreatePayout: (event: FormEvent<HTMLFormElement>) => void;
};

export function PayoutDesk({
  balance,
  projects,
  payoutForm,
  payouts,
  loading,
  onPayoutFormChange,
  onCreatePayout,
}: PayoutDeskProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [amountText, setAmountText] = useState(payoutForm.amount ? String(payoutForm.amount) : "");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const currency = balance?.currency || "USDT";
  const availableText = balance?.available_amount ?? "0";
  const availableUnits = toUnits(availableText);
  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );

  useEffect(() => {
    if (payoutForm.amount) {
      return;
    }
    setAmountText((current) => {
      if (!current || /^0(?:\.0*)?$/.test(current)) {
        return current;
      }
      return "";
    });
  }, [payoutForm.amount]);

  useEffect(() => {
    if (projects.length === 1 && !payoutForm.project_id) {
      onPayoutFormChange({ ...payoutForm, project_id: projects[0].id });
    }
    // Fill the only project once; the form object is read from this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, payoutForm.project_id]);

  const counts = useMemo(() => {
    const next = { all: payouts.length, pending_review: 0, processed: 0, rejected: 0 };
    for (const payout of payouts) {
      if (payout.status === "pending_review" || payout.status === "processed" || payout.status === "rejected") {
        next[payout.status] += 1;
      }
    }
    return next;
  }, [payouts]);

  const visiblePayouts = useMemo(
    () => (filter === "all" ? payouts : payouts.filter((payout) => payout.status === filter)),
    [filter, payouts],
  );

  function updateAmount(raw: string) {
    const normalized = raw.replace(",", ".").replace(/[^\d.]/g, "");
    const parts = normalized.split(".");
    const nextText = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("").slice(0, 8)}` : parts[0];
    setAmountText(nextText);
    const parsed = Number(nextText);
    onPayoutFormChange({
      ...payoutForm,
      amount: nextText && Number.isFinite(parsed) ? parsed : 0,
    });
    setErrors((current) => ({ ...current, amount: undefined }));
  }

  function fillAvailable() {
    if (availableUnits === null || availableUnits <= 0n) {
      return;
    }
    const nextText = trimDecimal(availableText);
    setAmountText(nextText);
    const parsed = Number(nextText);
    onPayoutFormChange({
      ...payoutForm,
      amount: Number.isFinite(parsed) ? parsed : 0,
    });
    setErrors((current) => ({ ...current, amount: undefined }));
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!payoutForm.project_id) {
      next.project = t("merchant.widgets.payoutDesk.needProject");
    }
    const amountUnits = toUnits(amountText);
    if (amountUnits === null || amountUnits <= 0n) {
      next.amount = t("merchant.widgets.payoutDesk.needAmount");
    } else if (availableUnits !== null && amountUnits > availableUnits) {
      next.amount = t("merchant.widgets.payoutDesk.amountTooHigh");
    }
    const address = payoutForm.destination_address.trim();
    if (!TRC20_ADDRESS.test(address)) {
      next.address = t("merchant.widgets.payoutDesk.badAddress");
    }
    return next;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0 || projects.length === 0) {
      event.preventDefault();
      setErrors(nextErrors);
      return;
    }
    onCreatePayout(event);
  }

  async function copyAddress(payoutId: string, address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedId(payoutId);
      window.setTimeout(() => setCopiedId((current) => (current === payoutId ? null : current)), 1600);
    } catch {
      setCopiedId(null);
    }
  }

  const filters: Array<{ key: HistoryFilter; label: string }> = [
    { key: "all", label: t("merchant.widgets.payoutDesk.filterAll") },
    { key: "pending_review", label: t("merchant.widgets.payoutDesk.filterPending") },
    { key: "processed", label: t("merchant.widgets.payoutDesk.filterPaid") },
    { key: "rejected", label: t("merchant.widgets.payoutDesk.filterRejected") },
  ];

  return (
    <article className="mc-surface mc-liq">
      <header className="mc-surface-header">
        <p className="mc-surface-eyebrow">{t("merchant.widgets.payoutDesk.eyebrow")}</p>
        <h2 className="mc-surface-title">{t("merchant.widgets.payoutDesk.title")}</h2>
        <p className="mc-surface-desc">{t("merchant.widgets.payoutDesk.description")}</p>
      </header>

      <div className="mc-liq-facts" aria-label={t("merchant.widgets.payoutDesk.factsAria")}>
        <article className="mc-liq-fact mc-liq-fact--main">
          <span>{t("merchant.widgets.payoutDesk.availableToWithdraw")}</span>
          <strong>
            {formatDecimal(availableText)} {currency}
          </strong>
        </article>
        <article className="mc-liq-fact">
          <span>{t("merchant.stats.inPayout")}</span>
          <strong>
            {formatDecimal(balance?.locked_amount ?? "0")} {currency}
          </strong>
        </article>
        <article className="mc-liq-fact">
          <span>{t("merchant.stats.frozen")}</span>
          <strong>
            {formatDecimal(balance?.frozen_amount ?? "0")} {currency}
          </strong>
        </article>
      </div>

      <form className="mc-form" onSubmit={handleSubmit}>
        {projects.length === 0 ? <p className="mc-liq-note">{t("merchant.widgets.payoutDesk.noProjects")}</p> : null}

        <div className="mc-form-grid mc-form-grid--2">
          <label className="mc-field">
            <span>{t("merchant.widgets.payoutDesk.project")}</span>
            <select
              aria-invalid={errors.project ? true : undefined}
              value={payoutForm.project_id}
              onChange={(event) => {
                onPayoutFormChange({ ...payoutForm, project_id: event.target.value });
                setErrors((current) => ({ ...current, project: undefined }));
              }}
            >
              <option value="">{t("common.selectProject")}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            {errors.project ? <small className="mc-liq-error">{errors.project}</small> : null}
          </label>

          <label className="mc-field">
            <span>{t("merchant.widgets.payoutDesk.amountUsdt")}</span>
            <div className="mc-liq-amount">
              <input
                aria-invalid={errors.amount ? true : undefined}
                inputMode="decimal"
                onChange={(event) => updateAmount(event.target.value)}
                placeholder="0.00"
                value={amountText}
              />
              <button
                className="ghost-button"
                disabled={availableUnits === null || availableUnits <= 0n}
                onClick={fillAvailable}
                type="button"
              >
                {t("merchant.widgets.payoutDesk.withdrawAll")}
              </button>
            </div>
            <small>
              {errors.amount ? (
                <span className="mc-liq-error">{errors.amount}</span>
              ) : (
                t("merchant.widgets.payoutDesk.amountHint", {
                  amount: formatDecimal(availableText),
                  currency,
                })
              )}
            </small>
          </label>
        </div>

        <label className="mc-field">
          <span>{t("merchant.widgets.payoutDesk.trc20Address")}</span>
          <input
            aria-invalid={errors.address ? true : undefined}
            autoComplete="off"
            onChange={(event) => {
              onPayoutFormChange({ ...payoutForm, destination_address: event.target.value });
              setErrors((current) => ({ ...current, address: undefined }));
            }}
            placeholder={t("merchant.widgets.payoutDesk.addressPlaceholder")}
            spellCheck={false}
            value={payoutForm.destination_address}
          />
          <small className={errors.address ? "mc-liq-error" : undefined}>
            {errors.address ?? t("merchant.widgets.payoutDesk.addressHint")}
          </small>
        </label>

        <label className="mc-field">
          <span>
            {t("merchant.widgets.payoutDesk.comment")}
            <em className="mc-liq-optional">{t("common.optional")}</em>
          </span>
          <input
            maxLength={500}
            onChange={(event) => onPayoutFormChange({ ...payoutForm, note: event.target.value })}
            placeholder={t("merchant.widgets.payoutDesk.commentPlaceholder")}
            value={payoutForm.note ?? ""}
          />
        </label>

        <div className="mc-form-actions">
          <button className="primary-button mc-liq-submit" disabled={loading || projects.length === 0} type="submit">
            {loading ? t("merchant.widgets.payoutDesk.submitSending") : t("merchant.widgets.payoutDesk.submitSend")}
          </button>
          <p className="mc-liq-network">{t("merchant.widgets.payoutDesk.networkLine")}</p>
        </div>
      </form>

      <section className="mc-liq-history" aria-label={t("merchant.widgets.payoutDesk.historyTitle")}>
        <div className="mc-liq-history-head">
          <h3>{t("merchant.widgets.payoutDesk.historyTitle")}</h3>
          <div className="mc-liq-filters">
            {filters.map((item) => (
              <button
                aria-pressed={filter === item.key}
                className={filter === item.key ? "mc-liq-filter is-active" : "mc-liq-filter"}
                key={item.key}
                onClick={() => setFilter(item.key)}
                type="button"
              >
                {item.label}
                <span>{counts[item.key]}</span>
              </button>
            ))}
          </div>
        </div>

        {visiblePayouts.length === 0 ? (
          <div className="mc-empty">
            {payouts.length === 0
              ? t("merchant.widgets.payoutDesk.emptyHistory")
              : t("merchant.widgets.payoutDesk.emptyFilter")}
          </div>
        ) : (
          <div className="mc-liq-list">
            {visiblePayouts.map((payout) => {
              const projectName =
                payout.project_name ??
                (payout.project_id ? projectNameById.get(payout.project_id) : null) ??
                t("common.projectNotSpecified");
              const approved =
                payout.amount_approved && payout.status === "processed" ? payout.amount_approved : null;
              return (
                <article className="mc-liq-item" key={payout.id}>
                  <div className="mc-liq-item-main">
                    <p className="mc-liq-item-amount">
                      {formatDecimal(payout.amount_requested)} {payout.currency}
                    </p>
                    <p className="mc-liq-item-meta">
                      <time dateTime={payout.created_at}>{formatWhen(payout.created_at, locale)}</time>
                      <span>{projectName}</span>
                      <span>{payout.network}</span>
                    </p>
                    <p className="mc-liq-addr">{payout.destination_address}</p>
                    {approved ? (
                      <p className="mc-liq-approved">
                        {t("merchant.widgets.payoutDesk.approvedLine", {
                          amount: formatDecimal(approved),
                          currency: payout.currency,
                        })}
                      </p>
                    ) : null}
                    {payout.review_comment ? (
                      <p className="mc-liq-comment">
                        {t("merchant.widgets.payoutDesk.comment")}: {payout.review_comment}
                      </p>
                    ) : null}
                  </div>
                  <div className="mc-liq-item-side">
                    <span className={`mc-badge ${statusBadgeClass(payout.status)}`}>
                      {statusLabel(payout.status, t)}
                    </span>
                    <button
                      className="ghost-button mc-liq-copy"
                      onClick={() => copyAddress(payout.id, payout.destination_address)}
                      type="button"
                    >
                      {copiedId === payout.id ? t("common.copied") : t("common.copyAddress")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </article>
  );
}

function statusLabel(status: string, t: (key: string) => string): string {
  if (status === "pending_review") return t("merchant.widgets.payoutDesk.statusPending");
  if (status === "processed") return t("merchant.widgets.payoutDesk.statusPaid");
  if (status === "rejected") return t("merchant.widgets.payoutDesk.statusRejected");
  return status;
}

function statusBadgeClass(status: string): string {
  if (status === "pending_review") return "mc-badge-warn";
  if (status === "processed") return "mc-badge-ok";
  if (status === "rejected") return "mc-badge-bad";
  return "mc-badge-neutral";
}

function formatWhen(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const tag = locale === "en" ? "en-GB" : locale === "ar" ? "ar" : "ru-RU";
  return new Intl.DateTimeFormat(tag, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function trimDecimal(value: string): string {
  const normalized = value.trim().replace(",", ".");
  if (!normalized.includes(".")) {
    return normalized;
  }
  return normalized.replace(/0+$/, "").replace(/\.$/, "");
}

function toUnits(value: string | number | null | undefined): bigint | null {
  const raw = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    return null;
  }
  const [whole, fraction = ""] = raw.split(".");
  const padded = `${fraction}00000000`.slice(0, 8);
  try {
    return BigInt(whole) * AMOUNT_SCALE + BigInt(padded);
  } catch {
    return null;
  }
}

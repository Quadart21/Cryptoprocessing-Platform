import { useEffect, useRef, useState } from "react";

import type { InvoiceDetail } from "../../api";
import { useTranslation } from "../../i18n";
import { formatDecimal } from "../../utils/format";
import { formatNetworkConfirmations } from "../../utils/networkConfirmations";
import { invoiceDetailBadgeClass } from "../../utils/invoiceStatus";
import { invoiceAccountingReady } from "../../utils/invoiceAccounting";

import { InvoiceSettlementBreakdown } from "./InvoiceSettlementBreakdown";
import { InvoiceTransactionDetailsCard } from "./InvoiceTransactionDetailsCard";

export type MerchantInvoiceInspectorProps = {
  invoice: InvoiceDetail | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
  onSync: (invoiceId: string) => void;
  canSyncInvoices: boolean;
};

const INVOICE_STATUS_KEYS = [
  "pending",
  "confirming",
  "paid",
  "confirmed",
  "expired",
  "cancelled",
  "failed",
  "aml_frozen",
] as const;

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

function formatDateTime(
  value: string | null | undefined,
  t: TranslateFn,
): string {
  if (!value) {
    return t("merchant.invoiceStatus.notSpecified");
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatCountdown(
  value: string | null | undefined,
  status: string,
  t: TranslateFn,
): string {
  if (!value) {
    return t("merchant.invoiceStatus.notSpecified");
  }
  if (status === "paid" || status === "confirmed" || status === "confirming") {
    if (status === "confirming") {
      return t("merchant.widgets.merchantInvoiceInspector.countdownConfirming");
    }
    return t("merchant.widgets.merchantInvoiceInspector.countdownPaid");
  }
  if (status === "failed") {
    return t("merchant.invoiceStatus.paymentIncomplete");
  }
  if (status === "expired") {
    return t("merchant.widgets.merchantInvoiceInspector.countdownExpired");
  }
  const expiresAt = new Date(value).getTime();
  if (Number.isNaN(expiresAt)) {
    return t("merchant.invoiceStatus.couldNotCalculate");
  }
  const diffMs = expiresAt - Date.now();
  if (diffMs <= 0) {
    return t("merchant.invoiceStatus.expiryExpired");
  }
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return t("merchant.widgets.merchantInvoiceInspector.countdownHours", {
      hours: String(hours),
      minutes: String(minutes).padStart(2, "0"),
      seconds: String(seconds).padStart(2, "0"),
    });
  }
  return t("merchant.widgets.merchantInvoiceInspector.countdownMinutes", {
    minutes: String(minutes),
    seconds: String(seconds).padStart(2, "0"),
  });
}

function invoiceStatusLabel(status: string, t: TranslateFn): string {
  const normalized = status.trim().toLowerCase();
  if (INVOICE_STATUS_KEYS.includes(normalized as (typeof INVOICE_STATUS_KEYS)[number])) {
    return t(`merchant.invoiceStatus.${normalized}`);
  }
  return status;
}

/** Нативный dialog: на мобильных ведёт себя как нижний лист (см. merchant-workspace.css). */
export function MerchantInvoiceInspector({
  invoice,
  isOpen,
  loading,
  onClose,
  onSync,
  canSyncInvoices,
}: MerchantInvoiceInspectorProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const [countdown, setCountdown] = useState("");
  const [showTechnical, setShowTechnical] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    if (isOpen && invoice) {
      if (typeof el.showModal === "function") {
        el.showModal();
      }
    } else {
      el.close();
    }
  }, [isOpen, invoice]);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const handleClose = () => {
      onClose();
    };
    el.addEventListener("close", handleClose);
    return () => el.removeEventListener("close", handleClose);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || !invoice) {
      return;
    }
    const tick = () => setCountdown(formatCountdown(invoice.expires_at, invoice.status, t));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [invoice, isOpen, t]);

  async function copyValue(value: string | null | undefined) {
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* empty */
    }
  }

  if (!invoice) {
    return <dialog className="mw-inspector-dialog" ref={ref} />;
  }

  const statusLabel = invoiceStatusLabel(invoice.status, t);
  const statusClassName = invoiceDetailBadgeClass(invoice.status);
  const confirmationProgress = formatNetworkConfirmations(
    invoice.network_confirmations_actual,
    invoice.network_confirmations_required,
  );
  const showAccounting = invoiceAccountingReady(invoice);

  return (
    <dialog className="mw-inspector-dialog invoice-modal" ref={ref}>
      <div className="mw-inspector-toolbar">
        <div>
          <p className="eyebrow">{t("merchant.widgets.merchantInvoiceInspector.eyebrow")}</p>
          <h2>{invoice.merchant_order_id}</h2>
        </div>
        <div className={`invoice-status-badge ${statusClassName}`}>{statusLabel}</div>
        <form method="dialog">
          <button
            className="mw-inspector-close"
            type="submit"
            aria-label={t("merchant.widgets.merchantInvoiceInspector.closeAria")}
          >
            ×
          </button>
        </form>
      </div>

      <p className="invoice-modal-subtitle">
        {invoice.payment_page_url
          ? t("merchant.widgets.merchantInvoiceInspector.subtitlePaymentPage")
          : invoice.payment_address
            ? t("merchant.widgets.merchantInvoiceInspector.subtitleAddress")
            : t("merchant.widgets.merchantInvoiceInspector.subtitlePending")}
        {invoice.payment_page_url && invoice.payment_address
          ? t("merchant.widgets.merchantInvoiceInspector.subtitleH2hNote")
          : null}
      </p>

      {invoice.payment_page_url ? (
        <div className="invoice-modal-card" style={{ marginBottom: "1rem" }}>
          <div className="invoice-modal-card-header">
            <div>
              <p className="eyebrow">{t("merchant.widgets.merchantInvoiceInspector.forClient")}</p>
              <h3>{t("merchant.widgets.merchantInvoiceInspector.paymentPage")}</h3>
            </div>
            <div className="action-row-inline">
              <a
                className="primary-button"
                href={invoice.payment_page_url}
                rel="noreferrer"
                target="_blank"
              >
                {t("common.open")}
              </a>
              <button
                className="ghost-button"
                onClick={() => void copyValue(invoice.payment_page_url)}
                type="button"
              >
                {t("common.copyLink")}
              </button>
            </div>
          </div>
          <code className="detail-tech-value">{invoice.payment_page_url}</code>
        </div>
      ) : null}

      <div className="invoice-modal-grid">
        <section className="invoice-modal-main">
          <div className="detail-summary detail-summary-compact">
            <div className="detail-chip">
              <span>{t("merchant.widgets.merchantInvoiceInspector.amountCrypto")}</span>
              <strong>
                {formatDecimal(invoice.amount_crypto)} {invoice.crypto_currency}
              </strong>
            </div>
            {showAccounting && invoice.settlement ? (
              <div className="detail-chip">
                <span>{t("merchant.widgets.merchantInvoiceInspector.settlementUsdt")}</span>
                <strong>
                  {formatDecimal(invoice.settlement.gross_amount)} {invoice.settlement.currency}
                </strong>
              </div>
            ) : null}
            <div className="detail-chip">
              <span>{t("merchant.widgets.invoiceIssuanceWizard.network")}</span>
              <strong>{invoice.network}</strong>
            </div>
            <div className="detail-chip">
              <span>{t("merchant.widgets.merchantInvoiceInspector.until")}</span>
              <strong>{formatDateTime(invoice.expires_at, t)}</strong>
            </div>
            <div className="detail-chip">
              <span>{t("merchant.widgets.merchantInvoiceInspector.timer")}</span>
              <strong>{countdown}</strong>
            </div>
            {confirmationProgress ? (
              <div className="detail-chip">
                <span>{t("merchant.widgets.merchantInvoiceInspector.confirmations")}</span>
                <strong>{confirmationProgress}</strong>
              </div>
            ) : null}
          </div>

          <InvoiceSettlementBreakdown
            exchangeRate={invoice.transaction_details?.exchange_rate}
            exchangeRateCurrency={invoice.transaction_details?.exchange_rate_currency}
            invoiceStatus={invoice.status}
            settlement={invoice.settlement}
          />

          {showAccounting && invoice.transaction_details ? (
            <InvoiceTransactionDetailsCard details={invoice.transaction_details} />
          ) : null}

          <div className="invoice-modal-card">
            <div className="invoice-modal-card-header">
              <div>
                <p className="eyebrow">{t("merchant.widgets.merchantInvoiceInspector.h2hApi")}</p>
                <h3>{t("merchant.widgets.merchantInvoiceInspector.technicalDetails")}</h3>
              </div>
              {invoice.payment_address ? (
                <button
                  className="ghost-button"
                  onClick={() => setShowTechnical((current) => !current)}
                  type="button"
                >
                  {showTechnical ? t("common.hide") : t("common.show")}
                </button>
              ) : null}
            </div>
            {!invoice.payment_address ? (
              <p className="muted-text">{t("merchant.widgets.merchantInvoiceInspector.noAddressPaymentPage")}</p>
            ) : showTechnical ? (
              <>
                <button
                  className="ghost-button"
                  onClick={() => void copyValue(invoice.payment_address)}
                  style={{ marginBottom: "0.5rem" }}
                  type="button"
                >
                  {t("common.copyAddress")}
                </button>
                <code className="detail-tech-value">{invoice.payment_address}</code>
                {invoice.payment_memo ? (
                  <>
                    <p className="muted-text" style={{ marginTop: "0.75rem" }}>
                      {t("common.memoRequired")}
                    </p>
                    <button
                      className="ghost-button"
                      onClick={() => void copyValue(invoice.payment_memo)}
                      style={{ marginBottom: "0.5rem" }}
                      type="button"
                    >
                      {t("common.copyMemo")}
                    </button>
                    <code className="detail-tech-value">{invoice.payment_memo}</code>
                  </>
                ) : null}
              </>
            ) : (
              <p className="muted-text">{t("merchant.widgets.merchantInvoiceInspector.addressHint")}</p>
            )}
          </div>

          {showTechnical ? (
            <div className="invoice-modal-card">
              <div className="invoice-modal-meta">
                <div>
                  <span>{t("merchant.widgets.merchantInvoiceInspector.provider")}</span>
                  <strong>{invoice.provider_order_id}</strong>
                </div>
                <button
                  className="ghost-button"
                  onClick={() => void copyValue(invoice.provider_order_id)}
                  type="button"
                >
                  {t("common.copy")}
                </button>
              </div>
              <div className="invoice-modal-meta">
                <div>
                  <span>{t("merchant.widgets.merchantInvoiceInspector.created")}</span>
                  <strong>{formatDateTime(invoice.created_at, t)}</strong>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="invoice-modal-side">
          <div className="invoice-modal-card invoice-modal-qr-card">
            <p className="eyebrow">{t("merchant.widgets.merchantInvoiceInspector.qr")}</p>
            <h3>{t("merchant.widgets.merchantInvoiceInspector.smartphone")}</h3>
            {invoice.qr_url ? (
              <>
                <img alt="" className="invoice-qr-image" src={invoice.qr_url} />
                <a className="ghost-button invoice-modal-link" href={invoice.qr_url} rel="noreferrer" target="_blank">
                  {t("common.open")}
                </a>
              </>
            ) : (
              <p className="muted-text">{t("merchant.widgets.merchantInvoiceInspector.noQr")}</p>
            )}
          </div>
          <div className="invoice-modal-card">
            <p className="eyebrow">{t("merchant.widgets.merchantInvoiceInspector.actions")}</p>
            <div className="action-row">
              {canSyncInvoices ? (
                <button className="primary-button" disabled={loading} onClick={() => onSync(invoice.id)} type="button">
                  {loading ? t("merchant.widgets.merchantInvoiceInspector.syncLoading") : t("common.sync")}
                </button>
              ) : (
                <p className="muted-text">{t("merchant.widgets.merchantInvoiceInspector.syncNeedPermission")}</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </dialog>
  );
}

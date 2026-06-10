import { useEffect, useLayoutEffect, useRef } from "react";

import type { InvoiceItem, InvoiceWebhookTestResponse } from "../../api";
import { useTranslation } from "../../i18n";

export type InvoiceWebhookTestDialogProps = {
  invoice: InvoiceItem | null;
  loading: boolean;
  lastResult: InvoiceWebhookTestResponse | null;
  errorMessage: string | null;
  /** Если false — кнопка отправки отключена, показывается submitBlockedReason */
  canSubmitTest: boolean;
  submitBlockedReason: string | null;
  onClose: () => void;
  onSend: () => void;
};

export function InvoiceWebhookTestDialog({
  invoice,
  loading,
  lastResult,
  errorMessage,
  canSubmitTest,
  submitBlockedReason,
  onClose,
  onSend,
}: InvoiceWebhookTestDialogProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    if (invoice) {
      if (!el.open) {
        try {
          el.showModal();
        } catch {
          /* уже открыт как модальный — игнорируем */
        }
      }
    } else if (el.open) {
      el.close();
    }
  }, [invoice]);

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

  return (
    <dialog className="mw-inspector-dialog mc-webhook-test-dialog" ref={ref}>
      {invoice ? (
        <div className="mc-webhook-test-inner">
          <header className="mc-webhook-test-header">
            <p className="mc-surface-eyebrow">{t("merchant.widgets.invoiceWebhookTestDialog.eyebrow")}</p>
            <h2 className="mc-webhook-test-title">{t("merchant.widgets.invoiceWebhookTestDialog.title")}</h2>
            <p className="mc-webhook-test-lede">
              {t("merchant.widgets.invoiceWebhookTestDialog.lede", { orderId: invoice.merchant_order_id })}
            </p>
          </header>

          {!canSubmitTest && submitBlockedReason ? (
            <div className="mc-webhook-test-result mc-webhook-test-result--warn" role="status">
              <strong>{t("common.sendingUnavailable")}</strong>
              <p className="mc-webhook-test-blocked-msg">{submitBlockedReason}</p>
            </div>
          ) : null}

          <div className="mc-webhook-test-actions">
            <button className="ghost-button" disabled={loading} onClick={() => ref.current?.close()} type="button">
              {t("common.close")}
            </button>
            <button
              className="primary-button"
              disabled={loading || !canSubmitTest}
              onClick={onSend}
              type="button"
            >
              {loading ? t("common.sending") : t("merchant.widgets.invoiceWebhookTestDialog.sendTest")}
            </button>
          </div>

          {errorMessage ? (
            <div className="mc-webhook-test-result mc-webhook-test-result--error" role="alert">
              <strong>{t("common.error")}</strong>
              <pre>{errorMessage}</pre>
            </div>
          ) : null}

          {lastResult ? (
            <div className={`mc-webhook-test-result ${lastResult.ok ? "" : "mc-webhook-test-result--warn"}`}>
              <div className="mc-webhook-test-kv">
                <span>{t("merchant.widgets.invoiceWebhookTestDialog.http")}</span>
                <strong>{lastResult.status_code}</strong>
              </div>
              <div className="mc-webhook-test-kv">
                <span>{t("common.attempts")}</span>
                <strong>{lastResult.attempts}</strong>
              </div>
              <div className="mc-webhook-test-kv">
                <span>{t("merchant.widgets.invoiceWebhookTestDialog.eventId")}</span>
                <code className="mc-inline-code">{lastResult.event_id}</code>
              </div>
              <div className="mc-webhook-test-kv mc-webhook-test-kv--full">
                <span>{t("common.serverResponse")}</span>
                <pre>{lastResult.response_preview ?? t("common.dash")}</pre>
              </div>
              {lastResult.error ? (
                <div className="mc-webhook-test-kv mc-webhook-test-kv--full">
                  <span>{t("common.transport")}</span>
                  <pre>{lastResult.error}</pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

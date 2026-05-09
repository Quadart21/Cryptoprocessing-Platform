import { useEffect, useLayoutEffect, useRef } from "react";

import type { InvoiceItem, InvoiceWebhookTestResponse } from "../../api";

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
            <p className="mc-surface-eyebrow">Тест webhook</p>
            <h2 className="mc-webhook-test-title">Уведомление о пополнении (симуляция)</h2>
            <p className="mc-webhook-test-lede">
              Отправка на URL проекта из настроек webhook. Тело запроса содержит актуальные данные инвойса{" "}
              <strong>{invoice.merchant_order_id}</strong>; статус инвойса в платформе{" "}
              <strong>не меняется</strong>. Событие: <code className="mc-inline-code">invoice.test_deposit</code>, поле{" "}
              <code className="mc-inline-code">simulated: true</code>.
            </p>
          </header>

          {!canSubmitTest && submitBlockedReason ? (
            <div className="mc-webhook-test-result mc-webhook-test-result--warn" role="status">
              <strong>Отправка недоступна</strong>
              <p className="mc-webhook-test-blocked-msg">{submitBlockedReason}</p>
            </div>
          ) : null}

          <div className="mc-webhook-test-actions">
            <button className="ghost-button" disabled={loading} onClick={() => ref.current?.close()} type="button">
              Закрыть
            </button>
            <button
              className="primary-button"
              disabled={loading || !canSubmitTest}
              onClick={onSend}
              type="button"
            >
              {loading ? "Отправка…" : "Отправить тестовый webhook"}
            </button>
          </div>

          {errorMessage ? (
            <div className="mc-webhook-test-result mc-webhook-test-result--error" role="alert">
              <strong>Ошибка</strong>
              <pre>{errorMessage}</pre>
            </div>
          ) : null}

          {lastResult ? (
            <div className={`mc-webhook-test-result ${lastResult.ok ? "" : "mc-webhook-test-result--warn"}`}>
              <div className="mc-webhook-test-kv">
                <span>HTTP</span>
                <strong>{lastResult.status_code}</strong>
              </div>
              <div className="mc-webhook-test-kv">
                <span>Попыток</span>
                <strong>{lastResult.attempts}</strong>
              </div>
              <div className="mc-webhook-test-kv">
                <span>event_id</span>
                <code className="mc-inline-code">{lastResult.event_id}</code>
              </div>
              <div className="mc-webhook-test-kv mc-webhook-test-kv--full">
                <span>Ответ вашего сервера</span>
                <pre>{lastResult.response_preview ?? "—"}</pre>
              </div>
              {lastResult.error ? (
                <div className="mc-webhook-test-kv mc-webhook-test-kv--full">
                  <span>Транспорт / после повторов</span>
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

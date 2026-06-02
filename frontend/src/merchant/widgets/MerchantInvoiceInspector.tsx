import { useEffect, useRef, useState } from "react";

import type { InvoiceDetail } from "../../api";
import { formatDecimal } from "../../utils/format";
import { formatNetworkConfirmations } from "../../utils/networkConfirmations";
import { getInvoiceDetailStatusMeta } from "../../utils/invoiceStatus";

import { InvoiceSettlementBreakdown } from "./InvoiceSettlementBreakdown";

export type MerchantInvoiceInspectorProps = {
  invoice: InvoiceDetail | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
  onSync: (invoiceId: string) => void;
  canSyncInvoices: boolean;
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Не указано";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatCountdown(value: string | null | undefined, status: string): string {
  if (!value) {
    return "Не указано";
  }
  if (status === "paid" || status === "confirmed") {
    return "Оплачен";
  }
  if (status === "confirming") {
    return "Подтверждение в сети";
  }
  if (status === "failed") {
    return "Платеж не завершен";
  }
  if (status === "expired") {
    return "Срок истёк";
  }
  const expiresAt = new Date(value).getTime();
  if (Number.isNaN(expiresAt)) {
    return "Не удалось рассчитать";
  }
  const diffMs = expiresAt - Date.now();
  if (diffMs <= 0) {
    return "Срок действия истек";
  }
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}ч ${String(minutes).padStart(2, "0")}м ${String(seconds).padStart(2, "0")}с`;
  }
  return `${minutes}м ${String(seconds).padStart(2, "0")}с`;
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
    const tick = () => setCountdown(formatCountdown(invoice.expires_at, invoice.status));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [invoice, isOpen]);

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

  const statusMeta = getInvoiceDetailStatusMeta(invoice.status);
  const confirmationProgress = formatNetworkConfirmations(
    invoice.network_confirmations_actual,
    invoice.network_confirmations_required,
  );

  return (
    <dialog className="mw-inspector-dialog invoice-modal" ref={ref}>
      <div className="mw-inspector-toolbar">
        <div>
          <p className="eyebrow">Инспектор инвойса</p>
          <h2>{invoice.merchant_order_id}</h2>
        </div>
        <div className={`invoice-status-badge ${statusMeta.className}`}>{statusMeta.label}</div>
        <form method="dialog">
          <button className="mw-inspector-close" type="submit" aria-label="Закрыть">
            ×
          </button>
        </form>
      </div>

      <p className="invoice-modal-subtitle">
        {invoice.payment_page_url
          ? "Отправьте клиенту ссылку на страницу оплаты."
          : invoice.payment_address
            ? "Передайте клиенту адрес или QR для оплаты."
            : "Реквизиты появятся после создания инвойса."}
        {invoice.payment_page_url && invoice.payment_address
          ? " H2H-реквизиты доступны ниже для прямых интеграций."
          : null}
      </p>

      {invoice.payment_page_url ? (
        <div className="invoice-modal-card" style={{ marginBottom: "1rem" }}>
          <div className="invoice-modal-card-header">
            <div>
              <p className="eyebrow">Для клиента</p>
              <h3>Страница оплаты</h3>
            </div>
            <div className="action-row-inline">
              <a
                className="primary-button"
                href={invoice.payment_page_url}
                rel="noreferrer"
                target="_blank"
              >
                Открыть
              </a>
              <button
                className="ghost-button"
                onClick={() => void copyValue(invoice.payment_page_url)}
                type="button"
              >
                Копировать ссылку
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
              <span>Сумма в токене</span>
              <strong>
                {formatDecimal(invoice.amount_crypto)} {invoice.crypto_currency}
              </strong>
            </div>
            <div className="detail-chip">
              <span>Учёт</span>
              <strong>
                {formatDecimal(invoice.amount_fiat)} {invoice.fiat_currency}
              </strong>
            </div>
            <div className="detail-chip">
              <span>Сеть</span>
              <strong>{invoice.network}</strong>
            </div>
            <div className="detail-chip">
              <span>До</span>
              <strong>{formatDateTime(invoice.expires_at)}</strong>
            </div>
            <div className="detail-chip">
              <span>Таймер</span>
              <strong>{countdown}</strong>
            </div>
            {confirmationProgress ? (
              <div className="detail-chip">
                <span>Подтверждения</span>
                <strong>{confirmationProgress}</strong>
              </div>
            ) : null}
          </div>

          <InvoiceSettlementBreakdown
            fallbackAmountCrypto={invoice.amount_crypto}
            fallbackCryptoCurrency={invoice.crypto_currency}
            fallbackCurrency={invoice.fiat_currency}
            invoiceStatus={invoice.status}
            settlement={invoice.settlement}
          />

          <div className="invoice-modal-card">
            <div className="invoice-modal-card-header">
              <div>
                <p className="eyebrow">H2H / API</p>
                <h3>Технические реквизиты</h3>
              </div>
              {invoice.payment_address ? (
                <button
                  className="ghost-button"
                  onClick={() => setShowTechnical((current) => !current)}
                  type="button"
                >
                  {showTechnical ? "Скрыть" : "Показать"}
                </button>
              ) : null}
            </div>
            {!invoice.payment_address ? (
              <p className="muted-text">
                Адрес не включён в ответ — для проекта выбран режим payment page. Откройте checkout-ссылку выше.
              </p>
            ) : showTechnical ? (
              <>
                <button
                  className="ghost-button"
                  onClick={() => void copyValue(invoice.payment_address)}
                  style={{ marginBottom: "0.5rem" }}
                  type="button"
                >
                  Копировать адрес
                </button>
                <code className="detail-tech-value">{invoice.payment_address}</code>
              </>
            ) : (
              <p className="muted-text">Адрес и provider ID — для прямых интеграций без checkout-страницы.</p>
            )}
          </div>

          {showTechnical ? (
          <div className="invoice-modal-card">
            <div className="invoice-modal-meta">
              <div>
                <span>Provider</span>
                <strong>{invoice.provider_order_id}</strong>
              </div>
              <button className="ghost-button" onClick={() => void copyValue(invoice.provider_order_id)} type="button">
                Копировать
              </button>
            </div>
            <div className="invoice-modal-meta">
              <div>
                <span>Создан</span>
                <strong>{formatDateTime(invoice.created_at)}</strong>
              </div>
            </div>
          </div>
          ) : null}
        </section>

        <aside className="invoice-modal-side">
          <div className="invoice-modal-card invoice-modal-qr-card">
            <p className="eyebrow">QR</p>
            <h3>Смартфон</h3>
            {invoice.qr_url ? (
              <>
                <img alt="" className="invoice-qr-image" src={invoice.qr_url} />
                <a className="ghost-button invoice-modal-link" href={invoice.qr_url} rel="noreferrer" target="_blank">
                  Открыть
                </a>
              </>
            ) : (
              <p className="muted-text">QR не выдан провайдером.</p>
            )}
          </div>
          <div className="invoice-modal-card">
            <p className="eyebrow">Действия</p>
            <div className="action-row">
              {canSyncInvoices ? (
                <button className="primary-button" disabled={loading} onClick={() => onSync(invoice.id)} type="button">
                  {loading ? "…" : "Синхронизировать"}
                </button>
              ) : (
                <p className="muted-text">Нужно право client.invoices.write.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </dialog>
  );
}

import { useEffect, useState } from "react";

import type { InvoiceDetail } from "../../api";
import { InvoiceTransactionDetailsCard } from "../../merchant/widgets/InvoiceTransactionDetailsCard";
import { formatDecimal } from "../../utils/format";
import { formatNetworkConfirmations } from "../../utils/networkConfirmations";
import { getInvoiceDetailStatusMeta } from "../../utils/invoiceStatus";

type InvoiceDetailModalProps = {
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

export function InvoiceDetailModal({
  invoice,
  isOpen,
  loading,
  onClose,
  onSync,
  canSyncInvoices,
}: InvoiceDetailModalProps) {
  const [countdown, setCountdown] = useState(() =>
    formatCountdown(invoice?.expires_at, invoice?.status ?? ""),
  );

  useEffect(() => {
    if (!isOpen || !invoice) {
      return;
    }

    const updateCountdown = () => {
      setCountdown(formatCountdown(invoice.expires_at, invoice.status));
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [invoice, isOpen]);

  async function copyValue(value: string | null | undefined) {
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // silent fail
    }
  }

  if (!isOpen || !invoice) {
    return null;
  }

  const statusMeta = getInvoiceDetailStatusMeta(invoice.status);
  const confirmationProgress = formatNetworkConfirmations(
    invoice.network_confirmations_actual,
    invoice.network_confirmations_required,
  );

  return (
    <div className="nc-modal-overlay" onClick={onClose}>
      <div className="nc-modal invoice-modal mc-invoice-modal" onClick={(event) => event.stopPropagation()}>
        <button className="nc-modal-close" onClick={onClose} type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="invoice-modal-header">
          <div>
            <p className="eyebrow">Инвойс</p>
            <h2>{invoice.merchant_order_id}</h2>
            <p className="invoice-modal-subtitle">
              Полные реквизиты для оплаты и контроля статуса платежа.
            </p>
          </div>
          <div className={`invoice-status-badge ${statusMeta.className}`}>{statusMeta.label}</div>
        </div>

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
                <span>Учетная сумма в системе</span>
                <strong>
                  {formatDecimal(invoice.amount_fiat)} {invoice.fiat_currency}
                </strong>
              </div>
              <div className="detail-chip">
                <span>Сеть</span>
                <strong>{invoice.network}</strong>
              </div>
              <div className="detail-chip">
                <span>Действителен до</span>
                <strong>{formatDateTime(invoice.expires_at)}</strong>
              </div>
              <div className="detail-chip">
                <span>Обратный отсчет</span>
                <strong>{countdown}</strong>
              </div>
              {confirmationProgress ? (
                <div className="detail-chip">
                  <span>Подтверждения сети</span>
                  <strong>{confirmationProgress}</strong>
                </div>
              ) : null}
            </div>

            {invoice.transaction_details ? (
              <InvoiceTransactionDetailsCard details={invoice.transaction_details} />
            ) : null}

            <div className="invoice-modal-card">
              <div className="invoice-modal-card-header">
                <div>
                  <p className="eyebrow">Реквизиты</p>
                  <h3>Адрес оплаты</h3>
                </div>
                <button className="ghost-button" onClick={() => void copyValue(invoice.payment_address)} type="button">
                  Копировать адрес
                </button>
              </div>
              <code className="detail-tech-value">{invoice.payment_address}</code>
            </div>

            <div className="invoice-modal-card">
              <div className="invoice-modal-meta">
                <div>
                  <span>Order ID</span>
                  <strong>{invoice.merchant_order_id}</strong>
                </div>
                <button className="ghost-button" onClick={() => void copyValue(invoice.merchant_order_id)} type="button">
                  Копировать
                </button>
              </div>
              <div className="invoice-modal-meta">
                <div>
                  <span>Provider order</span>
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
          </section>

          <aside className="invoice-modal-side">
            <div className="invoice-modal-card invoice-modal-qr-card">
              <div>
                <p className="eyebrow">QR</p>
                <h3>Оплата со смартфона</h3>
              </div>
              {invoice.qr_url ? (
                <>
                  <img alt={`QR для инвойса ${invoice.merchant_order_id}`} className="invoice-qr-image" src={invoice.qr_url} />
                  <a className="ghost-button invoice-modal-link" href={invoice.qr_url} rel="noreferrer" target="_blank">
                    Открыть QR
                  </a>
                </>
              ) : (
                <p className="muted-text">QR-код провайдер не вернул. Используйте адрес оплаты вручную.</p>
              )}
            </div>

            <div className="invoice-modal-card">
              <p className="eyebrow">Действия</p>
              <div className="action-row">
                {canSyncInvoices ? (
                  <button className="primary-button" disabled={loading} onClick={() => onSync(invoice.id)} type="button">
                    {loading ? "Синхронизация..." : "Синхронизировать статус"}
                  </button>
                ) : (
                  <p className="muted-text">Синхронизация доступна при праве client.invoices.write.</p>
                )}
                <button className="ghost-button" onClick={onClose} type="button">
                  Закрыть
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

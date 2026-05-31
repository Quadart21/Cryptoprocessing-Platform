import { useCallback, useEffect, useMemo, useState } from "react";

import { formatDecimal } from "../utils/format";
import { getInvoiceDetailStatusMeta, invoiceStatusTone } from "../utils/invoiceStatus";
import {
  fetchPublicPayment,
  refreshPublicPayment,
  type PublicPayment,
} from "./publicPayApi";

type PayPageRootProps = {
  token: string;
};

function formatCountdown(expiresAt: string): string {
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) {
    return "—";
  }
  const diffMs = target - Date.now();
  if (diffMs <= 0) {
    return "00:00";
  }
  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function isAwaitingPayment(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === "pending" || normalized === "paid";
}

function isSuccessStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === "paid" || normalized === "confirmed";
}

function buildQrSrc(payment: PublicPayment): string | null {
  if (payment.qr_url) {
    return payment.qr_url;
  }
  const data = encodeURIComponent(payment.payment_address);
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${data}`;
}

export function PayPageRoot({ token }: PayPageRootProps) {
  const [payment, setPayment] = useState<PublicPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);
  const [countdown, setCountdown] = useState("—");

  const loadPayment = useCallback(async (withRefresh: boolean) => {
    try {
      setError(null);
      const next = withRefresh ? await refreshPublicPayment(token) : await fetchPublicPayment(token);
      setPayment(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить платёж.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadPayment(false);
  }, [loadPayment]);

  useEffect(() => {
    if (!payment) {
      return;
    }
    setCountdown(formatCountdown(payment.expires_at));
    const timer = window.setInterval(() => {
      setCountdown(formatCountdown(payment.expires_at));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [payment]);

  useEffect(() => {
    if (!payment || !isAwaitingPayment(payment.status)) {
      return;
    }
    const timer = window.setInterval(() => {
      void loadPayment(true);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [payment, loadPayment]);

  const statusMeta = useMemo(
    () => (payment ? getInvoiceDetailStatusMeta(payment.status) : null),
    [payment],
  );

  const qrSrc = payment ? buildQrSrc(payment) : null;
  const tone = payment ? invoiceStatusTone(payment.status) : "warning";

  async function copyValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="pp-page">
      <div className="pp-glow pp-glow--left" aria-hidden />
      <div className="pp-glow pp-glow--right" aria-hidden />

      <main className="pp-shell">
        <header className="pp-header">
          <div className="pp-brand">
            <span className="pp-brand-mark" aria-hidden />
            <div>
              <p className="pp-brand-eyebrow">Безопасная оплата</p>
              <h1 className="pp-brand-title">
                Noren<span>Cash</span>
              </h1>
            </div>
          </div>
          {statusMeta ? (
            <span className={`pp-status pp-status--${tone}`}>{statusMeta.label}</span>
          ) : null}
        </header>

        {loading ? (
          <section className="pp-card pp-card--center">
            <p className="pp-muted">Загружаем данные платежа…</p>
          </section>
        ) : null}

        {!loading && error ? (
          <section className="pp-card pp-card--center">
            <h2 className="pp-title">Платёж недоступен</h2>
            <p className="pp-muted">{error}</p>
          </section>
        ) : null}

        {!loading && payment && !error ? (
          <>
            <section className="pp-hero">
              <p className="pp-hero-eyebrow">К оплате</p>
              <div className="pp-hero-amount">
                <strong>
                  {formatDecimal(payment.amount_crypto)} {payment.crypto_currency}
                </strong>
                <span>
                  ≈ {formatDecimal(payment.amount_fiat)} {payment.fiat_currency}
                </span>
              </div>
              <div className="pp-hero-meta">
                <span className="pp-chip">{payment.network}</span>
                <span className="pp-chip">Заказ {payment.merchant_order_id}</span>
                {!isSuccessStatus(payment.status) ? (
                  <span className="pp-chip pp-chip--timer">Осталось {countdown}</span>
                ) : null}
              </div>
            </section>

            {isSuccessStatus(payment.status) ? (
              <section className="pp-card pp-success">
                <div className="pp-success-icon" aria-hidden>
                  ✓
                </div>
                <h2 className="pp-title">Оплата получена</h2>
                <p className="pp-muted">
                  Статус обновится у продавца автоматически. Эту страницу можно закрыть.
                </p>
              </section>
            ) : payment.status === "expired" || payment.status === "failed" ? (
              <section className="pp-card pp-card--center">
                <h2 className="pp-title">
                  {payment.status === "expired" ? "Время оплаты истекло" : "Платёж не выполнен"}
                </h2>
                <p className="pp-muted">Запросите новую ссылку у продавца.</p>
              </section>
            ) : (
              <section className="pp-grid">
                <article className="pp-card pp-card--qr">
                  <p className="pp-card-eyebrow">Сканируйте QR-код</p>
                  <h2 className="pp-title">Оплата с телефона</h2>
                  {qrSrc ? (
                    <div className="pp-qr-frame">
                      <img alt="QR-код для оплаты" className="pp-qr-image" src={qrSrc} />
                    </div>
                  ) : null}
                  <p className="pp-muted pp-qr-hint">
                    Откройте криптокошелёк, отсканируйте код и отправьте точную сумму в сети{" "}
                    {payment.network}.
                  </p>
                </article>

                <article className="pp-card pp-card--steps">
                  <p className="pp-card-eyebrow">Инструкция</p>
                  <h2 className="pp-title">Как оплатить</h2>
                  <ol className="pp-steps">
                    <li>Откройте приложение кошелька с {payment.crypto_currency}.</li>
                    <li>Выберите сеть {payment.network}.</li>
                    <li>
                      Отправьте ровно{" "}
                      <strong>
                        {formatDecimal(payment.amount_crypto)} {payment.crypto_currency}
                      </strong>
                      .
                    </li>
                    <li>Дождитесь подтверждения — статус обновится на этой странице.</li>
                  </ol>
                  <button
                    className="pp-button pp-button--ghost"
                    onClick={() => setShowTechnical((current) => !current)}
                    type="button"
                  >
                    {showTechnical ? "Скрыть адрес" : "Показать адрес для ручного ввода"}
                  </button>
                  {showTechnical ? (
                    <div className="pp-address-box">
                      <code>{payment.payment_address}</code>
                      <button
                        className="pp-button pp-button--primary"
                        onClick={() => void copyValue("address", payment.payment_address)}
                        type="button"
                      >
                        {copied === "address" ? "Скопировано" : "Копировать адрес"}
                      </button>
                    </div>
                  ) : null}
                </article>
              </section>
            )}
          </>
        ) : null}

        <footer className="pp-footer">
          <p>Защищённое соединение · Криптоплатёж через NorenCash</p>
        </footer>
      </main>
    </div>
  );
}

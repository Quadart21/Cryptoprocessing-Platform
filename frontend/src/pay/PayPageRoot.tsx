import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

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

const REDIRECT_DELAY_SEC = 6;

function formatCountdown(expiresAt: string): { label: string; progress: number } {
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) {
    return { label: "—", progress: 0 };
  }
  const diffMs = target - Date.now();
  if (diffMs <= 0) {
    return { label: "00:00", progress: 0 };
  }
  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const label = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const progress = Math.min(1, diffMs / (30 * 60 * 1000));
  return { label, progress };
}

function isAwaitingPayment(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === "pending" || normalized === "paid";
}

function isSuccessStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === "paid" || normalized === "confirmed";
}

function isFailedStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === "failed" || normalized === "expired";
}

function buildQrSrc(payment: PublicPayment): string | null {
  if (payment.qr_url) {
    return payment.qr_url;
  }
  if (!payment.payment_address) {
    return null;
  }
  const data = encodeURIComponent(payment.payment_address);
  return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${data}`;
}

type ReturnBannerProps = {
  href: string;
  tone: "success" | "failed";
  autoRedirect?: boolean;
};

function ReturnToShopBanner({ href, tone, autoRedirect = false }: ReturnBannerProps) {
  const [secondsLeft, setSecondsLeft] = useState(autoRedirect ? REDIRECT_DELAY_SEC : 0);
  const [redirectCancelled, setRedirectCancelled] = useState(false);

  useEffect(() => {
    if (!autoRedirect || redirectCancelled) {
      return;
    }
    setSecondsLeft(REDIRECT_DELAY_SEC);
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          window.location.assign(href);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [autoRedirect, href, redirectCancelled]);

  return (
    <div className={`pp-return pp-return--${tone}`}>
      <a className="pp-button pp-button--return" href={href} rel="noopener noreferrer">
        Вернуться в магазин
      </a>
      {autoRedirect && !redirectCancelled && secondsLeft > 0 ? (
        <p className="pp-return-hint">
          Автопереход через {secondsLeft} сек.{" "}
          <button className="pp-link-button" onClick={() => setRedirectCancelled(true)} type="button">
            Остаться на странице
          </button>
        </p>
      ) : null}
    </div>
  );
}

export function PayPageRoot({ token }: PayPageRootProps) {
  const [payment, setPayment] = useState<PublicPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showAddress, setShowAddress] = useState(false);
  const [countdown, setCountdown] = useState({ label: "—", progress: 0 });

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
    const tick = () => setCountdown(formatCountdown(payment.expires_at));
    tick();
    const timer = window.setInterval(tick, 1000);
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
  const amountLine = payment
    ? `${formatDecimal(payment.amount_crypto)} ${payment.crypto_currency}`
    : "";

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
      <div className="pp-aurora pp-aurora--one" aria-hidden />
      <div className="pp-aurora pp-aurora--two" aria-hidden />
      <div className="pp-grid-bg" aria-hidden />

      <main className="pp-shell">
        <header className="pp-topbar">
          <div className="pp-brand">
            <span className="pp-brand-gem" aria-hidden />
            <div>
              <p className="pp-eyebrow">Secure checkout</p>
              <h1 className="pp-brand-title">
                Noren<span>Cash</span>
              </h1>
            </div>
          </div>
          {payment?.merchant_name ? (
            <p className="pp-merchant">{payment.merchant_name}</p>
          ) : null}
          {statusMeta ? (
            <span className={`pp-pill pp-pill--${tone}`}>{statusMeta.label}</span>
          ) : null}
        </header>

        {loading ? (
          <section className="pp-card pp-card--state">
            <div className="pp-spinner" aria-hidden />
            <p className="pp-muted">Подготавливаем платёж…</p>
          </section>
        ) : null}

        {!loading && error ? (
          <section className="pp-card pp-card--state">
            <h2 className="pp-title">Платёж недоступен</h2>
            <p className="pp-muted">{error}</p>
          </section>
        ) : null}

        {!loading && payment && !error ? (
          <div className="pp-layout">
            <section className="pp-card pp-card--summary">
              <p className="pp-eyebrow pp-eyebrow--gold">Сумма к оплате</p>
              <div className="pp-amount-block">
                <strong className="pp-amount">{amountLine}</strong>
                <span className="pp-amount-fiat">
                  ≈ {formatDecimal(payment.amount_fiat)} {payment.fiat_currency}
                </span>
              </div>

              <div className="pp-meta-row">
                <span className="pp-tag">{payment.network}</span>
                <span className="pp-tag">Заказ {payment.merchant_order_id}</span>
              </div>

              {!isSuccessStatus(payment.status) && !isFailedStatus(payment.status) ? (
                <div className="pp-timer">
                  <div
                    className="pp-timer-ring"
                    style={{ "--pp-progress": String(countdown.progress) } as CSSProperties}
                    aria-hidden
                  >
                    <span>{countdown.label}</span>
                  </div>
                  <div>
                    <p className="pp-timer-label">Время на оплату</p>
                    <p className="pp-muted">Статус обновится автоматически</p>
                  </div>
                </div>
              ) : null}

              {isSuccessStatus(payment.status) ? (
                <div className="pp-terminal pp-terminal--success">
                  <div className="pp-terminal-icon" aria-hidden>
                    ✓
                  </div>
                  <h2 className="pp-title">Оплата получена</h2>
                  <p className="pp-muted">
                    Средства зафиксированы. Продавец получит уведомление — можете закрыть эту вкладку.
                  </p>
                  {payment.return_url_success ? (
                    <ReturnToShopBanner
                      autoRedirect
                      href={payment.return_url_success}
                      tone="success"
                    />
                  ) : null}
                </div>
              ) : null}

              {isFailedStatus(payment.status) ? (
                <div className="pp-terminal pp-terminal--failed">
                  <div className="pp-terminal-icon pp-terminal-icon--failed" aria-hidden>
                    !
                  </div>
                  <h2 className="pp-title">
                    {payment.status === "expired" ? "Время оплаты истекло" : "Платёж не выполнен"}
                  </h2>
                  <p className="pp-muted">Запросите новую ссылку у продавца или вернитесь в магазин.</p>
                  {payment.return_url_failed ? (
                    <ReturnToShopBanner href={payment.return_url_failed} tone="failed" />
                  ) : null}
                </div>
              ) : null}
            </section>

            {!isSuccessStatus(payment.status) && !isFailedStatus(payment.status) ? (
              <section className="pp-card pp-card--pay">
                <div className="pp-pay-head">
                  <div>
                    <p className="pp-eyebrow">Быстрая оплата</p>
                    <h2 className="pp-title">Отсканируйте QR</h2>
                  </div>
                  <button
                    className="pp-button pp-button--ghost"
                    onClick={() => void copyValue("amount", payment.amount_crypto)}
                    type="button"
                  >
                    {copied === "amount" ? "Скопировано" : "Копировать сумму"}
                  </button>
                </div>

                {qrSrc ? (
                  <div className="pp-qr-stage">
                    <div className="pp-qr-glow" aria-hidden />
                    <div className="pp-qr-frame">
                      <img alt="QR-код для оплаты" className="pp-qr-image" src={qrSrc} />
                    </div>
                  </div>
                ) : null}

                <ol className="pp-steps">
                  <li>Откройте кошелёк с {payment.crypto_currency}.</li>
                  <li>Выберите сеть {payment.network}.</li>
                  <li>
                    Отправьте <strong>{amountLine}</strong> без округления.
                  </li>
                </ol>

                <button
                  className="pp-button pp-button--ghost pp-button--full"
                  onClick={() => setShowAddress((current) => !current)}
                  type="button"
                >
                  {showAddress ? "Скрыть адрес" : "Оплата вручную по адресу"}
                </button>

                {showAddress ? (
                  <div className="pp-address-panel">
                    <code>{payment.payment_address}</code>
                    <button
                      className="pp-button pp-button--primary"
                      onClick={() => void copyValue("address", payment.payment_address)}
                      type="button"
                    >
                      {copied === "address" ? "Адрес скопирован" : "Копировать адрес"}
                    </button>
                  </div>
                ) : null}

                <button
                  className="pp-button pp-button--soft pp-button--full"
                  onClick={() => void loadPayment(true)}
                  type="button"
                >
                  Обновить статус
                </button>
              </section>
            ) : null}
          </div>
        ) : null}

        <footer className="pp-footer">
          <p>256-bit TLS · Криптоплатёж NorenCash</p>
        </footer>
      </main>
    </div>
  );
}

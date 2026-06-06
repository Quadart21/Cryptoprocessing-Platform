import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { formatDecimal } from "../utils/format";
import { getInvoiceDetailStatusMeta, invoiceStatusTone } from "../utils/invoiceStatus";
import { isStableCoinFiatPair } from "../utils/invoiceAccounting";
import { PaymentConfirmationsProgress } from "./PaymentConfirmationsProgress";
import {
  fetchPublicPayment,
  isRateLimitedPaymentError,
  refreshPublicPayment,
  type PublicPayment,
} from "./publicPayApi";

type PayPageRootProps = {
  token: string;
};

const REDIRECT_DELAY_SEC = 6;
/** GET ?sync=1 — синхронизация с провайдером без CORS preflight (POST /refresh устарел). */
const POLL_PENDING_REFRESH_MS = 30_000;
/** GET — только чтение статуса после оплаты (paid → confirmed). */
const POLL_PAID_READ_MS = 20_000;

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
  const progress = Math.min(1, diffMs / (60 * 60 * 1000));
  return { label, progress };
}

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase();
}

function shouldPollPaymentStatus(status: string): boolean {
  const normalized = normalizeStatus(status);
  return normalized === "pending" || normalized === "confirming" || normalized === "paid";
}

function isConfirmingStatus(status: string): boolean {
  return normalizeStatus(status) === "confirming";
}

function isSuccessStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === "paid" || normalized === "confirmed";
}

function isFailedStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === "failed" || normalized === "expired" || normalized === "cancelled";
}

function chunkAddress(address: string, size = 8): string[] {
  const normalized = address.trim();
  if (!normalized) {
    return [];
  }
  const parts: string[] = [];
  for (let index = 0; index < normalized.length; index += size) {
    parts.push(normalized.slice(index, index + size));
  }
  return parts;
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

type PaymentDepositAddressProps = {
  address: string;
  cryptoCurrency: string;
  network: string;
  copied: boolean;
  onCopy: () => void;
};

function PaymentDepositAddress({
  address,
  cryptoCurrency,
  network,
  copied,
  onCopy,
}: PaymentDepositAddressProps) {
  const chunks = chunkAddress(address);

  return (
    <section className="pp-deposit" aria-labelledby="pp-deposit-title">
      <div className="pp-deposit-header">
        <div className="pp-deposit-heading">
          <span className="pp-deposit-icon" aria-hidden>
            <svg fill="none" height="18" viewBox="0 0 24 24" width="18">
              <path
                d="M12 3v12m0 0l4-4m-4 4L8 11M5 21h14"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.75"
              />
            </svg>
          </span>
          <div>
            <h3 className="pp-deposit-title" id="pp-deposit-title">
              Адрес для перевода
            </h3>
            <p className="pp-deposit-sub">
              {cryptoCurrency} · сеть {network}
            </p>
          </div>
        </div>
        <button
          className={`pp-deposit-copy${copied ? " pp-deposit-copy--done" : ""}`}
          onClick={onCopy}
          type="button"
        >
          {copied ? (
            <>
              <span className="pp-deposit-copy-icon" aria-hidden>
                ✓
              </span>
              Скопировано
            </>
          ) : (
            <>
              <span className="pp-deposit-copy-icon" aria-hidden>
                ⧉
              </span>
              Копировать
            </>
          )}
        </button>
      </div>

      <div className="pp-deposit-field">
        <p className="pp-deposit-chunks" translate="no">
          {chunks.map((part, index) => (
            <span className="pp-deposit-chunk" key={`${index}-${part}`}>
              {part}
            </span>
          ))}
        </p>
      </div>

      <p className="pp-deposit-note">
        Отправляйте только <strong>{cryptoCurrency}</strong> в сети <strong>{network}</strong>. Другая
        монета или сеть могут привести к потере средств.
      </p>
    </section>
  );
}

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
  const [pollHint, setPollHint] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [countdown, setCountdown] = useState({ label: "—", progress: 0 });
  const paymentRef = useRef<PublicPayment | null>(null);
  const pollPausedUntilRef = useRef(0);

  paymentRef.current = payment;

  const loadPayment = useCallback(
    async (withRefresh: boolean, options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (Date.now() < pollPausedUntilRef.current) {
        return;
      }
      try {
        if (!silent) {
          setError(null);
          setPollHint(null);
        }
        const next = withRefresh
          ? await refreshPublicPayment(token)
          : await fetchPublicPayment(token);
        setPayment(next);
        if (silent) {
          setPollHint(null);
        }
      } catch (err) {
        if (silent && paymentRef.current) {
          if (isRateLimitedPaymentError(err)) {
            const pauseMs = (err.retryAfterSeconds ?? 45) * 1000;
            pollPausedUntilRef.current = Date.now() + pauseMs;
            setPollHint("Слишком частые запросы. Обновим статус через минуту.");
          } else {
            setPollHint("Не удалось обновить статус. Повторим позже.");
          }
          return;
        }
        setError(err instanceof Error ? err.message : "Не удалось загрузить платёж.");
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [token],
  );

  useEffect(() => {
    void loadPayment(true);
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

  const paymentStatus = payment ? normalizeStatus(payment.status) : null;

  useEffect(() => {
    if (!paymentStatus || !shouldPollPaymentStatus(paymentStatus)) {
      return;
    }

    const poll = () => {
      if (paymentStatus === "pending" || paymentStatus === "confirming") {
        void loadPayment(true, { silent: true });
        return;
      }
      void loadPayment(false, { silent: true });
    };

    const intervalMs =
      paymentStatus === "pending" || paymentStatus === "confirming"
        ? POLL_PENDING_REFRESH_MS
        : POLL_PAID_READ_MS;
    const timer = window.setInterval(poll, intervalMs);
    return () => window.clearInterval(timer);
  }, [paymentStatus, loadPayment]);

  const statusMeta = useMemo(
    () => (payment ? getInvoiceDetailStatusMeta(payment.status) : null),
    [payment],
  );

  const qrSrc = payment ? buildQrSrc(payment) : null;
  const tone = payment ? invoiceStatusTone(payment.status) : "warning";
  const amountLine = payment
    ? `${formatDecimal(payment.amount_crypto)} ${payment.crypto_currency}`
    : "";

  const headerTitle = payment?.merchant_name ?? (
    <>
      Noren<span>Digital</span>
    </>
  );

  const awaitingPayment =
    payment &&
    normalizeStatus(payment.status) === "pending" &&
    !isFailedStatus(payment.status) &&
    Boolean(payment.payment_address);
  const confirming = payment && isConfirmingStatus(payment.status);

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
      <div className="pp-nebula pp-nebula--one" aria-hidden />
      <div className="pp-nebula pp-nebula--two" aria-hidden />
      <div className="pp-grid-bg" aria-hidden />

      <main className="pp-shell">
        <header className="pp-header">
          <div className="pp-header-user">
            <span className="pp-avatar" aria-hidden>
              ND
            </span>
            <div>
              <p className="pp-greeting">Безопасная оплата</p>
              <h1 className="pp-header-title">{headerTitle}</h1>
            </div>
          </div>
          {statusMeta ? (
            <span className={`pp-pill pp-pill--${tone}`}>{statusMeta.label}</span>
          ) : null}
        </header>

        {pollHint ? (
          <p className="pp-poll-hint" role="status">
            {pollHint}
          </p>
        ) : null}

        {loading ? (
          <section className="pp-glass pp-card--state">
            <div className="pp-spinner" aria-hidden />
            <p className="pp-muted">Подготавливаем платёж…</p>
          </section>
        ) : null}

        {!loading && error ? (
          <section className="pp-glass pp-card--state">
            <h2 className="pp-title">Платёж недоступен</h2>
            <p className="pp-muted">{error}</p>
          </section>
        ) : null}

        {!loading && payment && !error ? (
          <>
            <section className="pp-glass pp-hero">
              <p className="pp-hero-label">Сумма к оплате</p>
              <strong className="pp-hero-amount">{amountLine}</strong>
              {isStableCoinFiatPair(payment.crypto_currency, payment.fiat_currency) ? (
                <span className="pp-hero-fiat">
                  ≈ {formatDecimal(payment.amount_fiat)} {payment.fiat_currency}
                </span>
              ) : null}
              <div className="pp-hero-pills">
                <span className="pp-chip">{payment.network}</span>
                <span className="pp-chip pp-chip--muted">Заказ {payment.merchant_order_id}</span>
              </div>

              {awaitingPayment ? (
                <div className="pp-timer-bar">
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
            </section>

            {confirming ? (
              <PaymentConfirmationsProgress
                actual={payment.network_confirmations_actual}
                cryptoCurrency={payment.crypto_currency}
                network={payment.network}
                required={payment.network_confirmations_required}
              />
            ) : null}

            {isSuccessStatus(payment.status) ? (
              <section className="pp-terminal pp-terminal--success">
                <div className="pp-terminal-icon" aria-hidden>
                  ✓
                </div>
                <h2 className="pp-title">Оплата получена</h2>
                <p className="pp-muted">
                  Средства зафиксированы. Продавец получит уведомление — можете закрыть эту вкладку.
                </p>
                {payment.return_url_success ? (
                  <ReturnToShopBanner autoRedirect href={payment.return_url_success} tone="success" />
                ) : null}
              </section>
            ) : null}

            {isFailedStatus(payment.status) ? (
              <section className="pp-terminal pp-terminal--failed">
                <div className="pp-terminal-icon pp-terminal-icon--failed" aria-hidden>
                  !
                </div>
                <h2 className="pp-title">
                  {payment.status === "expired"
                    ? "Время оплаты истекло"
                    : payment.status === "cancelled"
                      ? "Счёт отменён"
                      : "Платёж не выполнен"}
                </h2>
                <p className="pp-muted">Запросите новую ссылку у продавца или вернитесь в магазин.</p>
                {payment.return_url_failed ? (
                  <ReturnToShopBanner href={payment.return_url_failed} tone="failed" />
                ) : null}
              </section>
            ) : null}

            {awaitingPayment ? (
              <>
                <div className="pp-actions">
                  <button
                    className="pp-action"
                    onClick={() => void copyValue("amount", payment.amount_crypto)}
                    type="button"
                  >
                    <span className="pp-action-icon" aria-hidden>
                      ⧉
                    </span>
                    <span className="pp-action-label">
                      {copied === "amount" ? "Скопировано" : "Сумма"}
                    </span>
                  </button>
                  <button
                    className="pp-action"
                    onClick={() => {
                      if (payment.payment_address) {
                        void copyValue("address", payment.payment_address);
                      }
                    }}
                    type="button"
                  >
                    <span className="pp-action-icon" aria-hidden>
                      ⊕
                    </span>
                    <span className="pp-action-label">
                      {copied === "address" ? "Скопировано" : "Адрес"}
                    </span>
                  </button>
                  <button
                    className="pp-action"
                    onClick={() => void loadPayment(true, { silent: false })}
                    type="button"
                  >
                    <span className="pp-action-icon" aria-hidden>
                      ↻
                    </span>
                    <span className="pp-action-label">Статус</span>
                  </button>
                </div>

                <section className="pp-glass pp-panel">
                  <div className="pp-panel-head">
                    <div>
                      <h2 className="pp-panel-title">Отсканируйте QR</h2>
                      <p className="pp-panel-sub">Быстрая оплата в кошельке</p>
                    </div>
                  </div>

                  {qrSrc ? (
                    <div className="pp-qr-stage">
                      <div className="pp-qr-glow" aria-hidden />
                      <div className="pp-qr-frame">
                        <img alt="QR-код для оплаты" className="pp-qr-image" src={qrSrc} />
                      </div>
                    </div>
                  ) : null}

                  {payment.payment_address ? (
                    <PaymentDepositAddress
                      address={payment.payment_address}
                      copied={copied === "address"}
                      cryptoCurrency={payment.crypto_currency}
                      network={payment.network}
                      onCopy={() => {
                        if (payment.payment_address) {
                          void copyValue("address", payment.payment_address);
                        }
                      }}
                    />
                  ) : null}

                  <ol className="pp-step-list">
                    <li className="pp-step-item">
                      <span className="pp-step-num">1</span>
                      <span>Откройте кошелёк с {payment.crypto_currency}.</span>
                    </li>
                    <li className="pp-step-item">
                      <span className="pp-step-num">2</span>
                      <span>
                        Выберите сеть <strong>{payment.network}</strong>.
                      </span>
                    </li>
                    <li className="pp-step-item">
                      <span className="pp-step-num">3</span>
                      <span>
                        Отправьте <strong>{amountLine}</strong> без округления.
                      </span>
                    </li>
                  </ol>
                </section>
              </>
            ) : null}
          </>
        ) : null}

        <footer className="pp-footer">
          <p>Защищённое соединение</p>
          <p className="pp-brand-foot">
            Noren<span>Digital</span>
          </p>
        </footer>
      </main>
    </div>
  );
}

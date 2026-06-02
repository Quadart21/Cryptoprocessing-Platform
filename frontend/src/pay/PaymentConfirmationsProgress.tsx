import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import {
  resolveNetworkConfirmationProgress,
  shouldShowConfirmationSegments,
} from "../utils/networkConfirmations";

type PaymentConfirmationsProgressProps = {
  actual: number | null;
  required: number | null;
  cryptoCurrency: string;
  network: string;
};

export function PaymentConfirmationsProgress({
  actual,
  required,
  cryptoCurrency,
  network,
}: PaymentConfirmationsProgressProps) {
  const prevActualRef = useRef<number | null>(null);
  const [counterBump, setCounterBump] = useState(false);
  const [freshSegmentIndex, setFreshSegmentIndex] = useState<number | null>(null);

  const progress = useMemo(
    () => resolveNetworkConfirmationProgress(actual, required),
    [actual, required],
  );
  const showSegments = shouldShowConfirmationSegments(progress.required);

  useEffect(() => {
    if (actual == null) {
      return;
    }
    const previous = prevActualRef.current;
    if (previous != null && actual > previous) {
      setCounterBump(true);
      setFreshSegmentIndex(actual - 1);
      const bumpTimer = window.setTimeout(() => setCounterBump(false), 750);
      const segmentTimer = window.setTimeout(() => setFreshSegmentIndex(null), 900);
      prevActualRef.current = actual;
      return () => {
        window.clearTimeout(bumpTimer);
        window.clearTimeout(segmentTimer);
      };
    }
    prevActualRef.current = actual;
  }, [actual]);

  const counterLabel = progress.hasRequired
    ? `${progress.actual}/${progress.required}`
    : String(progress.actual);

  return (
    <section
      aria-live="polite"
      aria-valuemax={progress.required ?? undefined}
      aria-valuemin={0}
      aria-valuenow={progress.actual}
      className="pp-confirm"
      role="progressbar"
    >
      <div className="pp-confirm-head">
        <div aria-hidden className="pp-confirm-icon-wrap">
          <span className="pp-confirm-icon-ring" />
          <span className="pp-confirm-icon">
            <svg fill="none" height="22" viewBox="0 0 24 24" width="22">
              <path
                d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.75"
              />
            </svg>
          </span>
        </div>
        <div className="pp-confirm-copy">
          <h2 className="pp-confirm-title">Подтверждение в сети</h2>
          <p className="pp-confirm-sub">
            Транзакция {cryptoCurrency} · {network}
          </p>
        </div>
        <span className="pp-confirm-live">
          <span aria-hidden className="pp-confirm-live-dot" />
          Live
        </span>
      </div>

      <div className="pp-confirm-body">
        <div
          className={`pp-confirm-ring${counterBump ? " pp-confirm-ring--bump" : ""}`}
          style={{ "--pp-confirm-progress": String(progress.ratio) } as CSSProperties}
        >
          <div className="pp-confirm-ring-inner">
            <span
              className={`pp-confirm-counter${counterBump ? " pp-confirm-counter--bump" : ""}`}
              key={counterLabel}
            >
              {counterLabel}
            </span>
            <span className="pp-confirm-counter-label">блоков</span>
          </div>
        </div>

        <div className="pp-confirm-stats">
          <div className="pp-confirm-stat">
            <span className="pp-confirm-stat-value">{progress.actual}</span>
            <span className="pp-confirm-stat-label">получено</span>
          </div>
          {progress.hasRequired ? (
            <>
              <span aria-hidden className="pp-confirm-stat-divider">
                /
              </span>
              <div className="pp-confirm-stat">
                <span className="pp-confirm-stat-value">{progress.required}</span>
                <span className="pp-confirm-stat-label">нужно</span>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {progress.hasRequired ? (
        <div className="pp-confirm-track-wrap">
          <div aria-hidden className="pp-confirm-track">
            <div
              className={`pp-confirm-fill${counterBump ? " pp-confirm-fill--pulse" : ""}`}
              style={{ width: `${Math.max(progress.ratio * 100, progress.actual > 0 ? 4 : 0)}%` }}
            />
          </div>
          {progress.percentLabel ? (
            <span className="pp-confirm-percent">{progress.percentLabel}</span>
          ) : null}
        </div>
      ) : null}

      {showSegments && progress.required ? (
        <div
          aria-label={`Подтверждено ${progress.actual} из ${progress.required} блоков`}
          className="pp-confirm-segments"
        >
          {Array.from({ length: progress.required }, (_, index) => {
            const filled = index < progress.actual;
            const fresh = index === freshSegmentIndex;
            return (
              <span
                className={`pp-confirm-segment${filled ? " pp-confirm-segment--filled" : ""}${
                  fresh ? " pp-confirm-segment--fresh" : ""
                }`}
                key={index}
              />
            );
          })}
        </div>
      ) : null}

      <p className="pp-confirm-note">
        Платёж уже в блокчейне — ждём нужное число подтверждений. Счётчик обновится автоматически,
        обычно это занимает от нескольких минут.
      </p>
    </section>
  );
}

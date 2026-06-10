import { useEffect, useMemo, useState } from "react";

import type { BalanceResponse } from "../../api";
import { useTranslation } from "../../i18n";
import { formatDecimal } from "../../utils/format";

type BalanceHoldsPanelProps = {
  balance: BalanceResponse | null;
  onRefresh?: () => void;
};

function formatCountdown(targetIso: string, nowMs: number): string {
  const targetMs = Date.parse(targetIso);
  const diffMs = Math.max(targetMs - nowMs, 0);
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function BalanceHoldsPanel({ balance, onRefresh }: BalanceHoldsPanelProps) {
  const { t } = useTranslation();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!balance?.next_release_at || !onRefresh) {
      return;
    }
    const remainingMs = Date.parse(balance.next_release_at) - Date.now();
    if (remainingMs <= 0) {
      onRefresh();
      return;
    }
    const timer = window.setTimeout(onRefresh, remainingMs + 500);
    return () => window.clearTimeout(timer);
  }, [balance?.next_release_at, onRefresh]);

  const holds = balance?.holds ?? [];
  const currency = balance?.currency ?? "USDT";
  const holdHours = balance?.hold_hours ?? 24;

  const nextCountdown = useMemo(() => {
    if (!balance?.next_release_at) {
      return null;
    }
    return formatCountdown(balance.next_release_at, nowMs);
  }, [balance?.next_release_at, nowMs]);

  if (!balance) {
    return null;
  }

  return (
    <article className="mc-surface">
      <header className="mc-surface-header">
        <p className="mc-surface-eyebrow">{t("merchant.widgets.balanceHoldsPanel.eyebrow")}</p>
        <h2 className="mc-surface-title">{t("merchant.widgets.balanceHoldsPanel.title")}</h2>
        <p className="mc-surface-desc">
          {t("merchant.widgets.balanceHoldsPanel.description", { hours: holdHours })}
          {nextCountdown ? (
            <>
              {" "}
              {t("merchant.widgets.balanceHoldsPanel.nextRelease")}{" "}
              <strong>{nextCountdown}</strong>.
            </>
          ) : null}
        </p>
      </header>

      {holds.length === 0 ? (
        <div className="mc-empty">{t("merchant.widgets.balanceHoldsPanel.empty")}</div>
      ) : (
        <div className="mc-rows">
          {holds.map((hold) => (
            <div className="mc-row" key={hold.transaction_id}>
              <div>
                <p className="mc-row-title">
                  {formatDecimal(hold.amount)} {currency}
                </p>
                <p className="mc-row-sub">
                  {t("merchant.widgets.balanceHoldsPanel.orderLabel", { orderId: hold.merchant_order_id })}
                </p>
              </div>
              <div className="mc-row-badges">
                <span className="mc-badge mc-badge-neutral">
                  {formatCountdown(hold.available_at, nowMs)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

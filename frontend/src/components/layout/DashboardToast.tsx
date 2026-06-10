import { useEffect } from "react";

import { useTranslation } from "../../i18n";

export type DashboardToastKind = "success" | "error";

type DashboardToastProps = {
  kind: DashboardToastKind;
  message: string;
  onDismiss: () => void;
};

const AUTO_DISMISS_MS: Record<DashboardToastKind, number> = {
  success: 5500,
  error: 8000,
};

export function DashboardToast({ kind, message, onDismiss }: DashboardToastProps) {
  const { t } = useTranslation();

  useEffect(() => {
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS[kind]);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when message changes
  }, [kind, message]);

  return (
    <div
      className={`dashboard-toast dashboard-toast--${kind}`}
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
    >
      <span className="dashboard-toast-icon" aria-hidden>
        {kind === "success" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </span>
      <p className="dashboard-toast-message">{message}</p>
      <button
        className="dashboard-toast-close"
        type="button"
        aria-label={t("common.closeNotification")}
        onClick={onDismiss}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

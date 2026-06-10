import { createPortal } from "react-dom";

import { useTranslation } from "../../i18n";

import { DashboardToast } from "./DashboardToast";

type DashboardStatusMessagesProps = {
  success: string | null;
  error: string | null;
  onDismissSuccess?: () => void;
  onDismissError?: () => void;
  newApiSecret?: string | null;
  onCloseSecretModal?: () => void;
};

export function DashboardStatusMessages({
  success,
  error,
  onDismissSuccess,
  onDismissError,
  newApiSecret,
  onCloseSecretModal,
}: DashboardStatusMessagesProps) {
  const { t } = useTranslation();

  async function handleCopySecret() {
    if (newApiSecret) {
      try {
        await navigator.clipboard.writeText(newApiSecret);
      } catch {
        // silent fail
      }
    }
  }

  const hasToasts = Boolean(success || error);
  const toastStack =
    hasToasts && typeof document !== "undefined"
      ? createPortal(
          <div className="dashboard-toast-stack">
            {success ? (
              <DashboardToast
                kind="success"
                message={success}
                onDismiss={() => onDismissSuccess?.()}
              />
            ) : null}
            {error ? (
              <DashboardToast kind="error" message={error} onDismiss={() => onDismissError?.()} />
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {toastStack}
      {newApiSecret ? (
        <div className="nc-modal-overlay" onClick={() => onCloseSecretModal?.()}>
          <div className="nc-modal" onClick={(e) => e.stopPropagation()}>
            <button className="nc-modal-close" onClick={() => onCloseSecretModal?.()} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "rgba(239, 68, 68, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-0)", marginBottom: 8 }}>
                {t("common.saveSecretKey")}
              </h3>
              <p style={{ color: "var(--text-2)", fontSize: 14 }}>{t("common.saveSecretHint")}</p>
            </div>
            <div
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                borderRadius: 12,
                padding: 16,
                marginBottom: 24,
                wordBreak: "break-all",
              }}
            >
              <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 8 }}>{t("common.newSecretKey")}</p>
              <code style={{ color: "var(--cyan)", fontSize: 14, fontFamily: "monospace" }}>
                {newApiSecret}
              </code>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                className="ghost-button"
                onClick={handleCopySecret}
                type="button"
                style={{ flex: 1 }}
              >
                {t("common.copy")}
              </button>
              <button
                className="primary-button"
                onClick={() => onCloseSecretModal?.()}
                type="button"
                style={{ flex: 1 }}
              >
                {t("common.savedConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

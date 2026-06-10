import { FormEvent, useEffect, useState } from "react";
import QRCode from "qrcode";

import type { TwoFactorSetup, TwoFactorStatus } from "../../api";
import { useTranslation } from "../../i18n";

type TwoFactorPanelProps = {
  status: TwoFactorStatus | null;
  setupData: TwoFactorSetup | null;
  loading: boolean;
  onSetup: () => void;
  onEnable: (code: string) => void;
  onDisable: (payload: { password: string; code?: string }) => void;
};

export function TwoFactorPanel({
  status,
  setupData,
  loading,
  onSetup,
  onEnable,
  onDisable,
}: TwoFactorPanelProps) {
  const { t } = useTranslation();
  const [enableCode, setEnableCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  useEffect(() => {
    if (!setupData) {
      setQrDataUrl(null);
      setCopiedSecret(false);
      return;
    }

    let cancelled = false;
    void QRCode.toDataURL(setupData.otpauth_url, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 236,
      color: {
        dark: "#ecf4ff",
        light: "#00000000",
      },
    })
      .then((nextUrl: string) => {
        if (!cancelled) {
          setQrDataUrl(nextUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [setupData]);

  async function handleCopyRegistrationCode() {
    if (!setupData?.secret) {
      return;
    }
    try {
      await navigator.clipboard.writeText(setupData.secret);
      setCopiedSecret(true);
      window.setTimeout(() => setCopiedSecret(false), 1800);
    } catch {
      setCopiedSecret(false);
    }
  }

  function handleEnable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onEnable(enableCode);
  }

  function handleDisable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onDisable({
      password: disablePassword,
      code: disableCode.trim() || undefined,
    });
  }

  return (
    <article className="mc-surface">
      <header className="mc-surface-header">
        <p className="mc-surface-eyebrow">{t("merchant.twoFactor.eyebrow")}</p>
        <h2 className="mc-surface-title">{t("merchant.twoFactor.title")}</h2>
        <p className="mc-surface-desc">{t("merchant.twoFactor.description")}</p>
      </header>

      <div className="mc-kv-strip">
        <div className="mc-kv">
          <span>{t("merchant.twoFactor.status")}</span>
          <code>{status?.enabled ? t("merchant.twoFactor.enabled") : t("merchant.twoFactor.disabled")}</code>
        </div>
        <div className="mc-kv">
          <span>{t("merchant.twoFactor.secret")}</span>
          <code>
            {status?.configured ? t("merchant.twoFactor.secretCreated") : t("merchant.twoFactor.secretNotCreated")}
          </code>
        </div>
        <div className="mc-kv">
          <span>{t("merchant.twoFactor.confirmation")}</span>
          <code>{status?.confirmed_at ?? t("common.dash")}</code>
        </div>
      </div>

      <div className="mc-form-actions" style={{ marginBottom: 16 }}>
        <button className="ghost-button" disabled={loading} onClick={onSetup} type="button">
          {loading ? t("merchant.twoFactor.preparing") : t("merchant.twoFactor.generateSecret")}
        </button>
      </div>

      {setupData ? (
        <div className="mc-nested twofactor-setup-card" style={{ marginBottom: 20 }}>
          <div className="twofactor-setup-grid">
            <section className="twofactor-qr-panel">
              <p className="twofactor-label">{t("merchant.twoFactor.qrForApp")}</p>
              {qrDataUrl ? (
                <img className="twofactor-qr-image" src={qrDataUrl} alt={t("merchant.twoFactor.qrAlt")} />
              ) : (
                <div className="twofactor-qr-placeholder">{t("merchant.twoFactor.qrGenerating")}</div>
              )}
              <p className="muted-text">{t("merchant.twoFactor.scanOrEnter")}</p>
            </section>

            <section className="twofactor-live-panel">
              <p className="twofactor-label">{t("merchant.twoFactor.secretForEntry")}</p>
              <div className="twofactor-live-code">{formatRegistrationSecret(setupData.secret)}</div>
              <button className="ghost-button" onClick={() => void handleCopyRegistrationCode()} type="button">
                {copiedSecret ? t("common.copied") : t("merchant.twoFactor.copySecret")}
              </button>
            </section>
          </div>

          <div className="twofactor-meta-grid">
            <p>
              <strong>{t("merchant.twoFactor.issuer")}:</strong> {setupData.issuer}
            </p>
            <p>
              <strong>{t("merchant.twoFactor.account")}:</strong> {setupData.account_name}
            </p>
            <p>
              <strong>{t("merchant.twoFactor.secret")}:</strong> <code>{setupData.secret}</code>
            </p>
          </div>
        </div>
      ) : null}

      <form className="mc-form" onSubmit={handleEnable}>
        <label className="mc-field">
          <span>{t("merchant.twoFactor.appCode")}</span>
          <input
            value={enableCode}
            onChange={(event) => setEnableCode(event.target.value)}
            inputMode="numeric"
            minLength={6}
            maxLength={8}
            placeholder={t("merchant.twoFactor.codePlaceholder")}
            required
            type="text"
          />
        </label>
        <button className="primary-button" disabled={loading} type="submit">
          {loading ? t("merchant.twoFactor.verifying") : t("merchant.twoFactor.enable")}
        </button>
      </form>

      {status?.enabled ? (
        <>
          <hr className="mc-divider" />
          <form className="mc-form" onSubmit={handleDisable}>
            <p className="mc-surface-eyebrow" style={{ marginBottom: 4 }}>
              {t("merchant.twoFactor.disableSection")}
            </p>
            <label className="mc-field">
              <span>{t("merchant.twoFactor.currentPassword")}</span>
              <input
                value={disablePassword}
                onChange={(event) => setDisablePassword(event.target.value)}
                autoComplete="current-password"
                minLength={8}
                required
                type="password"
              />
            </label>
            <label className="mc-field">
              <span>{t("merchant.twoFactor.optionalCode")}</span>
              <input
                value={disableCode}
                onChange={(event) => setDisableCode(event.target.value)}
                inputMode="numeric"
                minLength={6}
                maxLength={8}
                placeholder={t("merchant.twoFactor.codePlaceholder")}
                type="text"
              />
            </label>
            <button className="ghost-button" disabled={loading} type="submit">
              {loading ? t("merchant.twoFactor.disabling") : t("merchant.twoFactor.disable")}
            </button>
          </form>
        </>
      ) : null}
    </article>
  );
}

function formatRegistrationSecret(secret: string): string {
  const clean = secret.replace(/\s+/g, "").toUpperCase();
  return clean.replace(/(.{4})/g, "$1 ").trim();
}

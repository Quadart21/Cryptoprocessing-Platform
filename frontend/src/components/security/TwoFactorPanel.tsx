import { FormEvent, useEffect, useState } from "react";
import QRCode from "qrcode";

import type { TwoFactorSetup, TwoFactorStatus } from "../../api";

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
        <p className="mc-surface-eyebrow">Защита</p>
        <h2 className="mc-surface-title">Двухфакторная аутентификация</h2>
        <p className="mc-surface-desc">
          Подключите приложение вроде Google Authenticator. После включения для входа потребуется одноразовый код.
        </p>
      </header>

      <div className="mc-kv-strip">
        <div className="mc-kv">
          <span>Статус</span>
          <code>{status?.enabled ? "включена" : "выключена"}</code>
        </div>
        <div className="mc-kv">
          <span>Секрет</span>
          <code>{status?.configured ? "создан" : "не создан"}</code>
        </div>
        <div className="mc-kv">
          <span>Подтверждение</span>
          <code>{status?.confirmed_at ?? "—"}</code>
        </div>
      </div>

      <div className="mc-form-actions" style={{ marginBottom: 16 }}>
        <button className="ghost-button" disabled={loading} onClick={onSetup} type="button">
          {loading ? "Готовим…" : "Сгенерировать секрет"}
        </button>
      </div>

      {setupData ? (
        <div className="mc-nested twofactor-setup-card" style={{ marginBottom: 20 }}>
          <div className="twofactor-setup-grid">
            <section className="twofactor-qr-panel">
              <p className="twofactor-label">QR для приложения</p>
              {qrDataUrl ? (
                <img className="twofactor-qr-image" src={qrDataUrl} alt="QR-код для настройки 2FA" />
              ) : (
                <div className="twofactor-qr-placeholder">QR генерируется…</div>
              )}
              <p className="muted-text">Отсканируйте или введите код ниже вручную.</p>
            </section>

            <section className="twofactor-live-panel">
              <p className="twofactor-label">Секрет для ввода</p>
              <div className="twofactor-live-code">{formatRegistrationSecret(setupData.secret)}</div>
              <button className="ghost-button" onClick={() => void handleCopyRegistrationCode()} type="button">
                {copiedSecret ? "Скопировано" : "Копировать секрет"}
              </button>
            </section>
          </div>

          <div className="twofactor-meta-grid">
            <p>
              <strong>Issuer:</strong> {setupData.issuer}
            </p>
            <p>
              <strong>Аккаунт:</strong> {setupData.account_name}
            </p>
            <p>
              <strong>Секрет:</strong> <code>{setupData.secret}</code>
            </p>
          </div>
        </div>
      ) : null}

      <form className="mc-form" onSubmit={handleEnable}>
        <label className="mc-field">
          <span>Код из приложения</span>
          <input
            value={enableCode}
            onChange={(event) => setEnableCode(event.target.value)}
            inputMode="numeric"
            minLength={6}
            maxLength={8}
            placeholder="123456"
            required
            type="text"
          />
        </label>
        <button className="primary-button" disabled={loading} type="submit">
          {loading ? "Проверяем…" : "Включить 2FA"}
        </button>
      </form>

      {status?.enabled ? (
        <>
          <hr className="mc-divider" />
          <form className="mc-form" onSubmit={handleDisable}>
            <p className="mc-surface-eyebrow" style={{ marginBottom: 4 }}>
              Отключение
            </p>
            <label className="mc-field">
              <span>Текущий пароль</span>
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
              <span>Код 2FA (по желанию)</span>
              <input
                value={disableCode}
                onChange={(event) => setDisableCode(event.target.value)}
                inputMode="numeric"
                minLength={6}
                maxLength={8}
                placeholder="123456"
                type="text"
              />
            </label>
            <button className="ghost-button" disabled={loading} type="submit">
              {loading ? "Отключаем…" : "Отключить 2FA"}
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

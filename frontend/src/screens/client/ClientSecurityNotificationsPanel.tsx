import { FormEvent, useEffect, useState } from "react";

import type {
  MerchantNotificationSettings,
  MerchantNotificationSettingsUpdatePayload,
} from "../../api";

type ClientSecurityNotificationsPanelProps = {
  loading: boolean;
  settings: MerchantNotificationSettings | null;
  onSaveNotificationSettings: (payload: MerchantNotificationSettingsUpdatePayload) => void;
  onChangePassword: (payload: { current_password: string; new_password: string }) => void;
};

export function ClientSecurityNotificationsPanel({
  loading,
  settings,
  onSaveNotificationSettings,
  onChangePassword,
}: ClientSecurityNotificationsPanelProps) {
  const [notificationForm, setNotificationForm] = useState<MerchantNotificationSettingsUpdatePayload>({
    notify_email_enabled: true,
    notify_telegram_enabled: false,
    telegram_chat_id: null,
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
  });

  useEffect(() => {
    if (!settings) {
      return;
    }
    setNotificationForm({
      notify_email_enabled: settings.notify_email_enabled,
      notify_telegram_enabled: settings.notify_telegram_enabled,
      telegram_chat_id: settings.telegram_chat_id,
    });
  }, [settings]);

  function handleSaveNotificationSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSaveNotificationSettings({
      ...notificationForm,
      telegram_chat_id: (notificationForm.telegram_chat_id ?? "").trim() || null,
    });
  }

  function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onChangePassword(passwordForm);
    setPasswordForm((current) => ({ ...current, current_password: "", new_password: "" }));
  }

  return (
    <article className="mc-surface">
      <header className="mc-surface-header">
        <p className="mc-surface-eyebrow">Аккаунт</p>
        <h2 className="mc-surface-title">Уведомления и пароль</h2>
        <p className="mc-surface-desc">
          Управляйте каналами оповещений и периодически обновляйте пароль входа в кабинет.
        </p>
      </header>

      <div className="mc-stack-gap">
        {settings ? (
          <div className="mc-kv-strip">
            <div className="mc-kv">
              <span>Email</span>
              <code>{settings.email}</code>
            </div>
            <div className="mc-kv">
              <span>Telegram</span>
              <code>{settings.telegram_connected ? "подключён" : "не подключён"}</code>
            </div>
          </div>
        ) : (
          <p className="muted-text">Настройки не загружены.</p>
        )}

        <form className="mc-form" onSubmit={handleSaveNotificationSettings}>
          <p className="mc-surface-eyebrow" style={{ marginBottom: 4 }}>
            Каналы
          </p>
          <label className="mc-switch">
            <span>Email-уведомления</span>
            <input
              checked={notificationForm.notify_email_enabled}
              onChange={(event) =>
                setNotificationForm({
                  ...notificationForm,
                  notify_email_enabled: event.target.checked,
                })
              }
              type="checkbox"
            />
          </label>
          <label className="mc-switch">
            <span>Telegram</span>
            <input
              checked={notificationForm.notify_telegram_enabled}
              onChange={(event) =>
                setNotificationForm({
                  ...notificationForm,
                  notify_telegram_enabled: event.target.checked,
                })
              }
              type="checkbox"
            />
          </label>
          <label className="mc-field">
            <span>Telegram chat ID</span>
            <input
              value={notificationForm.telegram_chat_id ?? ""}
              onChange={(event) =>
                setNotificationForm({
                  ...notificationForm,
                  telegram_chat_id: event.target.value,
                })
              }
              placeholder="например: 123456789"
              type="text"
            />
          </label>
          <button className="primary-button" disabled={loading} type="submit">
            {loading ? "Сохраняем…" : "Сохранить уведомления"}
          </button>
        </form>

        <hr className="mc-divider" />

        <form className="mc-form" onSubmit={handleChangePassword}>
          <p className="mc-surface-eyebrow" style={{ marginBottom: 4 }}>
            Смена пароля
          </p>
          <label className="mc-field">
            <span>Текущий пароль</span>
            <input
              value={passwordForm.current_password}
              onChange={(event) =>
                setPasswordForm({
                  ...passwordForm,
                  current_password: event.target.value,
                })
              }
              autoComplete="current-password"
              minLength={8}
              required
              type="password"
            />
          </label>
          <label className="mc-field">
            <span>Новый пароль</span>
            <input
              value={passwordForm.new_password}
              onChange={(event) =>
                setPasswordForm({
                  ...passwordForm,
                  new_password: event.target.value,
                })
              }
              autoComplete="new-password"
              minLength={8}
              required
              type="password"
            />
          </label>
          <button className="ghost-button" disabled={loading} type="submit">
            {loading ? "Обновляем…" : "Сменить пароль"}
          </button>
        </form>
      </div>
    </article>
  );
}

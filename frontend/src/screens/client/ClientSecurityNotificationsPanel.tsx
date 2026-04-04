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
    <article className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Уведомления и доступ</p>
          <h2>Email, Telegram и пароль</h2>
        </div>
      </div>

      {settings ? (
        <div className="result-box">
          <p>Email для уведомлений: {settings.email}</p>
          <p>Telegram подключен: {settings.telegram_connected ? "да" : "нет"}</p>
        </div>
      ) : (
        <p className="muted-text">Настройки уведомлений пока не загружены.</p>
      )}

      <form className="form" onSubmit={handleSaveNotificationSettings}>
        <label className="switch-row">
          <span>Получать уведомления на email</span>
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
        <label className="switch-row">
          <span>Получать уведомления в Telegram</span>
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
        <label>
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
          {loading ? "Сохраняем..." : "Сохранить уведомления"}
        </button>
      </form>

      <form className="form" onSubmit={handleChangePassword}>
        <label>
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
        <label>
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
          {loading ? "Обновляем..." : "Сменить пароль"}
        </button>
      </form>
    </article>
  );
}

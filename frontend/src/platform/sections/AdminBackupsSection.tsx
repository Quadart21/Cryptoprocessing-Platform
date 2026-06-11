import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import type {
  BackupJobItem,
  BackupScheduleFrequency,
  BackupScope,
  BackupSettings,
} from "../../api/base";
import {
  createBackupJob,
  fetchBackupJobs,
  fetchBackupSettings,
  testBackupDriveSettings,
  updateBackupSettings,
} from "../../api/admin";

type AdminBackupsSectionProps = {
  adminToken: string | null;
};

const SCOPE_LABELS: Record<BackupScope, string> = {
  full: "Полная",
  database: "База данных",
  backend: "Бэкенд",
  frontend: "Фронтенд",
};

const STATUS_LABELS: Record<BackupJobItem["status"], string> = {
  pending: "В очереди",
  running: "Выполняется",
  completed: "Готово",
  failed: "Ошибка",
};

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function formatBytes(value: number | null): string {
  if (value == null || value <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function AdminBackupsSection({ adminToken }: AdminBackupsSectionProps) {
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [jobs, setJobs] = useState<BackupJobItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folderId, setFolderId] = useState("");
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [uploadEnabled, setUploadEnabled] = useState(true);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<BackupScheduleFrequency>("daily");
  const [scheduleHourUtc, setScheduleHourUtc] = useState(3);
  const [scheduleWeekday, setScheduleWeekday] = useState(0);
  const [scheduleScopes, setScheduleScopes] = useState<BackupScope[]>(["full"]);
  const [retentionCount, setRetentionCount] = useState(5);

  const hasActiveJobs = useMemo(
    () => jobs.some((job) => job.status === "pending" || job.status === "running"),
    [jobs],
  );

  const applySettings = useCallback((next: BackupSettings) => {
    setSettings(next);
    setFolderId(next.google_drive_folder_id ?? "");
    setUploadEnabled(next.upload_to_drive_enabled);
    setScheduleEnabled(next.schedule_enabled);
    setScheduleFrequency(next.schedule_frequency);
    setScheduleHourUtc(next.schedule_hour_utc);
    setScheduleWeekday(next.schedule_weekday);
    setScheduleScopes(next.schedule_scopes.length ? next.schedule_scopes : ["full"]);
    setRetentionCount(next.local_retention_count);
  }, []);

  const reload = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    setError(null);
    try {
      const [nextSettings, nextJobs] = await Promise.all([
        fetchBackupSettings(adminToken),
        fetchBackupJobs(adminToken),
      ]);
      applySettings(nextSettings);
      setJobs(nextJobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить настройки бэкапов.");
    } finally {
      setLoading(false);
    }
  }, [adminToken, applySettings]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!adminToken || !hasActiveJobs) return;
    const timer = window.setInterval(() => {
      void fetchBackupJobs(adminToken)
        .then(setJobs)
        .catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [adminToken, hasActiveJobs]);

  async function saveSettings() {
    if (!adminToken || loading) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        google_drive_folder_id: folderId.trim() || null,
        google_service_account_json: serviceAccountJson.trim() ? serviceAccountJson.trim() : undefined,
        upload_to_drive_enabled: uploadEnabled,
        schedule_enabled: scheduleEnabled,
        schedule_frequency: scheduleFrequency,
        schedule_hour_utc: scheduleHourUtc,
        schedule_weekday: scheduleWeekday,
        schedule_scopes: scheduleScopes,
        local_retention_count: retentionCount,
      };
      const next = await updateBackupSettings(adminToken, payload);
      applySettings(next);
      setServiceAccountJson("");
      setMessage("Настройки бэкапов сохранены.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить настройки.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveSettings();
  }

  async function handleTestDrive() {
    if (!adminToken || loading) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await testBackupDriveSettings(adminToken);
      if (result.ok) {
        setMessage(
          result.folder_name
            ? `Google Drive: ${result.message} (${result.folder_name})`
            : result.message,
        );
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Проверка Google Drive не удалась.");
    } finally {
      setLoading(false);
    }
  }

  async function handleInstantBackup(scope: BackupScope) {
    if (!adminToken || loading) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const job = await createBackupJob(adminToken, scope);
      setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      setMessage(`Запущен бэкап: ${SCOPE_LABELS[scope]}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось запустить бэкап.");
    } finally {
      setLoading(false);
    }
  }

  function toggleScheduleScope(scope: BackupScope) {
    setScheduleScopes((current) => {
      if (current.includes(scope)) {
        const next = current.filter((item) => item !== scope);
        return next.length ? next : current;
      }
      return [...current, scope];
    });
  }

  if (!adminToken) {
    return <p className="muted-text">Нет сессии администратора для управления бэкапами.</p>;
  }

  return (
    <div className="console-section-stack">
      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      <section className="dashboard-grid client-grid">
        <article className="panel panel-span-2">
          <header className="panel-header">
            <div>
              <h3>Мгновенный бэкап</h3>
              <p className="muted-text">
                Создаёт архив и загружает его в Google Drive, если интеграция включена.
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" disabled={loading} type="button" onClick={() => void reload()}>
              Обновить
            </button>
          </header>
          <div className="panel-body btn-row">
            {(Object.keys(SCOPE_LABELS) as BackupScope[]).map((scope) => (
              <button
                key={scope}
                className="btn btn-primary"
                disabled={loading}
                type="button"
                onClick={() => void handleInstantBackup(scope)}
              >
                {SCOPE_LABELS[scope]}
              </button>
            ))}
          </div>
        </article>

        <article className="panel panel-span-2">
          <header className="panel-header">
            <div>
              <h3>Google Drive</h3>
              <p className="muted-text">
                Service account JSON и ID папки. Папку нужно расшарить на email service account с правом редактора.
              </p>
            </div>
          </header>
          <form className="panel-body stack-gap" onSubmit={(event) => void handleSaveSettings(event)}>
            <ol className="muted-text stack-gap" style={{ margin: 0, paddingLeft: "1.2rem" }}>
              <li>
                В Google Cloud Console того же проекта, что и JSON-ключ, включите{" "}
                <strong>Google Drive API</strong> (
                <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" rel="noreferrer" target="_blank">
                  APIs &amp; Services → Library
                </a>
                ).
              </li>
              <li>Создайте service account, скачайте JSON и вставьте его ниже.</li>
              <li>
                Создайте папку в Google Drive и расшарьте её на <code>client_email</code> из JSON (роль «Редактор»).
                Без шаринга Google вернёт «File not found».
              </li>
              <li>
                Вставьте ID папки из URL (
                <code>https://drive.google.com/drive/folders/ЭТОТ_ID</code>
                ) — можно вставить и полную ссылку.
              </li>
            </ol>
            <p>
              Статус ключей:{" "}
              <strong>{settings?.google_credentials_configured ? "заданы" : "не заданы"}</strong>
              {settings?.google_credentials_email ? (
                <span className="muted-text mono-sm"> ({settings.google_credentials_email})</span>
              ) : null}
            </p>
            <label className="form-field">
              <span>ID папки Google Drive</span>
              <input
                className="input mono-sm"
                disabled={loading}
                placeholder="1IRmz8CG9jSIQdggTAVbvQJJXvnkGyH6I или ссылка на папку"
                value={folderId}
                onChange={(event) => setFolderId(event.target.value)}
              />
            </label>
            <label className="form-field">
              <span>JSON service account (оставьте пустым, чтобы не менять)</span>
              <textarea
                className="input"
                disabled={loading}
                rows={6}
                value={serviceAccountJson}
                onChange={(event) => setServiceAccountJson(event.target.value)}
              />
            </label>
            <label className="form-check">
              <input
                checked={uploadEnabled}
                disabled={loading}
                type="checkbox"
                onChange={(event) => setUploadEnabled(event.target.checked)}
              />
              <span>Автоматически загружать архивы в Google Drive</span>
            </label>
            <div className="btn-row">
              <button className="btn btn-primary" disabled={loading} type="submit">
                Сохранить
              </button>
              <button
                className="btn btn-secondary"
                disabled={loading}
                type="button"
                onClick={() => void handleTestDrive()}
              >
                Проверить доступ
              </button>
              <button
                className="btn btn-secondary"
                disabled={loading || !settings?.google_credentials_configured}
                type="button"
                onClick={() => {
                  if (window.confirm("Удалить сохранённый JSON service account?")) {
                    void updateBackupSettings(adminToken, { google_service_account_json: "" })
                      .then((next) => {
                        applySettings(next);
                        setMessage("JSON service account удалён.");
                      })
                      .catch((err) => {
                        setError(err instanceof Error ? err.message : "Не удалось удалить ключ.");
                      });
                  }
                }}
              >
                Очистить ключ
              </button>
            </div>
          </form>
        </article>

        <article className="panel panel-span-2">
          <header className="panel-header">
            <div>
              <h3>Расписание</h3>
              <p className="muted-text">
                Celery Beat проверяет расписание каждые 15 минут (UTC). Последний запуск:{" "}
                {formatDateTime(settings?.last_scheduled_run_at ?? null)}
              </p>
            </div>
          </header>
          <div className="panel-body stack-gap">
            <label className="form-check">
              <input
                checked={scheduleEnabled}
                disabled={loading}
                type="checkbox"
                onChange={(event) => setScheduleEnabled(event.target.checked)}
              />
              <span>Включить автоматические бэкапы</span>
            </label>
            <label className="form-field">
              <span>Частота</span>
              <select
                className="input"
                disabled={loading}
                value={scheduleFrequency}
                onChange={(event) => setScheduleFrequency(event.target.value as BackupScheduleFrequency)}
              >
                <option value="daily">Ежедневно</option>
                <option value="weekly">Еженедельно</option>
                <option value="every_6h">Каждые 6 часов</option>
                <option value="every_12h">Каждые 12 часов</option>
              </select>
            </label>
            <div className="dashboard-grid client-grid">
              <label className="form-field">
                <span>Час UTC</span>
                <input
                  className="input"
                  disabled={loading || scheduleFrequency === "every_6h" || scheduleFrequency === "every_12h"}
                  max={23}
                  min={0}
                  type="number"
                  value={scheduleHourUtc}
                  onChange={(event) => setScheduleHourUtc(Number(event.target.value))}
                />
              </label>
              <label className="form-field">
                <span>День недели</span>
                <select
                  className="input"
                  disabled={loading || scheduleFrequency !== "weekly"}
                  value={scheduleWeekday}
                  onChange={(event) => setScheduleWeekday(Number(event.target.value))}
                >
                  {WEEKDAY_LABELS.map((label, index) => (
                    <option key={label} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Локальных копий хранить</span>
                <input
                  className="input"
                  disabled={loading}
                  max={100}
                  min={1}
                  type="number"
                  value={retentionCount}
                  onChange={(event) => setRetentionCount(Number(event.target.value))}
                />
              </label>
            </div>
            <div className="stack-gap">
              <span>Что бэкапить по расписанию</span>
              <div className="btn-row">
                {(Object.keys(SCOPE_LABELS) as BackupScope[]).map((scope) => (
                  <label key={scope} className="form-check">
                    <input
                      checked={scheduleScopes.includes(scope)}
                      disabled={loading}
                      type="checkbox"
                      onChange={() => toggleScheduleScope(scope)}
                    />
                    <span>{SCOPE_LABELS[scope]}</span>
                  </label>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" disabled={loading} type="button" onClick={() => void saveSettings()}>
              Сохранить расписание
            </button>
          </div>
        </article>
      </section>

      <section className="panel panel-span-2">
        <header className="panel-header">
          <div>
            <h3>История бэкапов</h3>
            <p className="muted-text">Последние задачи: локальный архив и ссылка на Google Drive.</p>
          </div>
        </header>
        <div className="panel-body table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Когда</th>
                <th>Объём</th>
                <th>Тип</th>
                <th>Источник</th>
                <th>Статус</th>
                <th>Файл</th>
                <th>Google Drive</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted-text">
                    Бэкапов пока нет.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id}>
                    <td>{formatDateTime(job.created_at)}</td>
                    <td>{formatBytes(job.file_size_bytes)}</td>
                    <td>{SCOPE_LABELS[job.scope]}</td>
                    <td>{job.trigger === "scheduled" ? "По расписанию" : "Вручную"}</td>
                    <td>
                      <span className={job.status === "failed" ? "error-text" : undefined}>
                        {STATUS_LABELS[job.status]}
                      </span>
                      {job.error_message ? (
                        <div className="muted-text mono-sm wrap-break">{job.error_message}</div>
                      ) : null}
                    </td>
                    <td className="mono-sm">{job.file_name ?? "—"}</td>
                    <td>
                      {job.google_drive_url ? (
                        <a href={job.google_drive_url} rel="noreferrer" target="_blank">
                          Открыть
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

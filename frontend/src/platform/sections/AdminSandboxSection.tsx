import { FormEvent, useMemo, useState } from "react";

import type {
  MerchantSandboxCreatePayload,
  MerchantSandboxCreateResponse,
  MerchantSandboxSummary,
  SandboxPlatformSettings,
} from "../../api";

type AdminSandboxSectionProps = {
  loading: boolean;
  sandboxes: MerchantSandboxSummary[];
  settings: SandboxPlatformSettings | null;
  lastCreate: MerchantSandboxCreateResponse | null;
  onRefresh: () => void;
  onCreate: (payload: MerchantSandboxCreatePayload) => void;
  onUpdateCfToken: (cloudflareApiToken: string | null | undefined) => void;
  onProvisionDns: (sandboxId: string, ipv4: string) => void;
  onDestroy: (sandboxId: string) => void;
  onDismissCreate: () => void;
};

export function AdminSandboxSection({
  loading,
  sandboxes,
  settings,
  lastCreate,
  onRefresh,
  onCreate,
  onUpdateCfToken,
  onProvisionDns,
  onDestroy,
  onDismissCreate,
}: AdminSandboxSectionProps) {
  const [label, setLabel] = useState("");
  const [zone, setZone] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [newToken, setNewToken] = useState("");
  const [ipv4BySandbox, setIpv4BySandbox] = useState<Record<string, string>>({});

  const sorted = useMemo(
    () => [...sandboxes].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [sandboxes],
  );

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const payload: MerchantSandboxCreatePayload = {
      label: label.trim(),
      dns_parent_zone: zone.trim(),
      desired_subdomain: subdomain.trim().toLowerCase(),
    };
    if (payload.label.length < 2 || payload.dns_parent_zone.length < 3 || !payload.desired_subdomain) {
      return;
    }
    onCreate(payload);
    setLabel("");
    setZone("");
    setSubdomain("");
  }

  return (
    <div className="console-section-stack">
      <section className="dashboard-grid client-grid">
        <article className="panel panel-span-2">
          <header className="panel-header">
            <div>
              <h3>Cloudflare API</h3>
              <p className="muted-text">
                Токен с правами на DNS выбранной зоны. Хранится в БД в зашифрованном виде.
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" disabled={loading} type="button" onClick={onRefresh}>
              Обновить
            </button>
          </header>
          <div className="panel-body stack-gap">
            <p>
              Статус:{" "}
              <strong>{settings?.cloudflare_token_configured ? "токен задан" : "не задан"}</strong>
              {settings?.cloudflare_token_masked ? (
                <span className="muted-text mono-sm"> ({settings.cloudflare_token_masked})</span>
              ) : null}
            </p>
            <label className="form-field">
              <span>Новый API-токен</span>
              <input
                autoComplete="off"
                className="input"
                disabled={loading}
                type="password"
                value={newToken}
                onChange={(event) => setNewToken(event.target.value)}
              />
            </label>
            <div className="btn-row">
              <button
                className="btn btn-primary"
                disabled={loading || !newToken.trim()}
                type="button"
                onClick={() => {
                  onUpdateCfToken(newToken.trim());
                  setNewToken("");
                }}
              >
                Сохранить токен
              </button>
              <button
                className="btn btn-secondary"
                disabled={loading}
                type="button"
                onClick={() => {
                  if (window.confirm("Удалить сохранённый токен Cloudflare для песочниц?")) {
                    onUpdateCfToken("");
                  }
                }}
              >
                Очистить токен
              </button>
            </div>
          </div>
        </article>

        <article className="panel panel-span-2">
          <header className="panel-header">
            <div>
              <h3>Новая песочница</h3>
              <p className="muted-text">После создания сохраните enrollment-токен и учётные данные с владельца.</p>
            </div>
          </header>
          <form className="panel-body stack-gap" onSubmit={submitCreate}>
            <label className="form-field">
              <span>Подпись</span>
              <input
                className="input"
                disabled={loading}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </label>
            <label className="form-field">
              <span>DNS-зона (как в Cloudflare)</span>
              <input
                className="input"
                disabled={loading}
                placeholder="example.com"
                value={zone}
                onChange={(event) => setZone(event.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Поддомен</span>
              <input
                className="input"
                disabled={loading}
                placeholder="sb-demo"
                value={subdomain}
                onChange={(event) => setSubdomain(event.target.value)}
              />
            </label>
            <button className="btn btn-primary" disabled={loading} type="submit">
              Создать
            </button>
          </form>
        </article>
      </section>

      {lastCreate ? (
        <section className="panel panel-span-2">
          <header className="panel-header">
            <h3>Секреты новой песочницы</h3>
            <button className="btn btn-secondary btn-sm" type="button" onClick={onDismissCreate}>
              Скрыть
            </button>
          </header>
          <div className="panel-body mono-sm wrap-break stack-gap">
            <p>
              <strong>ID:</strong> {lastCreate.id}
            </p>
            <p>
              <strong>Enrollment (до истечения срока):</strong> {lastCreate.enrollment_token}
            </p>
            <p>
              <strong>API public:</strong> {lastCreate.api_public_key}
            </p>
            <p>
              <strong>API secret:</strong> {lastCreate.api_secret_key}
            </p>
            <p>
              <strong>Владелец:</strong> {lastCreate.owner_email} / {lastCreate.owner_password}
            </p>
            <p className="muted-text">
              Внутренний URL API для агента: {lastCreate.public_api_base_url}
            </p>
          </div>
        </section>
      ) : null}

      <section className="dashboard-grid client-grid">
        <article className="panel panel-span-2">
          <header className="panel-header">
            <h3>Список песочниц</h3>
            <button className="btn btn-secondary btn-sm" disabled={loading} type="button" onClick={onRefresh}>
              Обновить список
            </button>
          </header>
          <div className="panel-body">
            {sorted.length === 0 ? (
              <p className="muted-text">Пока нет записей.</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Подпись</th>
                      <th>FQDN</th>
                      <th>Статус</th>
                      <th>Origin IP</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row) => {
                      const fqdn = `${row.desired_subdomain}.${row.dns_parent_zone}`;
                      const ipv4 = ipv4BySandbox[row.id] ?? "";
                      return (
                        <tr key={row.id}>
                          <td>{row.label}</td>
                          <td className="mono-sm">{fqdn}</td>
                          <td>{row.status}</td>
                          <td>{row.origin_ipv4 ?? "—"}</td>
                          <td>
                            <div className="stack-gap">
                              <input
                                className="input"
                                disabled={loading}
                                placeholder="IPv4 origin"
                                value={ipv4}
                                onChange={(event) =>
                                  setIpv4BySandbox((prev) => ({ ...prev, [row.id]: event.target.value }))
                                }
                              />
                              <div className="btn-row">
                                <button
                                  className="btn btn-primary btn-sm"
                                  disabled={loading || !ipv4.trim()}
                                  type="button"
                                  onClick={() => onProvisionDns(row.id, ipv4.trim())}
                                >
                                  DNS + webhook
                                </button>
                                <button
                                  className="ghost-button danger-soft"
                                  disabled={loading}
                                  type="button"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        "Удалить песочницу и все данные тенанта безвозвратно?",
                                      )
                                    ) {
                                      onDestroy(row.id);
                                    }
                                  }}
                                >
                                  Удалить
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

import type { FormEvent } from "react";

import type { TenantCreatePayload, TenantCreateResponse, TenantItem } from "../../api";

type AdminClientsSectionProps = {
  mode: "clients" | "requests";
  loading: boolean;
  tenantForm: TenantCreatePayload;
  createdTenant: TenantCreateResponse | null;
  tenants: TenantItem[];
  selectedTenantId: string | null;
  onCreateTenant: (event: FormEvent<HTMLFormElement>) => void;
  onTenantFormChange: (next: TenantCreatePayload) => void;
  onOpenTenant: (tenantId: string) => void;
  onApproveTenant: (tenantId: string) => void;
  onRejectTenant: (tenantId: string) => void;
};

export function AdminClientsSection({
  mode,
  loading,
  tenantForm,
  createdTenant,
  tenants,
  selectedTenantId,
  onCreateTenant,
  onTenantFormChange,
  onOpenTenant,
  onApproveTenant,
  onRejectTenant,
}: AdminClientsSectionProps) {
  const pendingTenants = tenants.filter((tenant) => tenant.status === "pending_review");
  const visibleTenants = mode === "requests" ? pendingTenants : tenants;

  return (
    <section className={`dashboard-grid ${mode === "requests" ? "client-grid" : "admin-grid"}`}>
      {mode === "clients" ? (
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Ручное создание</p>
              <h2>Создать клиента вручную</h2>
            </div>
          </div>
          <form className="form" onSubmit={onCreateTenant}>
            <label>
              <span>Название компании</span>
              <input
                value={tenantForm.company_name}
                onChange={(event) =>
                  onTenantFormChange({ ...tenantForm, company_name: event.target.value })
                }
              />
            </label>
            <label>
              <span>Имя владельца</span>
              <input
                value={tenantForm.owner_full_name}
                onChange={(event) =>
                  onTenantFormChange({ ...tenantForm, owner_full_name: event.target.value })
                }
              />
            </label>
            <label>
              <span>Email владельца</span>
              <input
                type="email"
                value={tenantForm.owner_email}
                onChange={(event) =>
                  onTenantFormChange({ ...tenantForm, owner_email: event.target.value })
                }
              />
            </label>
            <label>
              <span>Домен</span>
              <input
                value={tenantForm.domain}
                onChange={(event) => onTenantFormChange({ ...tenantForm, domain: event.target.value })}
              />
            </label>
            <button className="primary-button" disabled={loading} type="submit">
              {loading ? "Создаем..." : "Создать клиента"}
            </button>
          </form>
          {createdTenant ? (
            <div className="result-box">
              <strong>Клиент создан вручную</strong>
              <p>Invite token: {createdTenant.invite_token}</p>
              <p>Public key: {createdTenant.api_public_key}</p>
              <p>Secret key: {createdTenant.api_secret_key}</p>
            </div>
          ) : null}
        </article>
      ) : null}

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Заявки и модерация</p>
            <h2>Список клиентов</h2>
          </div>
        </div>
        <div className="tenant-list">
          {visibleTenants.length === 0 ? (
            <p className="muted-text">Пока нет клиентов.</p>
          ) : (
            visibleTenants.map((tenant) => (
              <article
                className={`tenant-card ${selectedTenantId === tenant.id ? "tenant-card-active" : ""}`}
                key={tenant.id}
              >
                <div>
                  <strong>{tenant.name}</strong>
                  <p>{tenant.owner_email}</p>
                  <p>Комментарий: {tenant.review_comment ?? "Нет"}</p>
                </div>
                <div className="tenant-meta">
                  <span>{tenant.slug}</span>
                  <span>{tenant.status}</span>
                  <button className="ghost-button" onClick={() => onOpenTenant(tenant.id)} type="button">
                    Открыть страницу
                  </button>
                  {tenant.status === "pending_review" ? (
                    <div className="action-row">
                      <button className="primary-button" onClick={() => onApproveTenant(tenant.id)} type="button">
                        Одобрить
                      </button>
                      <button className="ghost-button" onClick={() => onRejectTenant(tenant.id)} type="button">
                        Отклонить
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </article>
    </section>
  );
}

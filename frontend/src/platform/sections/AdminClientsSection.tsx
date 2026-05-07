import { type FormEvent, useMemo, useState } from "react";

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
  onDeleteTenant: (tenantId: string) => void;
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
  onDeleteTenant,
}: AdminClientsSectionProps) {
  const [expandCreate, setExpandCreate] = useState(true);
  const [search, setSearch] = useState("");

  const pendingTenants = tenants.filter((tenant) => tenant.status === "pending_review");
  const baseList = mode === "requests" ? pendingTenants : tenants;

  const visibleTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return baseList;
    }
    return baseList.filter((t) => {
      const haystack = `${t.name} ${t.slug} ${t.owner_email ?? ""} ${t.status ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [baseList, search]);

  return (
    <section className={`pw-clients-layout ${mode === "requests" ? "pw-clients-layout-requests" : ""}`}>
      {mode === "clients" ? (
        <aside className="panel pw-clients-sidebar">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Создание</p>
              <h2>Вручную</h2>
            </div>
            <button
              aria-expanded={expandCreate}
              className="ghost-button pw-collapsible-trigger"
              onClick={() => setExpandCreate((v) => !v)}
              type="button"
            >
              {expandCreate ? "Свернуть" : "Развернуть"}
            </button>
          </div>
          {expandCreate ? (
            <>
              <div className="pw-fieldset">
                <div className="pw-fieldset-cap">
                  <p className="pw-fieldset-title">Реквизиты клиента</p>
                  <p className="pw-fieldset-desc">
                    После создания появится инвайт и временные ключи API — передайте владельцу по защищённому каналу.
                  </p>
                </div>
                <div className="pw-fieldset-body">
                  <form className="form pw-clients-create-form" onSubmit={onCreateTenant}>
                    <div className="pw-form-fields pw-form-fields-stack-sm">
                <label>
                  <span>Компания</span>
                  <input
                    value={tenantForm.company_name}
                    onChange={(event) =>
                      onTenantFormChange({ ...tenantForm, company_name: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Владелец</span>
                  <input
                    value={tenantForm.owner_full_name}
                    onChange={(event) =>
                      onTenantFormChange({ ...tenantForm, owner_full_name: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Email</span>
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
                    onChange={(event) =>
                      onTenantFormChange({ ...tenantForm, domain: event.target.value })
                    }
                  />
                </label>
                    </div>
                    <div className="pw-form-actions">
                <button className="primary-button pw-btn-primary-soft" disabled={loading} type="submit">
                  {loading ? "Создаём…" : "Создать клиента"}
                </button>
                    </div>
              </form>
                </div>
              </div>
              {createdTenant ? (
                <div className="result-box pw-create-result">
                  <strong className="pw-create-result-title">Клиент создан</strong>
                  <p className="muted-text mono-sm">invite: {createdTenant.invite_token}</p>
                  <p className="muted-text mono-sm wrap-break">pk: {createdTenant.api_public_key}</p>
                  <p className="muted-text mono-sm wrap-break">sk: {createdTenant.api_secret_key}</p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="muted-text">Форму можно развернуть кнопкой выше.</p>
          )}
        </aside>
      ) : null}

      <article className="panel pw-clients-main">
        <div className="panel-header pw-clients-main-header">
          <div>
            <p className="eyebrow">{mode === "requests" ? "Модерация" : "Каталог"}</p>
            <h2>{mode === "requests" ? "Ожидающие заявки" : "Список клиентов"}</h2>
          </div>
          <label className="pw-search-field">
            <span className="sr-only">Поиск по списку</span>
            <input
              className="pw-search-input"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию, slug, email…"
              type="search"
              value={search}
            />
          </label>
        </div>

        <div className="tenant-list pw-client-list-relaxed">
          {visibleTenants.length === 0 ? (
            <p className="muted-text">{search.trim() ? "Ничего не найдено." : "Пока нет клиентов."}</p>
          ) : (
            visibleTenants.map((tenant) => (
              <article
                className={`tenant-card pw-tenant-card-row ${selectedTenantId === tenant.id ? "tenant-card-active" : ""}`}
                key={tenant.id}
              >
                <div className="pw-tenant-primary">
                  <strong>{tenant.name}</strong>
                  <p className="muted-text">{tenant.owner_email}</p>
                  <p className="muted-text small-comment">Комментарий: {tenant.review_comment ?? "нет"}</p>
                </div>
                <div className="tenant-meta pw-tenant-meta-col">
                  <span className="pw-tenant-chip">{tenant.slug}</span>
                  <span className={`pw-status-pill pw-status-${tenant.status}`}>{tenant.status}</span>
                  <div className="pw-tenant-actions">
                    <button className="ghost-button" onClick={() => onOpenTenant(tenant.id)} type="button">
                      Открыть карточку
                    </button>
                    <button className="ghost-button danger-soft" onClick={() => onDeleteTenant(tenant.id)} type="button">
                      Удалить
                    </button>
                  </div>
                  {tenant.status === "pending_review" ? (
                    <div className="action-row pw-moderate-row">
                      <button className="primary-button pw-btn-compact" onClick={() => onApproveTenant(tenant.id)} type="button">
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

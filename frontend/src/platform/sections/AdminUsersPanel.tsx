import { FormEvent, useEffect, useMemo, useState } from "react";

import type {
  AdminUserCreatePayload,
  AdminUserItem,
  AdminUserUpdatePayload,
  TenantItem,
  UserRoleDefinition,
} from "../../api";

type AdminUsersPanelProps = {
  users: AdminUserItem[];
  roles: UserRoleDefinition[];
  tenants: TenantItem[];
  loading: boolean;
  onCreate: (payload: AdminUserCreatePayload) => void;
  onUpdate: (userId: string, payload: AdminUserUpdatePayload) => void;
};

type UserDraft = {
  full_name: string;
  role: string;
  tenant_id: string | null;
  status: "invited" | "active" | "suspended";
  reset_two_factor: boolean;
};

const STATUS_OPTIONS: Array<"invited" | "active" | "suspended"> = [
  "invited",
  "active",
  "suspended",
];

export function AdminUsersPanel({
  users,
  roles,
  tenants,
  loading,
  onCreate,
  onUpdate,
}: AdminUsersPanelProps) {
  const [createForm, setCreateForm] = useState<AdminUserCreatePayload>({
    email: "",
    full_name: "",
    role: "platform_admin",
    tenant_id: null,
    status: "invited",
    password: "",
    create_invite: true,
  });
  const [drafts, setDrafts] = useState<Record<string, UserDraft>>({});

  const roleMap = useMemo(() => {
    const map = new Map<string, UserRoleDefinition>();
    for (const role of roles) {
      map.set(role.role, role);
    }
    return map;
  }, [roles]);

  useEffect(() => {
    const next: Record<string, UserDraft> = {};
    for (const user of users) {
      next[user.id] = {
        full_name: user.full_name,
        role: user.role,
        tenant_id: user.tenant_id,
        status: (user.status as "invited" | "active" | "suspended") ?? "invited",
        reset_two_factor: false,
      };
    }
    setDrafts(next);
  }, [users]);

  function roleScope(roleKey: string): "platform" | "tenant" | null {
    return roleMap.get(roleKey)?.scope ?? null;
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const scope = roleScope(createForm.role);
    const tenant_id = scope === "tenant" ? createForm.tenant_id : null;
    onCreate({
      ...createForm,
      tenant_id,
      password: createForm.password?.trim() ? createForm.password : undefined,
    });
  }

  return (
    <article className="panel panel-span-2">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Команда платформы</p>
          <h2>Роли и учетные записи</h2>
        </div>
      </div>

      <div className="result-box">
        {roles.map((role) => (
          <p key={role.role}>
            <strong>{role.label}</strong> ({role.role}) - {role.description}
          </p>
        ))}
      </div>

      <form className="form" onSubmit={handleCreate}>
        <div className="form-grid form-grid-2">
          <label>
            <span>Email</span>
            <input
              value={createForm.email}
              onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
              required
              type="email"
            />
          </label>
          <label>
            <span>ФИО</span>
            <input
              value={createForm.full_name}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, full_name: event.target.value }))
              }
              required
              type="text"
            />
          </label>
          <label>
            <span>Роль</span>
            <select
              value={createForm.role}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  role: event.target.value,
                }))
              }
            >
              {roles.map((role) => (
                <option key={role.role} value={role.role}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Статус</span>
            <select
              value={createForm.status}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  status: event.target.value as "invited" | "active" | "suspended",
                }))
              }
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          {roleScope(createForm.role) === "tenant" ? (
            <label>
              <span>Клиент (tenant)</span>
              <select
                value={createForm.tenant_id ?? ""}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    tenant_id: event.target.value || null,
                  }))
                }
                required
              >
                <option value="">Выберите клиента</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            <span>Пароль (опционально)</span>
            <input
              value={createForm.password ?? ""}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              minLength={8}
              placeholder="если пусто - сгенерируется временный"
              type="password"
            />
          </label>
          <label className="switch-row">
            <span>Сгенерировать invite-token</span>
            <input
              checked={createForm.create_invite}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  create_invite: event.target.checked,
                }))
              }
              type="checkbox"
            />
          </label>
        </div>
        <button className="primary-button" disabled={loading} type="submit">
          {loading ? "Создаем..." : "Создать пользователя"}
        </button>
      </form>

      <div className="tenant-list" style={{ marginTop: 16 }}>
        {users.map((user) => {
          const draft = drafts[user.id];
          if (!draft) {
            return null;
          }
          const draftScope = roleScope(draft.role);
          return (
            <article className="tenant-card" key={user.id}>
              <div style={{ width: "100%" }}>
                <strong>{user.email}</strong>
                <p>ID: {user.id}</p>
                <p>Последний вход: {user.last_login_at ?? "еще не входил"}</p>
                <div className="form-grid form-grid-2">
                  <label>
                    <span>ФИО</span>
                    <input
                      value={draft.full_name}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [user.id]: { ...draft, full_name: event.target.value },
                        }))
                      }
                      type="text"
                    />
                  </label>
                  <label>
                    <span>Роль</span>
                    <select
                      value={draft.role}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [user.id]: { ...draft, role: event.target.value },
                        }))
                      }
                    >
                      {roles.map((role) => (
                        <option key={role.role} value={role.role}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Статус</span>
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [user.id]: {
                            ...draft,
                            status: event.target.value as "invited" | "active" | "suspended",
                          },
                        }))
                      }
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  {draftScope === "tenant" ? (
                    <label>
                      <span>Клиент (tenant)</span>
                      <select
                        value={draft.tenant_id ?? ""}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [user.id]: {
                              ...draft,
                              tenant_id: event.target.value || null,
                            },
                          }))
                        }
                        required
                      >
                        <option value="">Выберите клиента</option>
                        {tenants.map((tenant) => (
                          <option key={tenant.id} value={tenant.id}>
                            {tenant.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="switch-row">
                    <span>Сбросить 2FA при сохранении</span>
                    <input
                      checked={draft.reset_two_factor}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [user.id]: {
                            ...draft,
                            reset_two_factor: event.target.checked,
                          },
                        }))
                      }
                      type="checkbox"
                    />
                  </label>
                </div>
                <div className="action-row-inline">
                  <button
                    className="primary-button"
                    disabled={loading}
                    onClick={() =>
                      onUpdate(user.id, {
                        full_name: draft.full_name,
                        role: draft.role,
                        status: draft.status,
                        tenant_id: draftScope === "tenant" ? draft.tenant_id : null,
                        reset_two_factor: draft.reset_two_factor || undefined,
                      })
                    }
                    type="button"
                  >
                    {loading ? "Сохраняем..." : "Сохранить"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </article>
  );
}

import { FormEvent, useEffect, useMemo, useState } from "react";

import type {
  AdminUserCreatePayload,
  AdminUserItem,
  AdminUserUpdatePayload,
  UserRoleDefinition,
} from "../../api";

type AdminUsersPanelProps = {
  users: AdminUserItem[];
  roles: UserRoleDefinition[];
  loading: boolean;
  currentUserId: string;
  canManageUsers: boolean;
  onCreate: (payload: AdminUserCreatePayload) => void;
  onUpdate: (userId: string, payload: AdminUserUpdatePayload) => void;
  onDelete: (userId: string) => void;
};

type UserDraft = {
  full_name: string;
  role: string;
  status: "invited" | "active" | "suspended";
  password: string;
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
  loading,
  currentUserId,
  canManageUsers,
  onCreate,
  onUpdate,
  onDelete,
}: AdminUsersPanelProps) {
  const platformRoles = useMemo(
    () => roles.filter((role) => role.scope === "platform"),
    [roles],
  );
  const defaultRole = platformRoles[0]?.role ?? "platform_admin";

  const [createForm, setCreateForm] = useState<AdminUserCreatePayload>({
    email: "",
    full_name: "",
    role: defaultRole,
    tenant_id: null,
    status: "invited",
    password: "",
    create_invite: true,
  });
  const [drafts, setDrafts] = useState<Record<string, UserDraft>>({});

  useEffect(() => {
    if (!platformRoles.some((role) => role.role === createForm.role)) {
      setCreateForm((current) => ({ ...current, role: defaultRole, tenant_id: null }));
    }
  }, [createForm.role, defaultRole, platformRoles]);

  useEffect(() => {
    const next: Record<string, UserDraft> = {};
    for (const user of users) {
      next[user.id] = {
        full_name: user.full_name,
        role: user.role,
        status: (user.status as "invited" | "active" | "suspended") ?? "invited",
        password: "",
        reset_two_factor: false,
      };
    }
    setDrafts(next);
  }, [users]);

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({
      ...createForm,
      tenant_id: null,
      password: createForm.password?.trim() ? createForm.password : undefined,
    });
  }

  function handleDelete(user: AdminUserItem) {
    const confirmed = window.confirm(
      `Удалить администратора ${user.email}? Это действие необратимо.`,
    );
    if (!confirmed) {
      return;
    }
    onDelete(user.id);
  }

  return (
    <article className="panel panel-span-2">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Команда платформы</p>
          <h2>Администраторы и роли</h2>
        </div>
      </div>

      <div className="result-box">
        {platformRoles.map((role) => (
          <p key={role.role}>
            <strong>{role.label}</strong> ({role.role}) - {role.description}
          </p>
        ))}
      </div>

      {canManageUsers ? (
        <form className="pw-admin-users-create" onSubmit={handleCreate}>
          <fieldset className="pw-fieldset">
            <legend className="sr-only">Создание администратора платформы</legend>
            <div className="pw-fieldset-cap">
              <h3 className="pw-fieldset-title">Новый администратор</h3>
              <p className="pw-fieldset-desc">
                Учётная запись с платформенной ролью для доступа в консоль администратора.
              </p>
            </div>
            <div className="pw-fieldset-body">
              <div className="pw-form-fields form-grid-2">
                <label>
                  <span>Email</span>
                  <input
                    value={createForm.email}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, email: event.target.value }))
                    }
                    required
                    type="email"
                    autoComplete="off"
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
                    {platformRoles.map((role) => (
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
                <label>
                  <span>Пароль (опционально)</span>
                  <span className="pw-field-hint">
                    Если пусто — будет сгенерирован временный пароль.
                  </span>
                  <input
                    value={createForm.password ?? ""}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    minLength={8}
                    placeholder="минимум 8 символов"
                    type="password"
                    autoComplete="new-password"
                  />
                </label>
                <label className="pw-switch pw-field-toggle-row">
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
              <div className="pw-form-actions">
                <button className="primary-button" disabled={loading} type="submit">
                  {loading ? "Создаем..." : "Создать администратора"}
                </button>
              </div>
            </div>
          </fieldset>
        </form>
      ) : (
        <p className="muted-text">У вашей роли нет прав на создание и изменение администраторов.</p>
      )}

      <div className="tenant-list" style={{ marginTop: 16 }}>
        {users.length === 0 ? (
          <p className="muted-text">Администраторы платформы пока не добавлены.</p>
        ) : null}
        {users.map((user) => {
          const draft = drafts[user.id];
          if (!draft) {
            return null;
          }
          const isSelf = user.id === currentUserId;
          return (
            <article className="tenant-card" key={user.id}>
              <div className="pw-tenant-user-edit">
                <strong>{user.email}</strong>
                <p>ID: {user.id}</p>
                <p>2FA: {user.totp_enabled ? "включена" : "выключена"}</p>
                <p>Последний вход: {user.last_login_at ?? "еще не входил"}</p>
                <div className="pw-form-fields form-grid-2 pw-admin-user-grid">
                  <label>
                    <span>ФИО</span>
                    <input
                      value={draft.full_name}
                      disabled={!canManageUsers}
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
                      disabled={!canManageUsers || isSelf}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [user.id]: { ...draft, role: event.target.value },
                        }))
                      }
                    >
                      {platformRoles.map((role) => (
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
                      disabled={!canManageUsers || isSelf}
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
                  <label>
                    <span>Новый пароль</span>
                    <span className="pw-field-hint">Оставьте пустым, если менять не нужно.</span>
                    <input
                      value={draft.password}
                      disabled={!canManageUsers}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [user.id]: { ...draft, password: event.target.value },
                        }))
                      }
                      minLength={8}
                      placeholder="минимум 8 символов"
                      type="password"
                      autoComplete="new-password"
                    />
                  </label>
                  <label className="pw-switch pw-field-toggle-row">
                    <span>Сбросить 2FA при сохранении</span>
                    <input
                      checked={draft.reset_two_factor}
                      disabled={!canManageUsers}
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
                {canManageUsers ? (
                  <div className="pw-form-actions pw-form-actions--compact">
                    <button
                      className="primary-button"
                      disabled={loading}
                      onClick={() =>
                        onUpdate(user.id, {
                          full_name: draft.full_name,
                          role: isSelf ? undefined : draft.role,
                          status: isSelf ? undefined : draft.status,
                          tenant_id: null,
                          password: draft.password.trim() ? draft.password : undefined,
                          reset_two_factor: draft.reset_two_factor || undefined,
                        })
                      }
                      type="button"
                    >
                      {loading ? "Сохраняем..." : "Сохранить"}
                    </button>
                    <button
                      className="ghost-button"
                      disabled={loading || isSelf}
                      onClick={() => handleDelete(user)}
                      title={isSelf ? "Нельзя удалить собственную учётную запись" : undefined}
                      type="button"
                    >
                      Удалить
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </article>
  );
}

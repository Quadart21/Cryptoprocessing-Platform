import { useEffect, useState } from "react";

import type { ApiKeyItem, ProjectAdminUpdatePayload, ProjectItem } from "../../../api";
import { CopyableIdentifier } from "../../../components/CopyableIdentifier";
import { EnumSelect, StatusPill } from "./fields";
import {
  PROJECT_STATUSES,
  apiKeyStatusLabel,
  checkoutLabel,
  projectPayloadFromProject,
  projectStatusLabel,
  projectStatusTone,
  sameProjectPayload,
  tenantStatusTone,
} from "./model";

type ClientCardProjectsProps = {
  apiKeys: ApiKeyItem[];
  loading: boolean;
  projectForms: Record<string, ProjectAdminUpdatePayload>;
  projects: ProjectItem[];
  tenantId: string;
  onPatchProject: (projectId: string, patch: Partial<ProjectAdminUpdatePayload>) => void;
  onRegenerateKey: (apiKeyId: string) => void;
  onRevokeKey: (apiKeyId: string) => void;
  onSaveProject: (projectId: string) => void;
};

export function ClientCardProjects({
  apiKeys,
  loading,
  projectForms,
  projects,
  tenantId,
  onPatchProject,
  onRegenerateKey,
  onRevokeKey,
  onSaveProject,
}: ClientCardProjectsProps) {
  const onlyProjectId = projects.length === 1 ? (projects[0]?.id ?? null) : null;
  const [openId, setOpenId] = useState<string | null>(onlyProjectId);

  useEffect(() => {
    setOpenId(onlyProjectId);
  }, [tenantId, onlyProjectId]);

  return (
    <div className="cc-stack">
      <section>
        <div className="cc-section-head">
          <h3>Проекты</h3>
          <span className="cc-hint">{projects.length === 0 ? "нет проектов" : `${projects.length}`}</span>
        </div>
        {projects.length === 0 ? (
          <p className="cc-empty">У клиента пока нет проектов.</p>
        ) : (
          <div className="cc-project-list">
            {projects.map((project) => {
              const form = projectForms[project.id];
              const open = openId === project.id;
              const keys = apiKeys.filter((key) => key.project_id === project.id);
              const dirty = form ? !sameProjectPayload(form, projectPayloadFromProject(project)) : false;
              return (
                <article className={`cc-project ${open ? "cc-project-open" : ""}`} key={project.id}>
                  <button
                    aria-expanded={open}
                    className="cc-project-head"
                    onClick={() => setOpenId(open ? null : project.id)}
                    type="button"
                  >
                    <span className="cc-project-name">
                      <strong>{form?.name || project.name}</strong>
                      {dirty ? <span className="cc-dirty">не сохранено</span> : null}
                    </span>
                    <StatusPill tone={projectStatusTone(form?.status || project.status)}>
                      {projectStatusLabel(form?.status || project.status)}
                    </StatusPill>
                    <span className="cc-row-sub">
                      {project.domain || "домен не задан"} · {checkoutLabel(form?.checkout_delivery || project.checkout_delivery)} · ключей:{" "}
                      {keys.length}
                      {(form?.webhook_url ?? project.webhook_url) ? " · webhook" : ""}
                    </span>
                  </button>
                  {open && form ? (
                    <form
                      autoComplete="off"
                      className="form cc-project-body"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!dirty || loading) return;
                        onSaveProject(project.id);
                      }}
                    >
                      <div className="form-grid-2 pw-form-fields">
                        <label>
                          <span>Название</span>
                          <input
                            onChange={(event) => onPatchProject(project.id, { name: event.target.value })}
                            value={form.name}
                          />
                        </label>
                        <label>
                          <span>Домен</span>
                          <input
                            onChange={(event) => onPatchProject(project.id, { domain: event.target.value })}
                            spellCheck={false}
                            value={form.domain}
                          />
                        </label>
                        <label>
                          <span>Формат checkout</span>
                          <span className="pw-field-hint">Меняет только администратор.</span>
                          <select
                            onChange={(event) =>
                              onPatchProject(project.id, {
                                checkout_delivery: event.target.value as ProjectAdminUpdatePayload["checkout_delivery"],
                              })
                            }
                            value={form.checkout_delivery}
                          >
                            <option value="payment_page">Платёжная ссылка (/pay/…)</option>
                            <option value="h2h">H2H (адрес и QR в API)</option>
                            {form.checkout_delivery === "both" ? (
                              <option value="both">Ссылка и H2H</option>
                            ) : null}
                          </select>
                        </label>
                        <label>
                          <span>Статус</span>
                          <EnumSelect
                            labelOf={projectStatusLabel}
                            onChange={(status) => onPatchProject(project.id, { status })}
                            options={PROJECT_STATUSES}
                            value={form.status}
                          />
                        </label>
                        <label className="panel-span-2">
                          <span>Webhook URL</span>
                          <span className="pw-field-hint">Пустое значение отключает доставку на URL.</span>
                          <input
                            onChange={(event) =>
                              onPatchProject(project.id, {
                                webhook_url: event.target.value.trim() === "" ? null : event.target.value,
                              })
                            }
                            placeholder="https://"
                            spellCheck={false}
                            value={form.webhook_url ?? ""}
                          />
                        </label>
                        <label className="panel-span-2">
                          <span>Описание</span>
                          <textarea
                            onChange={(event) =>
                              onPatchProject(project.id, {
                                description: event.target.value.trim() === "" ? null : event.target.value,
                              })
                            }
                            rows={3}
                            value={form.description ?? ""}
                          />
                        </label>
                      </div>
                      <div className="pw-form-actions">
                        <span className="muted-text">
                          {project.has_webhook_secret ? "Секрет webhook задан" : "Секрет webhook не задан"}
                        </span>
                        <button className="primary-button" disabled={!dirty || loading} type="submit">
                          Сохранить проект
                        </button>
                      </div>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="cc-section-head">
          <h3>API-ключи</h3>
          <span className="cc-hint">{apiKeys.length === 0 ? "не выданы" : String(apiKeys.length)}</span>
        </div>
        {apiKeys.length === 0 ? (
          <p className="cc-empty">Ключи ещё не выданы.</p>
        ) : (
          <div className="cc-list">
            {apiKeys.map((apiKey) => {
              const project = projects.find((item) => item.id === apiKey.project_id);
              const revoked = apiKey.status === "revoked";
              return (
                <article className={`cc-key ${revoked ? "cc-key-revoked" : ""}`} key={apiKey.id}>
                  <div className="cc-key-main">
                    <CopyableIdentifier label={project?.name ?? "Проект не найден"} value={apiKey.public_key} variant="inline" />
                    <StatusPill tone={tenantStatusTone(apiKey.status)}>{apiKeyStatusLabel(apiKey.status)}</StatusPill>
                  </div>
                  <div className="cc-key-actions">
                    <button
                      className="ghost-button"
                      disabled={loading}
                      onClick={() => onRegenerateKey(apiKey.id)}
                      type="button"
                    >
                      Перевыпустить
                    </button>
                    {revoked ? null : (
                      <button
                        className="ghost-button danger-soft"
                        disabled={loading}
                        onClick={() => onRevokeKey(apiKey.id)}
                        type="button"
                      >
                        Отозвать
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

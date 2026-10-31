import type { TenantAdminUpdatePayload, TenantDetailResponse } from "../../../api";
import { EnumSelect, StatusPill } from "./fields";
import {
  CURRENCY_SUGGESTIONS,
  PLAN_SUGGESTIONS,
  TENANT_STATUSES,
  TIMEZONE_SUGGESTIONS,
  sameTenantPayload,
  tenantPayloadFromDetail,
  tenantStatusLabel,
  tenantStatusTone,
  userStatusLabel,
} from "./model";

type ClientCardProfileProps = {
  detail: TenantDetailResponse;
  form: TenantAdminUpdatePayload;
  loading: boolean;
  onDelete: () => void;
  onPatch: (patch: Partial<TenantAdminUpdatePayload>) => void;
  onResetPassword: () => void;
  onResetTwoFactor: () => void;
  onSubmit: () => void;
};

export function ClientCardProfile({
  detail,
  form,
  loading,
  onDelete,
  onPatch,
  onResetPassword,
  onResetTwoFactor,
  onSubmit,
}: ClientCardProfileProps) {
  const dirty = !sameTenantPayload(form, tenantPayloadFromDetail(detail));

  return (
    <div className="cc-stack">
      <form
        autoComplete="off"
        className="form cc-card"
        onSubmit={(event) => {
          event.preventDefault();
          if (!dirty || loading) return;
          onSubmit();
        }}
      >
        <div className="cc-section-head">
          <h3>Профиль</h3>
          {dirty ? <span className="cc-dirty">Есть несохранённые изменения</span> : null}
        </div>
        <p className="cc-hint">Название, slug, тариф и данные владельца сохраняются одной кнопкой.</p>
        <div className="form-grid-2 pw-form-fields">
          <label>
            <span>Компания</span>
            <input
              autoComplete="off"
              onChange={(event) => onPatch({ company_name: event.target.value })}
              value={form.company_name}
            />
          </label>
          <label>
            <span>Slug</span>
            <span className="pw-field-hint">Идентификатор в URL, без пробелов.</span>
            <input
              autoComplete="off"
              onChange={(event) => onPatch({ slug: event.target.value })}
              spellCheck={false}
              value={form.slug}
            />
          </label>
          <label>
            <span>Статус</span>
            <EnumSelect
              labelOf={tenantStatusLabel}
              onChange={(status) => onPatch({ status })}
              options={TENANT_STATUSES}
              value={form.status}
            />
          </label>
          <label>
            <span>Тариф</span>
            <input
              autoComplete="off"
              list="cc-plan-suggestions"
              onChange={(event) => onPatch({ plan: event.target.value })}
              value={form.plan}
            />
            <datalist id="cc-plan-suggestions">
              {PLAN_SUGGESTIONS.map((plan) => (
                <option key={plan} value={plan} />
              ))}
            </datalist>
          </label>
          <label>
            <span>Часовой пояс</span>
            <input
              autoComplete="off"
              list="cc-timezone-suggestions"
              onChange={(event) => onPatch({ timezone: event.target.value })}
              spellCheck={false}
              value={form.timezone}
            />
            <datalist id="cc-timezone-suggestions">
              {TIMEZONE_SUGGESTIONS.map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
          </label>
          <label>
            <span>Базовая валюта</span>
            <input
              autoComplete="off"
              list="cc-currency-suggestions"
              onChange={(event) => onPatch({ base_currency: event.target.value })}
              spellCheck={false}
              value={form.base_currency}
            />
            <datalist id="cc-currency-suggestions">
              {CURRENCY_SUGGESTIONS.map((currency) => (
                <option key={currency} value={currency} />
              ))}
            </datalist>
          </label>
          <label>
            <span>Email владельца</span>
            <input
              autoComplete="off"
              inputMode="email"
              onChange={(event) => onPatch({ owner_email: event.target.value })}
              spellCheck={false}
              value={form.owner_email}
            />
          </label>
          <label>
            <span>Имя владельца</span>
            <input
              autoComplete="off"
              onChange={(event) => onPatch({ owner_full_name: event.target.value })}
              value={form.owner_full_name}
            />
          </label>
          <label className="panel-span-2">
            <span>Комментарий модерации</span>
            <span className="pw-field-hint">Виден в списке клиентов и в шапке карточки.</span>
            <textarea
              onChange={(event) =>
                onPatch({ review_comment: event.target.value.trim() === "" ? null : event.target.value })
              }
              rows={3}
              value={form.review_comment ?? ""}
            />
          </label>
        </div>
        <div className="pw-form-actions">
          <span className="muted-text">{dirty ? "Сохраните, чтобы применить правки." : "Профиль совпадает с сохранённым."}</span>
          <button className="primary-button" disabled={!dirty || loading} type="submit">
            Сохранить профиль
          </button>
        </div>
      </form>

      <section className="cc-card">
        <h3>Доступ владельца</h3>
        <p className="cc-hint">
          Сейчас: {detail.owner?.email || "email не задан"} ·{" "}
          <StatusPill tone={tenantStatusTone(detail.owner?.status ?? "")}>
            {userStatusLabel(detail.owner?.status ?? "")}
          </StatusPill>
        </p>
        <div className="cc-actions">
          <button className="primary-button" disabled={loading} onClick={onResetPassword} type="button">
            Сбросить пароль
          </button>
          <button className="ghost-button" disabled={loading} onClick={onResetTwoFactor} type="button">
            Сбросить 2FA
          </button>
        </div>
      </section>

      <section className="cc-danger">
        <div>
          <h3>Удаление клиента</h3>
          <p>
            Удаление проходит только без финансовой истории: нет инвойсов, активных проектов, заявок на вывод и
            баланса. Если история уже есть, поставьте статус «Заблокирован».
          </p>
        </div>
        <button className="ghost-button danger-soft" disabled={loading} onClick={onDelete} type="button">
          Удалить клиента
        </button>
      </section>
    </div>
  );
}

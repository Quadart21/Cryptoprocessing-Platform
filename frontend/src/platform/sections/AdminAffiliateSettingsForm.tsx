import { type FormEvent } from "react";

import {
  DEFAULT_AFFILIATE_CONFIG,
  type AffiliateProgramConfig,
} from "../../api/partner";

type AdminAffiliateSettingsFormProps = {
  config: AffiliateProgramConfig;
  busy: boolean;
  canEdit: boolean;
  onChange: (next: AffiliateProgramConfig) => void;
  onSubmit: (event: FormEvent) => void;
};

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="affiliate-toggle">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export function AdminAffiliateSettingsForm({
  config,
  busy,
  canEdit,
  onChange,
  onSubmit,
}: AdminAffiliateSettingsFormProps) {
  const cfg = { ...DEFAULT_AFFILIATE_CONFIG, ...config };
  const set = <K extends keyof AffiliateProgramConfig>(key: K, value: AffiliateProgramConfig[K]) => {
    onChange({ ...cfg, [key]: value });
  };

  return (
    <section className="panel panel-span-2">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Superadmin</p>
          <h2>Ультранастройки партнёрской программы</h2>
          <p className="muted-text">
            Каждый рычаг экономики, атрибуции, антифрода и выплат. Сохранение доступно только
            супер-админу.
          </p>
        </div>
      </div>

      {!canEdit ? (
        <p className="muted-text">Просмотр. Изменять конфиг может только роль superadmin.</p>
      ) : null}

      <form className="affiliate-settings-form" onSubmit={onSubmit}>
        <div className="affiliate-settings-grid">
          <fieldset disabled={!canEdit || busy}>
            <legend>Программа</legend>
            <Toggle
              label="Программа включена"
              checked={cfg.program_enabled}
              onChange={(v) => set("program_enabled", v)}
            />
            <Toggle
              label="Публичная заявка на партнёрство"
              checked={cfg.public_apply_enabled}
              onChange={(v) => set("public_apply_enabled", v)}
            />
            <Toggle
              label="Авто-одобрение партнёров"
              checked={cfg.auto_approve_partners}
              onChange={(v) => set("auto_approve_partners", v)}
            />
            <Toggle
              label="Кабинет доступен в статусе pending"
              checked={cfg.partner_cabinet_when_pending}
              onChange={(v) => set("partner_cabinet_when_pending", v)}
            />
            <label>
              Длина referral-кода
              <input
                type="number"
                min={4}
                max={16}
                value={cfg.referral_code_length}
                onChange={(e) => set("referral_code_length", Number(e.target.value))}
              />
            </label>
          </fieldset>

          <fieldset disabled={!canEdit || busy}>
            <legend>Экономика</legend>
            <label>
              % от platform fee (default)
              <input
                type="number"
                step="0.01"
                value={cfg.commission_percent}
                onChange={(e) => set("commission_percent", e.target.value)}
              />
            </label>
            <Toggle
              label="Разрешить override % на партнёра"
              checked={cfg.commission_override_allowed}
              onChange={(v) => set("commission_override_allowed", v)}
            />
            <label>
              Min override %
              <input
                type="number"
                step="0.01"
                value={cfg.commission_override_min_percent}
                onChange={(e) => set("commission_override_min_percent", e.target.value)}
              />
            </label>
            <label>
              Max override %
              <input
                type="number"
                step="0.01"
                value={cfg.commission_override_max_percent}
                onChange={(e) => set("commission_override_max_percent", e.target.value)}
              />
            </label>
            <label>
              Мин. platform fee для начисления (USDT)
              <input
                type="number"
                step="0.01"
                value={cfg.min_platform_fee_to_accrue_usdt}
                onChange={(e) => set("min_platform_fee_to_accrue_usdt", e.target.value)}
              />
            </label>
            <Toggle
              label="CPA включён (заготовка)"
              checked={cfg.cpa_enabled}
              onChange={(v) => set("cpa_enabled", v)}
            />
            <label>
              CPA amount USDT
              <input
                type="number"
                step="0.01"
                value={cfg.cpa_amount_usdt}
                onChange={(e) => set("cpa_amount_usdt", e.target.value)}
              />
            </label>
            <label>
              CPA trigger
              <select
                value={cfg.cpa_trigger}
                onChange={(e) => set("cpa_trigger", e.target.value)}
              >
                <option value="first_volume">first_volume</option>
                <option value="approved">approved</option>
              </select>
            </label>
          </fieldset>

          <fieldset disabled={!canEdit || busy}>
            <legend>Атрибуция</legend>
            <label>
              Режим
              <select
                value={cfg.attribution_mode}
                onChange={(e) => set("attribution_mode", e.target.value)}
              >
                <option value="lifetime">lifetime</option>
                <option value="fixed_days">fixed_days</option>
              </select>
            </label>
            <label>
              Attribution days (для fixed_days)
              <input
                type="number"
                min={1}
                value={cfg.attribution_days}
                onChange={(e) => set("attribution_days", Number(e.target.value))}
              />
            </label>
            <label>
              Cookie window (дни)
              <input
                type="number"
                min={1}
                value={cfg.cookie_days}
                onChange={(e) => set("cookie_days", Number(e.target.value))}
              />
            </label>
            <label>
              Click mode
              <select value={cfg.click_mode} onChange={(e) => set("click_mode", e.target.value)}>
                <option value="last_click">last_click</option>
                <option value="first_click">first_click</option>
              </select>
            </label>
            <Toggle
              label="Требовать approved-партнёра для атрибуции"
              checked={cfg.require_approved_partner_for_attribution}
              onChange={(v) => set("require_approved_partner_for_attribution", v)}
            />
            <Toggle
              label="Трекать клики pending-партнёров"
              checked={cfg.track_clicks_from_pending_partners}
              onChange={(v) => set("track_clicks_from_pending_partners", v)}
            />
            <Toggle
              label="Морозить attribution после approve tenant"
              checked={cfg.freeze_attribution_after_tenant_approve}
              onChange={(v) => set("freeze_attribution_after_tenant_approve", v)}
            />
          </fieldset>

          <fieldset disabled={!canEdit || busy}>
            <legend>Начисление / Hold</legend>
            <label>
              Hold days
              <input
                type="number"
                min={0}
                value={cfg.hold_days}
                onChange={(e) => set("hold_days", Number(e.target.value))}
              />
            </label>
            <Toggle
              label="Начислять только approved-партнёрам"
              checked={cfg.accrue_only_approved_partners}
              onChange={(v) => set("accrue_only_approved_partners", v)}
            />
            <Toggle
              label="Начислять только approved-tenant"
              checked={cfg.accrue_only_approved_tenants}
              onChange={(v) => set("accrue_only_approved_tenants", v)}
            />
          </fieldset>

          <fieldset disabled={!canEdit || busy}>
            <legend>Выплаты</legend>
            <Toggle
              label="Выплаты включены"
              checked={cfg.payouts_enabled}
              onChange={(v) => set("payouts_enabled", v)}
            />
            <label>
              Мин. выплата USDT
              <input
                type="number"
                step="0.01"
                value={cfg.min_payout_usdt}
                onChange={(e) => set("min_payout_usdt", e.target.value)}
              />
            </label>
            <label>
              Сеть по умолчанию
              <input
                value={cfg.default_payout_network}
                onChange={(e) => set("default_payout_network", e.target.value.toUpperCase())}
              />
            </label>
            <label>
              Разрешённые сети (через запятую)
              <input
                value={cfg.allowed_payout_networks.join(", ")}
                onChange={(e) =>
                  set(
                    "allowed_payout_networks",
                    e.target.value
                      .split(",")
                      .map((item) => item.trim().toUpperCase())
                      .filter(Boolean),
                  )
                }
              />
            </label>
            <Toggle
              label="Адрес обязателен при заявке партнёра"
              checked={cfg.require_payout_address_on_apply}
              onChange={(v) => set("require_payout_address_on_apply", v)}
            />
            <Toggle
              label="Адрес обязателен перед запросом выплаты"
              checked={cfg.require_payout_address_before_request}
              onChange={(v) => set("require_payout_address_before_request", v)}
            />
          </fieldset>

          <fieldset disabled={!canEdit || busy}>
            <legend>Антифрод и UX</legend>
            <Toggle
              label="Блок self-referral по email"
              checked={cfg.block_self_referral_email}
              onChange={(v) => set("block_self_referral_email", v)}
            />
            <Toggle
              label="Блок same email domain"
              checked={cfg.block_same_email_domain}
              onChange={(v) => set("block_same_email_domain", v)}
            />
            <label>
              Free-mail домены (через запятую)
              <textarea
                rows={3}
                value={cfg.self_referral_free_domains.join(", ")}
                onChange={(e) =>
                  set(
                    "self_referral_free_domains",
                    e.target.value
                      .split(",")
                      .map((item) => item.trim().toLowerCase())
                      .filter(Boolean),
                  )
                }
              />
            </label>
            <Toggle
              label="Показывать имена мерчантов партнёру"
              checked={cfg.show_merchant_names_to_partners}
              onChange={(v) => set("show_merchant_names_to_partners", v)}
            />
            <Toggle
              label="Показывать клики в воронке партнёру"
              checked={cfg.show_funnel_clicks_to_partners}
              onChange={(v) => set("show_funnel_clicks_to_partners", v)}
            />
          </fieldset>
        </div>

        {canEdit ? (
          <button type="submit" className="primary-button" disabled={busy}>
            Сохранить ультранастройки
          </button>
        ) : null}
      </form>

      <style>{`
        .affiliate-settings-form { display: grid; gap: 1rem; }
        .affiliate-settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 1rem;
        }
        .affiliate-settings-form fieldset {
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 0.9rem 1rem 1rem;
          display: grid;
          gap: 0.65rem;
        }
        .affiliate-settings-form legend {
          padding: 0 0.35rem;
          font-weight: 600;
        }
        .affiliate-toggle {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          font-size: 0.92rem;
        }
        .affiliate-settings-form label {
          display: grid;
          gap: 0.35rem;
          font-size: 0.9rem;
        }
        .affiliate-settings-form input,
        .affiliate-settings-form select,
        .affiliate-settings-form textarea {
          width: 100%;
        }
      `}</style>
    </section>
  );
}

import { type FormEvent, type ReactNode } from "react";

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

type Choice = { value: string; label: string };

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="aff-field">
      <span className="aff-field-label">{label}</span>
      {children}
      {hint ? <span className="aff-field-hint">{hint}</span> : null}
    </label>
  );
}

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="aff-switch">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="aff-switch-copy">
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <span className="aff-switch-track" aria-hidden="true" />
    </label>
  );
}

function ChoiceField({
  label,
  hint,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  options: Choice[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const known = options.some((option) => option.value === value);
  return (
    <Field hint={hint} label={label}>
      <select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>
        {!known ? <option value={value}>{value}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function splitList(value: string, normalize: (item: string) => string): string[] {
  return value
    .split(",")
    .map((item) => normalize(item.trim()))
    .filter(Boolean);
}

export function AdminAffiliateSettingsForm({
  config,
  busy,
  canEdit,
  onChange,
  onSubmit,
}: AdminAffiliateSettingsFormProps) {
  const cfg = { ...DEFAULT_AFFILIATE_CONFIG, ...config };
  const locked = !canEdit || busy;
  const set = <K extends keyof AffiliateProgramConfig>(key: K, value: AffiliateProgramConfig[K]) => {
    onChange({ ...cfg, [key]: value });
  };
  const lifetime = cfg.attribution_mode !== "fixed_days";

  return (
    <section className="panel panel-span-2 aff-settings">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Партнёрская программа</p>
          <h2>Как партнёр приводит мерчанта и получает долю</h2>
          <p className="muted-text">
            Доля считается от комиссии платформы, не от платежа мерчанта. Здесь задаются срок
            закрепления, ожидание перед выплатой и защита от самопривода. Сохранять может только
            супер-админ.
          </p>
        </div>
      </div>

      {!canEdit ? (
        <p className="aff-readonly">Сейчас только просмотр. Менять настройки может супер-админ.</p>
      ) : null}

      <div className="aff-summary" aria-label="Сводка программы">
        <article>
          <span>Программа</span>
          <strong>{cfg.program_enabled ? "Работает" : "Выключена"}</strong>
        </article>
        <article>
          <span>Доля партнёра</span>
          <strong>{cfg.commission_percent}% от комиссии платформы</strong>
        </article>
        <article>
          <span>Ожидание</span>
          <strong>{cfg.hold_days} дн. до доступной суммы</strong>
        </article>
        <article>
          <span>Выплата от</span>
          <strong>{cfg.payouts_enabled ? `${cfg.min_payout_usdt} USDT` : "Закрыта"}</strong>
        </article>
      </div>

      <form className="aff-settings-form" onSubmit={onSubmit}>
        <div className="aff-grid">
          <fieldset className="aff-card" disabled={locked}>
            <div className="aff-card-head">
              <h3>Кто может стать партнёром</h3>
              <p>Заявка с сайта, одобрение и доступ в кабинет, пока заявка ещё не проверена.</p>
            </div>
            <div className="aff-card-body">
              <SwitchRow
                checked={cfg.program_enabled}
                hint="Новые заявки и новые начисления идут. Уже накопленные суммы никуда не деваются."
                label="Программа работает"
                onChange={(value) => set("program_enabled", value)}
              />
              <SwitchRow
                checked={cfg.public_apply_enabled}
                hint="На сайте есть форма «Стать партнёром». Если выключить, партнёра можно завести только вручную."
                label="Заявка открыта на сайте"
                onChange={(value) => set("public_apply_enabled", value)}
              />
              <SwitchRow
                checked={cfg.auto_approve_partners}
                hint="Заявка сразу становится одобренной, без очереди на проверку."
                label="Одобрять заявки сразу"
                onChange={(value) => set("auto_approve_partners", value)}
              />
              <SwitchRow
                checked={cfg.partner_cabinet_when_pending}
                hint="Человек заходит в кабинет и видит ссылку, пока вы ещё не одобрили заявку."
                label="Кабинет доступен до одобрения"
                onChange={(value) => set("partner_cabinet_when_pending", value)}
              />
              <Field
                hint="Сколько символов в персональной ссылке. Уже выданные коды не переписываются."
                label="Длина реферального кода"
              >
                <input
                  max={16}
                  min={4}
                  type="number"
                  value={cfg.referral_code_length}
                  onChange={(event) => set("referral_code_length", Number(event.target.value))}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="aff-card" disabled={locked}>
            <div className="aff-card-head">
              <h3>Сколько получает партнёр</h3>
              <p>Процент от комиссии платформы. Своя ставка в карточке партнёра может её заменить.</p>
            </div>
            <div className="aff-card-body">
              <Field
                hint="Если у партнёра нет отдельной ставки, берётся это число. 25 — это 25% комиссии платформы, не оборота."
                label="Доля по умолчанию, %"
              >
                <input
                  step="0.01"
                  type="number"
                  value={cfg.commission_percent}
                  onChange={(event) => set("commission_percent", event.target.value)}
                />
              </Field>
              <SwitchRow
                checked={cfg.commission_override_allowed}
                hint="В карточке партнёра можно поставить другой процент в границах ниже."
                label="Разрешить свою ставку"
                onChange={(value) => set("commission_override_allowed", value)}
              />
              <div className="aff-pair">
                <Field hint="Ниже этого процента ставку в карточке поставить нельзя." label="Минимум своей ставки, %">
                  <input
                    disabled={!cfg.commission_override_allowed}
                    step="0.01"
                    type="number"
                    value={cfg.commission_override_min_percent}
                    onChange={(event) => set("commission_override_min_percent", event.target.value)}
                  />
                </Field>
                <Field hint="Выше этого процента ставку в карточке поставить нельзя." label="Максимум своей ставки, %">
                  <input
                    disabled={!cfg.commission_override_allowed}
                    step="0.01"
                    type="number"
                    value={cfg.commission_override_max_percent}
                    onChange={(event) => set("commission_override_max_percent", event.target.value)}
                  />
                </Field>
              </div>
              <Field
                hint="Если комиссия платформы по одному платежу меньше этой суммы, партнёру по нему ничего не пишется."
                label="Не начислять, если комиссия платформы меньше, USDT"
              >
                <input
                  step="0.01"
                  type="number"
                  value={cfg.min_platform_fee_to_accrue_usdt}
                  onChange={(event) => set("min_platform_fee_to_accrue_usdt", event.target.value)}
                />
              </Field>
              <SwitchRow
                checked={cfg.cpa_enabled}
                hint="Фиксированная сумма сверх процента за приведённого мерчанта. Пока это заготовка: в расчёт не входит, пока выключено."
                label="Разовая выплата за мерчанта"
                onChange={(value) => set("cpa_enabled", value)}
              />
              <div className="aff-pair">
                <Field hint="Сколько USDT начислить один раз." label="Сумма разовой выплаты, USDT">
                  <input
                    disabled={!cfg.cpa_enabled}
                    step="0.01"
                    type="number"
                    value={cfg.cpa_amount_usdt}
                    onChange={(event) => set("cpa_amount_usdt", event.target.value)}
                  />
                </Field>
                <ChoiceField
                  disabled={!cfg.cpa_enabled}
                  hint="Момент, когда разовая сумма появляется у партнёра."
                  label="Когда платить разово"
                  options={[
                    { value: "first_volume", label: "После первого оборота мерчанта" },
                    { value: "approved", label: "Сразу после одобрения мерчанта" },
                  ]}
                  value={cfg.cpa_trigger}
                  onChange={(value) => set("cpa_trigger", value)}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="aff-card" disabled={locked}>
            <div className="aff-card-head">
              <h3>За кем закреплён мерчант</h3>
              <p>Человек перешёл по ссылке партнёра. Эти правила решают, кто потом получает долю.</p>
            </div>
            <div className="aff-card-body">
              <ChoiceField
                hint="Навсегда — комиссия идёт этому партнёру, пока мерчант работает. Ограниченный срок — только указанное число дней."
                label="Срок закрепления"
                options={[
                  { value: "lifetime", label: "Навсегда" },
                  { value: "fixed_days", label: "Ограниченный срок" },
                ]}
                value={cfg.attribution_mode}
                onChange={(value) => set("attribution_mode", value)}
              />
              <Field hint="Используется только при ограниченном сроке." label="Дней закрепления">
                <input
                  disabled={lifetime}
                  min={1}
                  type="number"
                  value={cfg.attribution_days}
                  onChange={(event) => set("attribution_days", Number(event.target.value))}
                />
              </Field>
              <Field
                hint="Если человек кликнул ссылку и зарегистрировался не сразу, переход помнится столько дней."
                label="Сколько дней помнить переход"
              >
                <input
                  min={1}
                  type="number"
                  value={cfg.cookie_days}
                  onChange={(event) => set("cookie_days", Number(event.target.value))}
                />
              </Field>
              <ChoiceField
                hint="Если мерчант переходил по ссылкам разных партнёров, засчитывается первый или последний переход."
                label="Какой переход засчитывать"
                options={[
                  { value: "last_click", label: "Последний переход" },
                  { value: "first_click", label: "Первый переход" },
                ]}
                value={cfg.click_mode}
                onChange={(value) => set("click_mode", value)}
              />
              <SwitchRow
                checked={cfg.require_approved_partner_for_attribution}
                hint="Ссылка ещё не одобренного партнёра мерчанта не закрепляет."
                label="Закреплять только одобренных партнёров"
                onChange={(value) => set("require_approved_partner_for_attribution", value)}
              />
              <SwitchRow
                checked={cfg.track_clicks_from_pending_partners}
                hint="Переходы по ссылке всё равно попадают в статистику, даже если партнёр ещё не одобрен."
                label="Считать переходы до одобрения"
                onChange={(value) => set("track_clicks_from_pending_partners", value)}
              />
              <SwitchRow
                checked={cfg.freeze_attribution_after_tenant_approve}
                hint="После одобрения мерчанта другой партнёр его уже не перехватывает."
                label="Не менять партнёра после одобрения мерчанта"
                onChange={(value) => set("freeze_attribution_after_tenant_approve", value)}
              />
            </div>
          </fieldset>

          <fieldset className="aff-card" disabled={locked}>
            <div className="aff-card-head">
              <h3>Когда сумму можно вывести</h3>
              <p>Сначала комиссия ждёт. Потом она становится доступной для заявки на выплату.</p>
            </div>
            <div className="aff-card-body">
              <Field
                hint="Столько дней сумма висит в ожидании. Ноль — доступна сразу после начисления."
                label="Дней ожидания"
              >
                <input
                  min={0}
                  type="number"
                  value={cfg.hold_days}
                  onChange={(event) => set("hold_days", Number(event.target.value))}
                />
              </Field>
              <SwitchRow
                checked={cfg.accrue_only_approved_partners}
                hint="Пока заявка партнёра не одобрена, доля по его мерчантам не копится."
                label="Начислять только одобренным партнёрам"
                onChange={(value) => set("accrue_only_approved_partners", value)}
              />
              <SwitchRow
                checked={cfg.accrue_only_approved_tenants}
                hint="Платежи мерчанта, которого ещё не одобрили, в долю партнёра не входят."
                label="Начислять только по одобренным мерчантам"
                onChange={(value) => set("accrue_only_approved_tenants", value)}
              />
              <SwitchRow
                checked={cfg.payouts_enabled}
                hint="Партнёр может отправить заявку на вывод доступной суммы."
                label="Выплаты открыты"
                onChange={(value) => set("payouts_enabled", value)}
              />
              <Field hint="Заявку на меньшую сумму отправить нельзя." label="Минимальная выплата, USDT">
                <input
                  step="0.01"
                  type="number"
                  value={cfg.min_payout_usdt}
                  onChange={(event) => set("min_payout_usdt", event.target.value)}
                />
              </Field>
              <div className="aff-pair">
                <Field hint="Подставляется в заявке, если партнёр сеть не выбрал." label="Сеть по умолчанию">
                  <input
                    value={cfg.default_payout_network}
                    onChange={(event) => set("default_payout_network", event.target.value.toUpperCase())}
                  />
                </Field>
                <Field hint="Список через запятую, например TRC20, ERC20." label="Разрешённые сети">
                  <input
                    value={cfg.allowed_payout_networks.join(", ")}
                    onChange={(event) =>
                      set("allowed_payout_networks", splitList(event.target.value, (item) => item.toUpperCase()))
                    }
                  />
                </Field>
              </div>
              <SwitchRow
                checked={cfg.require_payout_address_on_apply}
                hint="Без адреса кошелька заявку «Стать партнёром» отправить нельзя."
                label="Кошелёк обязателен уже в заявке"
                onChange={(value) => set("require_payout_address_on_apply", value)}
              />
              <SwitchRow
                checked={cfg.require_payout_address_before_request}
                hint="Выплату нельзя запросить, пока в кабинете нет адреса."
                label="Кошелёк обязателен перед выплатой"
                onChange={(value) => set("require_payout_address_before_request", value)}
              />
            </div>
          </fieldset>

          <fieldset className="aff-card aff-card-wide" disabled={locked}>
            <div className="aff-card-head">
              <h3>Защита и что видно партнёру</h3>
              <p>Не даём привести самого себя и решаем, какие имена и переходы партнёр видит в кабинете.</p>
            </div>
            <div className="aff-card-body">
              <SwitchRow
                checked={cfg.block_self_referral_email}
                hint="Если email мерчанта совпал с email партнёра, закрепления не будет."
                label="Нельзя привести свой же email"
                onChange={(value) => set("block_self_referral_email", value)}
              />
              <SwitchRow
                checked={cfg.block_same_email_domain}
                hint="Одинаковый корпоративный домен тоже считается самоприводом. Бесплатные почты из списка ниже не считаются одним доменом."
                label="Нельзя привести тот же рабочий домен"
                onChange={(value) => set("block_same_email_domain", value)}
              />
              <Field
                hint="Эти домены общие, поэтому gmail у партнёра и gmail у мерчанта — не один и тот же «рабочий» домен."
                label="Бесплатные почты, через запятую"
              >
                <textarea
                  rows={3}
                  value={cfg.self_referral_free_domains.join(", ")}
                  onChange={(event) =>
                    set(
                      "self_referral_free_domains",
                      splitList(event.target.value, (item) => item.toLowerCase()),
                    )
                  }
                />
              </Field>
              <div className="aff-pair">
                <SwitchRow
                  checked={cfg.show_merchant_names_to_partners}
                  hint="В кабинете партнёр видит, кого привёл. Если выключить — только обезличенные строки."
                  label="Показывать имена мерчантов"
                  onChange={(value) => set("show_merchant_names_to_partners", value)}
                />
                <SwitchRow
                  checked={cfg.show_funnel_clicks_to_partners}
                  hint="Партнёр видит, сколько раз открывали его ссылку, ещё до регистрации."
                  label="Показывать переходы по ссылке"
                  onChange={(value) => set("show_funnel_clicks_to_partners", value)}
                />
              </div>
            </div>
          </fieldset>
        </div>

        {canEdit ? (
          <div className="aff-save">
            <p>Новые платежи считаются уже по этим правилам. Уже начисленные суммы не пересчитываются.</p>
            <button className="primary-button" disabled={busy} type="submit">
              Сохранить настройки
            </button>
          </div>
        ) : null}
      </form>
    </section>
  );
}

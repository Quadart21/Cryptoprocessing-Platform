import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import type { CurrentUser } from "../api";
import {
  createPartnerPayout,
  fetchPartnerCommissions,
  fetchPartnerDashboard,
  fetchPartnerMerchants,
  fetchPartnerPayouts,
  updatePartnerProfile,
  type PartnerCommissionRow,
  type PartnerDashboard,
  type PartnerMerchantRow,
  type PartnerPayoutRow,
} from "../api/partner";
import { ClientSectionHeader } from "../components/client/ClientSectionHeader";
import { CopyableIdentifier } from "../components/CopyableIdentifier";
import { DashboardRail } from "../components/layout/DashboardRail";
import { DashboardStatusMessages } from "../components/layout/DashboardStatusMessages";
import { SectionContextChips } from "../components/layout/SectionContextChips";
import { formatDecimal, truncateMiddle } from "../utils/format";
import {
  isPartnerSection,
  PARTNER_MENU_GROUPS,
  PARTNER_SECTION_META,
  type PartnerSection,
} from "./partnerConfig";

type PartnerDashboardRootProps = {
  token: string;
  user: CurrentUser;
  onLogout: () => void;
};

function money(value: number | string): string {
  return formatDecimal(Number(value));
}

function statusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "На модерации";
    case "approved":
      return "Одобрен";
    case "rejected":
      return "Отклонён";
    case "suspended":
      return "Приостановлен";
    case "pending_hold":
      return "Hold";
    case "available":
      return "Доступно";
    case "locked_payout":
      return "В заявке";
    case "paid":
      return "Выплачено";
    case "clawed_back":
      return "Clawback";
    case "pending_review":
      return "На проверке";
    default:
      return status;
  }
}

export function PartnerDashboardRoot({ token, user, onLogout }: PartnerDashboardRootProps) {
  const [section, setSection] = useState<PartnerSection>("overview");
  const [dashboard, setDashboard] = useState<PartnerDashboard | null>(null);
  const [merchants, setMerchants] = useState<PartnerMerchantRow[]>([]);
  const [commissions, setCommissions] = useState<PartnerCommissionRow[]>([]);
  const [payouts, setPayouts] = useState<PartnerPayoutRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    display_name: "",
    contact_telegram: "",
    payout_address: "",
    payout_network: "TRC20",
  });

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dash = await fetchPartnerDashboard(token);
      setDashboard(dash);
      setProfileForm({
        display_name: dash.display_name,
        contact_telegram: dash.contact_telegram ?? "",
        payout_address: dash.payout_address ?? "",
        payout_network: dash.payout_network || "TRC20",
      });
      if (dash.status === "approved") {
        const [merchantRows, commissionRows, payoutRows] = await Promise.all([
          fetchPartnerMerchants(token),
          fetchPartnerCommissions(token),
          fetchPartnerPayouts(token),
        ]);
        setMerchants(merchantRows);
        setCommissions(commissionRows);
        setPayouts(payoutRows);
      } else {
        setMerchants([]);
        setCommissions([]);
        setPayouts([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить кабинет партнёра.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleSaveProfile(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updatePartnerProfile(token, profileForm);
      setDashboard(updated);
      setSuccess("Профиль сохранён.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить профиль.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePayout() {
    if (!dashboard) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await createPartnerPayout(token, {
        destination_address: profileForm.payout_address || undefined,
        network: profileForm.payout_network || undefined,
      });
      setSuccess("Заявка на выплату отправлена.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать выплату.");
    } finally {
      setLoading(false);
    }
  }

  const referralUrl =
    typeof window !== "undefined" && dashboard
      ? `${window.location.origin}${dashboard.referral_link_path}`
      : dashboard?.referral_link_path ?? "";

  const sectionMeta = PARTNER_SECTION_META[section];

  const contextChips = useMemo(
    () => [
      { label: "Роль", value: user.role },
      { label: "Статус", value: dashboard ? statusLabel(dashboard.status) : "—" },
      {
        label: "Код",
        value: dashboard?.referral_code ? truncateMiddle(dashboard.referral_code) : "—",
      },
      {
        label: "Доступно",
        value: dashboard ? `${money(dashboard.available_usdt)} USDT` : "—",
      },
      {
        label: "Комиссия",
        value: dashboard ? `${money(dashboard.commission_percent)}%` : "—",
      },
    ],
    [dashboard, user.role],
  );

  const shortcuts: Array<{ section: PartnerSection; label: string; hint: string }> = [
    { section: "referral", label: "Ссылка", hint: "Скопировать referral URL" },
    { section: "commissions", label: "Начисления", hint: "Hold и available комиссии" },
    { section: "payouts", label: "Выплаты", hint: "Запросить вывод USDT" },
    { section: "profile", label: "Реквизиты", hint: "Адрес и сеть для выплат" },
  ];

  return (
    <div className="app-frame merchant-app-frame mw-root partner-app-frame">
      <a className="merchant-skip-link" href="#partner-main">
        К содержимому
      </a>
      <DashboardRail
        activeKey={section}
        groups={PARTNER_MENU_GROUPS}
        topbarSubtitle={sectionMeta.title}
        onSelect={(key) => {
          if (isPartnerSection(key)) {
            setSection(key);
          }
        }}
        role="client"
        user={user}
        onLogout={onLogout}
      />

      <main
        className="dashboard-shell client-dashboard-shell merchant-shell-main mw-shell-main"
        id="partner-main"
      >
        <DashboardStatusMessages
          error={error}
          success={success}
          onDismissError={() => setError(null)}
          onDismissSuccess={() => setSuccess(null)}
        />

        <div className="client-cabinet mw-workspace">
          <ClientSectionHeader
            description={sectionMeta.description}
            group={sectionMeta.group}
            title={sectionMeta.title}
          />
          <SectionContextChips items={contextChips} />

          {!dashboard ? (
            <section className="mc-surface">
              <p className="muted-text">{loading ? "Загрузка кабинета…" : "Нет данных."}</p>
            </section>
          ) : dashboard.status !== "approved" ? (
            <div className="console-section-stack mc-page-stack">
              <section className="mc-surface">
                <header className="mc-surface-header">
                  <p className="mc-surface-eyebrow">Статус заявки</p>
                  <h2 className="mc-surface-title">{statusLabel(dashboard.status)}</h2>
                  <p className="mc-surface-desc">
                    {dashboard.review_comment ||
                      "После одобрения администратором здесь появятся реферальная ссылка, статистика и выплаты."}
                  </p>
                </header>
                <CopyableIdentifier
                  label="Referral code"
                  value={dashboard.referral_code}
                  hint="Код станет активным после одобрения партнёра."
                />
              </section>
            </div>
          ) : (
            <div className="console-section-stack mc-page-stack">
              {section === "overview" ? (
                <>
                  <section className="mc-bento">
                    <article className="mc-stat">
                      <span className="mc-stat-label">Доступно</span>
                      <strong className="mc-stat-value">
                        {money(dashboard.available_usdt)} USDT
                      </strong>
                    </article>
                    <article className="mc-stat">
                      <span className="mc-stat-label">В холде</span>
                      <strong className="mc-stat-value">
                        {money(dashboard.pending_hold_usdt)} USDT
                      </strong>
                    </article>
                    <article className="mc-stat">
                      <span className="mc-stat-label">В заявке</span>
                      <strong className="mc-stat-value">
                        {money(dashboard.locked_payout_usdt)} USDT
                      </strong>
                    </article>
                    <article className="mc-stat">
                      <span className="mc-stat-label">Выплачено</span>
                      <strong className="mc-stat-value">{money(dashboard.paid_usdt)} USDT</strong>
                    </article>
                    <article className="mc-stat">
                      <span className="mc-stat-label">Клики</span>
                      <strong className="mc-stat-value">{dashboard.clicks}</strong>
                    </article>
                    <article className="mc-stat">
                      <span className="mc-stat-label">Регистрации</span>
                      <strong className="mc-stat-value">{dashboard.registrations}</strong>
                    </article>
                    <article className="mc-stat">
                      <span className="mc-stat-label">Одобрено</span>
                      <strong className="mc-stat-value">{dashboard.approved_merchants}</strong>
                    </article>
                    <article className="mc-stat">
                      <span className="mc-stat-label">С оборотом</span>
                      <strong className="mc-stat-value">{dashboard.merchants_with_volume}</strong>
                    </article>
                  </section>

                  <div className="mc-split mc-split--balanced">
                    <article className="mc-surface">
                      <header className="mc-surface-header">
                        <p className="mc-surface-eyebrow">Навигация</p>
                        <h2 className="mc-surface-title">Быстрые разделы</h2>
                        <p className="mc-surface-desc">
                          Те же маршруты кабинета, что у мерчанта: сводка → операции → профиль.
                        </p>
                      </header>
                      <div className="mc-tiles">
                        {shortcuts.map((shortcut) => (
                          <button
                            className="mc-tile"
                            key={shortcut.section}
                            type="button"
                            onClick={() => setSection(shortcut.section)}
                          >
                            <span className="mc-tile-title">{shortcut.label}</span>
                            <span className="mc-tile-desc">{shortcut.hint}</span>
                          </button>
                        ))}
                      </div>
                    </article>

                    <article className="mc-surface">
                      <header className="mc-surface-header">
                        <p className="mc-surface-eyebrow">Условия</p>
                        <h2 className="mc-surface-title">Ваша экономика</h2>
                        <p className="mc-surface-desc">
                          Доля считается от platform fee приведённых мерчантов.
                        </p>
                      </header>
                      <div className="mc-checklist">
                        <div className="mc-checklist-item">
                          <div>
                            <strong>Комиссия</strong>
                            <p>{money(dashboard.commission_percent)}% от platform fee</p>
                          </div>
                          <span className="mc-badge mc-badge-ok">active</span>
                        </div>
                        <div className="mc-checklist-item">
                          <div>
                            <strong>Hold</strong>
                            <p>{dashboard.hold_days} дней до доступности</p>
                          </div>
                          <span className="mc-badge mc-badge-ok">ok</span>
                        </div>
                        <div className="mc-checklist-item">
                          <div>
                            <strong>Мин. выплата</strong>
                            <p>{money(dashboard.min_payout_usdt)} USDT</p>
                          </div>
                          <span
                            className={`mc-badge ${
                              Number(dashboard.available_usdt) >= Number(dashboard.min_payout_usdt)
                                ? "mc-badge-ok"
                                : "mc-badge-warn"
                            }`}
                          >
                            {Number(dashboard.available_usdt) >= Number(dashboard.min_payout_usdt)
                              ? "можно"
                              : "ниже минимума"}
                          </span>
                        </div>
                      </div>
                      <div className="action-row" style={{ marginTop: "1rem" }}>
                        <button
                          type="button"
                          className="primary-button"
                          disabled={loading || Number(dashboard.available_usdt) <= 0}
                          onClick={() => void handlePayout()}
                        >
                          Запросить выплату
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => setSection("referral")}
                        >
                          К ссылке
                        </button>
                      </div>
                    </article>
                  </div>
                </>
              ) : null}

              {section === "referral" ? (
                <article className="mc-surface">
                  <header className="mc-surface-header">
                    <p className="mc-surface-eyebrow">Attribution</p>
                    <h2 className="mc-surface-title">{dashboard.referral_code}</h2>
                    <p className="mc-surface-desc">
                      Cookie window: {dashboard.cookie_days} дн. · hold {dashboard.hold_days} дн. ·{" "}
                      {money(dashboard.commission_percent)}% от platform fee
                    </p>
                  </header>
                  <CopyableIdentifier
                    label="Referral link"
                    value={referralUrl}
                    hint="Передайте ссылку мерчанту — код сохранится до регистрации."
                  />
                  <div className="action-row" style={{ marginTop: "1rem" }}>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void navigator.clipboard.writeText(referralUrl)}
                    >
                      Скопировать ссылку
                    </button>
                  </div>
                </article>
              ) : null}

              {section === "merchants" ? (
                <article className="mc-surface">
                  <header className="mc-surface-header">
                    <p className="mc-surface-eyebrow">Клиенты</p>
                    <h2 className="mc-surface-title">Приведённые мерчанты</h2>
                    <p className="mc-surface-desc">
                      Только агрегаты: статус, platform fee и ваша комиссия.
                    </p>
                  </header>
                  <div className="tenant-list">
                    {merchants.length === 0 ? (
                      <p className="muted-text">Пока нет приведённых клиентов.</p>
                    ) : (
                      merchants.map((item) => (
                        <article className="tenant-card" key={item.tenant_id}>
                          <div>
                            <strong>{item.tenant_name}</strong>
                            <p>Статус: {item.tenant_status}</p>
                            <p>Platform fee: {money(item.platform_fee_usdt)} USDT</p>
                            <p>Ваша комиссия: {money(item.commission_usdt)} USDT</p>
                          </div>
                          <div className="tenant-meta">
                            <span>{new Date(item.created_at).toLocaleDateString()}</span>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </article>
              ) : null}

              {section === "commissions" ? (
                <article className="mc-surface">
                  <header className="mc-surface-header">
                    <p className="mc-surface-eyebrow">Ledger</p>
                    <h2 className="mc-surface-title">Начисления</h2>
                    <p className="mc-surface-desc">
                      Каждая строка — доля от platform fee по confirmed-платежу.
                    </p>
                  </header>
                  <div className="tenant-list">
                    {commissions.length === 0 ? (
                      <p className="muted-text">Начислений пока нет.</p>
                    ) : (
                      commissions.map((item) => (
                        <article className="tenant-card" key={item.id}>
                          <div>
                            <strong>
                              {money(item.commission_amount)} {item.currency}
                            </strong>
                            <p>{item.tenant_name}</p>
                            <p>
                              {money(item.commission_percent)}% от fee{" "}
                              {money(item.platform_fee_amount)}
                            </p>
                          </div>
                          <div className="tenant-meta">
                            <span>{statusLabel(item.status)}</span>
                            <span>{new Date(item.available_at).toLocaleString()}</span>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </article>
              ) : null}

              {section === "payouts" ? (
                <article className="mc-surface">
                  <header className="mc-surface-header">
                    <p className="mc-surface-eyebrow">Withdraw</p>
                    <h2 className="mc-surface-title">Выплаты</h2>
                    <p className="mc-surface-desc">
                      Доступно сейчас: {money(dashboard.available_usdt)} USDT · минимум{" "}
                      {money(dashboard.min_payout_usdt)} USDT
                    </p>
                  </header>
                  <div className="action-row" style={{ marginBottom: "1rem" }}>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={loading || Number(dashboard.available_usdt) <= 0}
                      onClick={() => void handlePayout()}
                    >
                      Запросить выплату
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => setSection("profile")}
                    >
                      Изменить адрес
                    </button>
                  </div>
                  <div className="tenant-list">
                    {payouts.length === 0 ? (
                      <p className="muted-text">Заявок на вывод пока нет.</p>
                    ) : (
                      payouts.map((item) => (
                        <article className="tenant-card" key={item.id}>
                          <div>
                            <strong>
                              {money(item.amount_requested)} {item.currency}
                            </strong>
                            <p>
                              {item.network}: {item.destination_address}
                            </p>
                            {item.review_comment ? <p>{item.review_comment}</p> : null}
                          </div>
                          <div className="tenant-meta">
                            <span>{statusLabel(item.status)}</span>
                            <span>{new Date(item.created_at).toLocaleString()}</span>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </article>
              ) : null}

              {section === "profile" ? (
                <article className="mc-surface">
                  <header className="mc-surface-header">
                    <p className="mc-surface-eyebrow">Аккаунт</p>
                    <h2 className="mc-surface-title">Профиль и реквизиты</h2>
                    <p className="mc-surface-desc">
                      {user.email} · {dashboard.display_name || user.full_name}
                    </p>
                  </header>
                  <form className="form-grid" onSubmit={handleSaveProfile}>
                    <label>
                      Отображаемое имя
                      <input
                        value={profileForm.display_name}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, display_name: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Telegram
                      <input
                        value={profileForm.contact_telegram}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, contact_telegram: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      USDT адрес
                      <input
                        value={profileForm.payout_address}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, payout_address: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Сеть
                      <input
                        value={profileForm.payout_network}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, payout_network: e.target.value })
                        }
                      />
                    </label>
                    <button type="submit" className="primary-button" disabled={loading}>
                      Сохранить
                    </button>
                  </form>
                </article>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

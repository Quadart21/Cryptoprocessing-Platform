import { useCallback, useEffect, useState, type FormEvent } from "react";

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
import { DashboardStatusMessages } from "../components/layout/DashboardStatusMessages";
import { formatDecimal } from "../utils/format";
import type { CurrentUser } from "../api";

type PartnerDashboardRootProps = {
  token: string;
  user: CurrentUser;
  onLogout: () => void;
};

function money(value: number | string): string {
  return formatDecimal(Number(value));
}

export function PartnerDashboardRoot({ token, user, onLogout }: PartnerDashboardRootProps) {
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

  return (
    <div className="console-shell">
      <header className="console-topbar">
        <div>
          <p className="eyebrow">Affiliate</p>
          <h1>Партнёрский кабинет</h1>
          <p className="muted-text">
            {user.email} · {dashboard?.display_name ?? user.full_name}
          </p>
        </div>
        <button type="button" className="ghost-button" onClick={onLogout}>
          Выйти
        </button>
      </header>

      <DashboardStatusMessages
        success={success}
        error={error}
        onDismissSuccess={() => setSuccess(null)}
        onDismissError={() => setError(null)}
      />

      {!dashboard ? (
        <p className="muted-text">{loading ? "Загрузка…" : "Нет данных."}</p>
      ) : dashboard.status !== "approved" ? (
        <section className="panel">
          <p className="eyebrow">Статус заявки</p>
          <h2>
            {dashboard.status === "pending"
              ? "Заявка на модерации"
              : dashboard.status === "rejected"
                ? "Заявка отклонена"
                : "Доступ приостановлен"}
          </h2>
          <p className="muted-text">
            {dashboard.review_comment ||
              "После одобрения администратором здесь появятся реферальная ссылка, статистика и выплаты."}
          </p>
          <p>
            Код: <strong>{dashboard.referral_code}</strong>
          </p>
        </section>
      ) : (
        <div className="console-section-stack">
          <section className="dashboard-grid client-grid">
            <article className="panel">
              <p className="eyebrow">Реферальная ссылка</p>
              <h2>{dashboard.referral_code}</h2>
              <p className="muted-text">{referralUrl}</p>
              <button
                type="button"
                className="primary-button"
                onClick={() => void navigator.clipboard.writeText(referralUrl)}
              >
                Скопировать ссылку
              </button>
              <p className="muted-text" style={{ marginTop: "0.75rem" }}>
                Комиссия {money(dashboard.commission_percent)}% от platform fee · hold{" "}
                {dashboard.hold_days} дн. · мин. выплата {money(dashboard.min_payout_usdt)} USDT
              </p>
            </article>

            <article className="panel">
              <p className="eyebrow">Баланс</p>
              <h2>{money(dashboard.available_usdt)} USDT</h2>
              <p>В холде: {money(dashboard.pending_hold_usdt)} USDT</p>
              <p>В заявке: {money(dashboard.locked_payout_usdt)} USDT</p>
              <p>Выплачено: {money(dashboard.paid_usdt)} USDT</p>
              <button
                type="button"
                className="primary-button"
                disabled={loading || Number(dashboard.available_usdt) <= 0}
                onClick={() => void handlePayout()}
              >
                Запросить выплату
              </button>
            </article>

            <article className="panel">
              <p className="eyebrow">Воронка</p>
              <h2>{dashboard.registrations} регистраций</h2>
              <p>Клики: {dashboard.clicks}</p>
              <p>Одобрено: {dashboard.approved_merchants}</p>
              <p>С оборотом: {dashboard.merchants_with_volume}</p>
            </article>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Профиль</p>
                <h2>Реквизиты выплаты</h2>
              </div>
            </div>
            <form className="form-grid" onSubmit={handleSaveProfile}>
              <label>
                Отображаемое имя
                <input
                  value={profileForm.display_name}
                  onChange={(e) => setProfileForm({ ...profileForm, display_name: e.target.value })}
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
          </section>

          <section className="panel panel-span-2">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Клиенты</p>
                <h2>Приведённые мерчанты</h2>
              </div>
            </div>
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
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="panel panel-span-2">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Начисления</p>
                <h2>Комиссии по платежам</h2>
              </div>
            </div>
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
                        {money(item.commission_percent)}% от fee {money(item.platform_fee_amount)}
                      </p>
                    </div>
                    <div className="tenant-meta">
                      <span>{item.status}</span>
                      <span>{new Date(item.available_at).toLocaleString()}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="panel panel-span-2">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Выплаты</p>
                <h2>История заявок</h2>
              </div>
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
                      <span>{item.status}</span>
                      <span>{new Date(item.created_at).toLocaleString()}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

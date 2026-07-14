import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  fetchAdminPartnerDetail,
  fetchAdminPartnerPayouts,
  fetchAdminPartners,
  fetchAffiliateSettings,
  reviewAdminPartnerPayout,
  updateAdminPartner,
  updateAffiliateSettings,
  type AdminPartnerDetail,
  type AdminPartnerListItem,
  type AffiliateSettings,
  type PartnerPayoutRow,
} from "../../api/partner";
import { formatDecimal } from "../../utils/format";

type AdminPartnersSectionProps = {
  adminToken: string | null;
};

function money(value: number | string | null | undefined): string {
  return formatDecimal(Number(value ?? 0));
}

export function AdminPartnersSection({ adminToken }: AdminPartnersSectionProps) {
  const [partners, setPartners] = useState<AdminPartnerListItem[]>([]);
  const [payouts, setPayouts] = useState<PartnerPayoutRow[]>([]);
  const [selected, setSelected] = useState<AdminPartnerDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [settings, setSettings] = useState<AffiliateSettings>({
    affiliate_commission_percent: 25,
    affiliate_hold_days: 14,
    affiliate_min_payout_usdt: 50,
    affiliate_cookie_days: 60,
  });
  const [commissionInput, setCommissionInput] = useState("");

  const reload = useCallback(async () => {
    if (!adminToken) return;
    setBusy(true);
    setError(null);
    try {
      const [partnerRows, payoutRows, settingsRow] = await Promise.all([
        fetchAdminPartners(adminToken),
        fetchAdminPartnerPayouts(adminToken),
        fetchAffiliateSettings(adminToken),
      ]);
      setPartners(partnerRows);
      setPayouts(payoutRows);
      setSettings(settingsRow);
      if (selectedId) {
        const detail = await fetchAdminPartnerDetail(adminToken, selectedId);
        setSelected(detail);
        setCommissionInput(
          detail.commission_percent != null ? String(detail.commission_percent) : "",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить партнёров.");
    } finally {
      setBusy(false);
    }
  }, [adminToken, selectedId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function openPartner(partnerId: string) {
    if (!adminToken) return;
    setBusy(true);
    setSelectedId(partnerId);
    try {
      const detail = await fetchAdminPartnerDetail(adminToken, partnerId);
      setSelected(detail);
      setCommissionInput(
        detail.commission_percent != null ? String(detail.commission_percent) : "",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось открыть партнёра.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(partnerId: string, status: string) {
    if (!adminToken) return;
    setBusy(true);
    setError(null);
    try {
      await updateAdminPartner(adminToken, partnerId, { status });
      setSuccess(
        status === "approved"
          ? "Партнёр одобрен."
          : status === "rejected"
            ? "Партнёр отклонён."
            : "Статус обновлён.",
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить статус.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCommission(event: FormEvent) {
    event.preventDefault();
    if (!adminToken || !selected) return;
    setBusy(true);
    try {
      if (!commissionInput.trim()) {
        await updateAdminPartner(adminToken, selected.id, { clear_commission_override: true });
      } else {
        await updateAdminPartner(adminToken, selected.id, {
          commission_percent: Number(commissionInput),
        });
      }
      setSuccess("Ставка сохранена.");
      await openPartner(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить ставку.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!adminToken) return;
    setBusy(true);
    try {
      const updated = await updateAffiliateSettings(adminToken, settings);
      setSettings(updated);
      setSuccess("Настройки affiliate сохранены.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить настройки.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewPayout(payoutId: string, action: "approve" | "reject") {
    if (!adminToken) return;
    setBusy(true);
    try {
      await reviewAdminPartnerPayout(adminToken, payoutId, { action });
      setSuccess(action === "approve" ? "Выплата подтверждена." : "Выплата отклонена.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обработать выплату.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="console-section-stack">
      {success ? <p className="success-text">{success}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Affiliate</p>
            <h2>Глобальные настройки программы</h2>
          </div>
        </div>
        <form className="form-grid" onSubmit={saveSettings}>
          <label>
            % от platform fee
            <input
              type="number"
              step="0.01"
              value={settings.affiliate_commission_percent}
              onChange={(e) =>
                setSettings({ ...settings, affiliate_commission_percent: e.target.value })
              }
            />
          </label>
          <label>
            Hold (дни)
            <input
              type="number"
              value={settings.affiliate_hold_days}
              onChange={(e) =>
                setSettings({ ...settings, affiliate_hold_days: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Мин. выплата USDT
            <input
              type="number"
              step="0.01"
              value={settings.affiliate_min_payout_usdt}
              onChange={(e) =>
                setSettings({ ...settings, affiliate_min_payout_usdt: e.target.value })
              }
            />
          </label>
          <label>
            Cookie window (дни)
            <input
              type="number"
              value={settings.affiliate_cookie_days}
              onChange={(e) =>
                setSettings({ ...settings, affiliate_cookie_days: Number(e.target.value) })
              }
            />
          </label>
          <button type="submit" className="primary-button" disabled={busy}>
            Сохранить настройки
          </button>
        </form>
      </section>

      <section className="dashboard-grid client-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Партнёры</p>
              <h2>Заявки и каталог</h2>
            </div>
            <button type="button" className="ghost-button" disabled={busy} onClick={() => void reload()}>
              Обновить
            </button>
          </div>
          <div className="tenant-list">
            {partners.length === 0 ? (
              <p className="muted-text">Партнёров пока нет.</p>
            ) : (
              partners.map((partner) => (
                <article className="tenant-card" key={partner.id}>
                  <div>
                    <strong>{partner.display_name}</strong>
                    <p>{partner.email}</p>
                    <p>
                      Код {partner.referral_code} · {money(partner.effective_commission_percent)}%
                    </p>
                    <p>
                      Available {money(partner.available_usdt)} · regs {partner.registrations}
                    </p>
                  </div>
                  <div className="tenant-meta">
                    <span>{partner.status}</span>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => void openPartner(partner.id)}
                    >
                      Карточка
                    </button>
                    {partner.status === "pending" ? (
                      <div className="action-row">
                        <button
                          type="button"
                          className="primary-button"
                          disabled={busy}
                          onClick={() => void setStatus(partner.id, "approved")}
                        >
                          Одобрить
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={busy}
                          onClick={() => void setStatus(partner.id, "rejected")}
                        >
                          Отклонить
                        </button>
                      </div>
                    ) : null}
                    {partner.status === "approved" ? (
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={busy}
                        onClick={() => void setStatus(partner.id, "suspended")}
                      >
                        Suspend
                      </button>
                    ) : null}
                    {partner.status === "suspended" ? (
                      <button
                        type="button"
                        className="primary-button"
                        disabled={busy}
                        onClick={() => void setStatus(partner.id, "approved")}
                      >
                        Возобновить
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Карточка</p>
              <h2>{selected ? selected.display_name : "Выберите партнёра"}</h2>
            </div>
          </div>
          {!selected ? (
            <p className="muted-text">Откройте карточку из списка слева.</p>
          ) : (
            <>
              <p>{selected.email}</p>
              <p>Telegram: {selected.contact_telegram || "—"}</p>
              <p>
                Кошелёк: {selected.payout_address || "—"} ({selected.payout_network})
              </p>
              <p>Комментарий: {selected.review_comment || "—"}</p>
              <form className="form-grid" onSubmit={saveCommission}>
                <label>
                  Override % (пусто = глобальный)
                  <input
                    value={commissionInput}
                    onChange={(e) => setCommissionInput(e.target.value)}
                    placeholder={String(settings.affiliate_commission_percent)}
                  />
                </label>
                <button type="submit" className="primary-button" disabled={busy}>
                  Сохранить ставку
                </button>
              </form>
              <h3>Клиенты ({selected.merchants.length})</h3>
              <div className="tenant-list">
                {selected.merchants.map((m) => (
                  <article className="tenant-card" key={m.tenant_id}>
                    <div>
                      <strong>{m.tenant_name}</strong>
                      <p>
                        {m.tenant_status} · fee {money(m.platform_fee_usdt)} · commission{" "}
                        {money(m.commission_usdt)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </section>

      <section className="panel panel-span-2">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Выплаты партнёрам</p>
            <h2>Очередь affiliate payouts</h2>
          </div>
        </div>
        <div className="tenant-list">
          {payouts.length === 0 ? (
            <p className="muted-text">Заявок нет.</p>
          ) : (
            payouts.map((payout) => (
              <article className="tenant-card" key={payout.id}>
                <div>
                  <strong>
                    {money(payout.amount_requested)} {payout.currency}
                  </strong>
                  <p>
                    {payout.network}: {payout.destination_address}
                  </p>
                </div>
                <div className="tenant-meta">
                  <span>{payout.status}</span>
                  {payout.status === "pending_review" ? (
                    <div className="action-row">
                      <button
                        type="button"
                        className="primary-button"
                        disabled={busy}
                        onClick={() => void reviewPayout(payout.id, "approve")}
                      >
                        Подтвердить
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={busy}
                        onClick={() => void reviewPayout(payout.id, "reject")}
                      >
                        Отклонить
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

import { FormEvent, useState } from "react";

import type {
  PlatformAccountingOverview,
  PlatformEarningsWithdrawalPayload,
} from "../../api";
import { formatDecimal } from "../../utils/format";

type PlatformAccountingPanelProps = {
  overview: PlatformAccountingOverview;
  isSuperadmin?: boolean;
  loading?: boolean;
  onRecordPlatformWithdrawal?: (
    payload: PlatformEarningsWithdrawalPayload,
  ) => Promise<void>;
};

function money(value: string | number | null | undefined, currency: string) {
  return `${formatDecimal(value ?? "0")} ${currency}`;
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ru-RU");
}

function FlowStep({
  label,
  value,
  currency,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  currency: string;
  hint?: string;
  tone?: "default" | "platform" | "merchant" | "provider";
}) {
  return (
    <article className={`pw-accounting-flow-step pw-accounting-flow-step--${tone}`}>
      <span>{label}</span>
      <strong>{money(value, currency)}</strong>
      {hint ? <p className="muted-text">{hint}</p> : null}
    </article>
  );
}

export function PlatformAccountingPanel({
  overview,
  isSuperadmin = false,
  loading = false,
  onRecordPlatformWithdrawal,
}: PlatformAccountingPanelProps) {
  const { currency, summary, merchant_balances: balances } = overview;
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNote, setWithdrawNote] = useState("");
  const [withdrawReference, setWithdrawReference] = useState("");
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);

  async function handleWithdrawSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onRecordPlatformWithdrawal) {
      return;
    }
    const amount = Number(withdrawAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setWithdrawError("Укажите сумму больше нуля.");
      return;
    }
    setSubmittingWithdrawal(true);
    setWithdrawError(null);
    try {
      await onRecordPlatformWithdrawal({
        amount,
        note: withdrawNote.trim() || null,
        external_reference: withdrawReference.trim() || null,
      });
      setWithdrawAmount("");
      setWithdrawNote("");
      setWithdrawReference("");
    } catch (err) {
      setWithdrawError(
        err instanceof Error ? err.message : "Не удалось зафиксировать вывод.",
      );
    } finally {
      setSubmittingWithdrawal(false);
    }
  }

  return (
    <div className="pw-accounting">
      <section className="pw-accounting-hero panel">
        <div className="pw-accounting-hero-copy">
          <p className="eyebrow">Бухгалтерия платформы</p>
          <h2>Кто сколько держит</h2>
          <p className="muted-text">
            Все суммы в {currency}. «Остаток вашей комиссии» = начислено с платежей минус уже
            зафиксированные выводы с Crypto-Cash. После вывода у провайдера нажмите «Зафиксировать
            вывод» — остаток уменьшится.
          </p>
        </div>
        <div className="pw-accounting-hero-grid">
          <article className="pw-accounting-kpi pw-accounting-kpi--platform">
            <span>Остаток вашей комиссии</span>
            <strong>{money(overview.platform_earnings_outstanding, currency)}</strong>
            <p className="muted-text">
              Начислено {money(overview.platform_earnings_accrued, currency)} · выведено{" "}
              {money(overview.platform_earnings_withdrawn, currency)}
            </p>
          </article>
          <article className="pw-accounting-kpi pw-accounting-kpi--merchant">
            <span>На счетах мерчантов</span>
            <strong>{money(balances.on_accounts, currency)}</strong>
            <p className="muted-text">Доступно + ожидание + заморожено + в выплате</p>
          </article>
          <article className="pw-accounting-kpi pw-accounting-kpi--payout">
            <span>Запросы на вывод</span>
            <strong>{money(overview.payouts_pending_amount, currency)}</strong>
            <p className="muted-text">
              {overview.payouts_pending_count} заявок на проверке
            </p>
          </article>
        </div>
      </section>

      {isSuperadmin && onRecordPlatformWithdrawal ? (
        <section className="panel pw-accounting-withdraw-form">
          <div className="panel-head">
            <h3>Зафиксировать вывод вашей комиссии</h3>
            <p className="muted-text">
              Когда забрали markup с баланса Crypto-Cash — отметьте сумму здесь, чтобы не копилась
              «висящая» комиссия.
            </p>
          </div>
          <form className="pw-accounting-withdraw-grid" onSubmit={(event) => void handleWithdrawSubmit(event)}>
            <label>
              <span>Сумма, {currency}</span>
              <input
                type="text"
                inputMode="decimal"
                value={withdrawAmount}
                onChange={(event) => setWithdrawAmount(event.target.value)}
                placeholder="0.00"
                disabled={loading || submittingWithdrawal}
              />
            </label>
            <label>
              <span>ID / хеш выплаты у провайдера</span>
              <input
                value={withdrawReference}
                onChange={(event) => setWithdrawReference(event.target.value)}
                placeholder="Необязательно"
                disabled={loading || submittingWithdrawal}
              />
            </label>
            <label className="pw-accounting-withdraw-note">
              <span>Комментарий</span>
              <input
                value={withdrawNote}
                onChange={(event) => setWithdrawNote(event.target.value)}
                placeholder="Например: вывод за март"
                disabled={loading || submittingWithdrawal}
              />
            </label>
            <div className="pw-accounting-withdraw-actions">
              <button
                type="submit"
                className="primary-button"
                disabled={loading || submittingWithdrawal}
              >
                {submittingWithdrawal ? "Сохраняем…" : "Зафиксировать вывод"}
              </button>
              <p className="muted-text">
                Доступно к фиксации: {money(overview.platform_earnings_outstanding, currency)}
              </p>
            </div>
          </form>
          {withdrawError ? <p className="error-text">{withdrawError}</p> : null}
        </section>
      ) : null}

      {overview.platform_withdrawals.length > 0 ? (
        <section className="panel pw-accounting-withdraw-history">
          <div className="panel-head">
            <h3>История выводов вашей комиссии</h3>
          </div>
          <div className="table-scroll">
            <table className="data-table pw-accounting-tenant-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Сумма</th>
                  <th>Референс</th>
                  <th>Комментарий</th>
                  <th>Кто отметил</th>
                </tr>
              </thead>
              <tbody>
                {overview.platform_withdrawals.map((item) => (
                  <tr key={item.id}>
                    <td>{formatWhen(item.withdrawn_at)}</td>
                    <td>{money(item.amount, item.currency)}</td>
                    <td>{item.external_reference ?? "—"}</td>
                    <td>{item.note ?? "—"}</td>
                    <td>{item.recorded_by_email ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="panel pw-accounting-flow">
        <div className="panel-head">
          <h3>Как делится оплаченный оборот</h3>
          <p className="muted-text">По всем успешно оплаченным инвойсам платформы</p>
        </div>
        <div className="pw-accounting-flow-grid">
          <FlowStep
            label="Оплачено клиентами"
            value={overview.gross_turnover}
            currency={currency}
            hint="Gross — сумма платежей"
          />
          <span className="pw-accounting-flow-arrow" aria-hidden="true">
            −
          </span>
          <FlowStep
            label="Комиссия Crypto-Cash"
            value={overview.provider_fees}
            currency={currency}
            tone="provider"
            hint="Провайдер эквайринга"
          />
          <span className="pw-accounting-flow-arrow" aria-hidden="true">
            −
          </span>
          <FlowStep
            label="Начислено вам (всего)"
            value={overview.platform_earnings_accrued}
            currency={currency}
            tone="platform"
            hint="Markup + turnover fee"
          />
          <span className="pw-accounting-flow-arrow" aria-hidden="true">
            =
          </span>
          <FlowStep
            label="Зачислено мерчантам"
            value={overview.merchant_net_credited}
            currency={currency}
            tone="merchant"
            hint="Net на балансы клиентов"
          />
        </div>
      </section>

      <section className="panel pw-accounting-balances">
        <div className="panel-head">
          <h3>Балансы мерчантов сейчас</h3>
          <p className="muted-text">
            {overview.tenants_with_balance_count} из {overview.active_tenants_count} активных клиентов
            держат средства на счёте
          </p>
        </div>
        <div className="pw-accounting-balance-grid">
          <article className="detail-chip">
            <span>Доступно к выводу</span>
            <strong>{money(balances.available, currency)}</strong>
          </article>
          <article className="detail-chip">
            <span>Ожидает разблокировки</span>
            <strong>{money(balances.pending, currency)}</strong>
          </article>
          <article className="detail-chip">
            <span>Заморожено</span>
            <strong>{money(balances.frozen, currency)}</strong>
          </article>
          <article className="detail-chip">
            <span>В процессе выплаты</span>
            <strong>{money(balances.locked, currency)}</strong>
          </article>
          <article className="detail-chip">
            <span>Уже выведено</span>
            <strong>{money(balances.withdrawn, currency)}</strong>
          </article>
        </div>
      </section>

      <section className="panel pw-accounting-activity">
        <div className="panel-head">
          <h3>Инвойсы</h3>
        </div>
        <div className="pw-accounting-activity-grid">
          <article className="detail-chip">
            <span>Всего</span>
            <strong>{summary.invoices_total_count}</strong>
          </article>
          <article className="detail-chip">
            <span>Оплачено</span>
            <strong>{summary.invoices_paid_count}</strong>
          </article>
          <article className="detail-chip">
            <span>Подтверждено</span>
            <strong>{summary.invoices_confirmed_count}</strong>
          </article>
          <article className="detail-chip">
            <span>Истекло / отменено</span>
            <strong>{summary.invoices_expired_count}</strong>
          </article>
          <article className="detail-chip">
            <span>Средний чек</span>
            <strong>{money(summary.average_invoice_amount, currency)}</strong>
          </article>
        </div>
      </section>

      {overview.tenant_balances.length > 0 ? (
        <section className="panel pw-accounting-tenants">
          <div className="panel-head">
            <h3>Клиенты по остатку на счёте</h3>
            <p className="muted-text">Сортировка по сумме на внутреннем балансе</p>
          </div>
          <div className="table-scroll">
            <table className="data-table pw-accounting-tenant-table">
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th>Статус</th>
                  <th>На счёте</th>
                  <th>Доступно</th>
                  <th>Ожидание</th>
                  <th>Выведено</th>
                </tr>
              </thead>
              <tbody>
                {overview.tenant_balances.map((tenant) => (
                  <tr key={tenant.tenant_id}>
                    <td>
                      <strong>{tenant.tenant_name}</strong>
                      <span className="muted-text">{tenant.tenant_slug}</span>
                    </td>
                    <td>{tenant.tenant_status}</td>
                    <td>{money(tenant.on_accounts, currency)}</td>
                    <td>{money(tenant.available, currency)}</td>
                    <td>{money(tenant.pending, currency)}</td>
                    <td>{money(tenant.withdrawn, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

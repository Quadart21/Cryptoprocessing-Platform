import { FormEvent, useState } from "react";

import type { CreateInvoicePayload, ProjectItem, RateNetworkItem } from "../../api";

type InvoiceIssuanceWizardProps = {
  invoiceForm: CreateInvoicePayload;
  projects: ProjectItem[];
  rates: Array<{ currency: string }>;
  availableNetworks: RateNetworkItem[];
  selectedNetwork: RateNetworkItem | null;
  loading: boolean;
  onInvoiceFormChange: (next: CreateInvoicePayload) => void;
  onCreateInvoice: (event: FormEvent<HTMLFormElement>) => void;
};

export function InvoiceIssuanceWizard({
  invoiceForm,
  projects,
  rates,
  availableNetworks,
  selectedNetwork,
  loading,
  onInvoiceFormChange,
  onCreateInvoice,
}: InvoiceIssuanceWizardProps) {
  const [step, setStep] = useState(0);

  const step0Ok =
    invoiceForm.project_id.trim() !== "" && invoiceForm.merchant_order_id.trim() !== "";
  const canSubmit =
    !loading &&
    step0Ok &&
    Number.isFinite(invoiceForm.amount_fiat) &&
    invoiceForm.amount_fiat > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (step !== 1) {
      event.preventDefault();
      return;
    }
    onCreateInvoice(event);
  }

  return (
    <section className="mw-wizard" aria-label="Мастер создания инвойса">
      <header className="mw-wizard-track">
        <button
          className={`mw-wizard-dot ${step === 0 ? "mw-wizard-dot-active" : ""}`}
          onClick={() => setStep(0)}
          type="button"
        >
          1. Заказ
        </button>
        <span className="mw-wizard-line" aria-hidden />
        <button
          className={`mw-wizard-dot ${step === 1 ? "mw-wizard-dot-active" : ""}`}
          disabled={!step0Ok}
          onClick={() => setStep(1)}
          type="button"
        >
          2. Сеть и сумма
        </button>
      </header>

      <form className="mw-wizard-form mc-form" onSubmit={handleSubmit}>
        {step === 0 ? (
          <div className="mw-wizard-step">
            <p className="mw-wizard-lead">Сначала привяжите платёж к проекту и своему номеру заказа.</p>
            <label className="mc-field">
              <span>Проект</span>
              <select
                value={invoiceForm.project_id}
                onChange={(event) => onInvoiceFormChange({ ...invoiceForm, project_id: event.target.value })}
              >
                <option value="">Выберите проект</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mc-field">
              <span>Внутренний номер заказа</span>
              <input
                value={invoiceForm.merchant_order_id}
                onChange={(event) =>
                  onInvoiceFormChange({ ...invoiceForm, merchant_order_id: event.target.value })
                }
                placeholder="order-2048"
              />
            </label>
            <div className="mw-wizard-nav">
              <button className="primary-button" disabled={!step0Ok} onClick={() => setStep(1)} type="button">
                Далее
              </button>
            </div>
          </div>
        ) : (
          <div className="mw-wizard-step">
            <p className="mw-wizard-lead">Укажите токен, сеть и сумму — затем создайте инвойс.</p>
            <div className="mc-form-grid mc-form-grid--2">
              <label className="mc-field">
                <span>Токен</span>
                <select
                  value={invoiceForm.crypto_currency}
                  onChange={(event) =>
                    onInvoiceFormChange({ ...invoiceForm, crypto_currency: event.target.value })
                  }
                >
                  {rates.length === 0 ? <option value="USDT">USDT</option> : null}
                  {rates.map((rate) => (
                    <option key={rate.currency} value={rate.currency}>
                      {rate.currency}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mc-field">
                <span>Сеть</span>
                <select
                  value={invoiceForm.network}
                  onChange={(event) => onInvoiceFormChange({ ...invoiceForm, network: event.target.value })}
                >
                  {availableNetworks.length === 0 ? (
                    <option value={invoiceForm.network}>{invoiceForm.network}</option>
                  ) : (
                    availableNetworks.map((network) => (
                      <option key={network.network} value={network.network}>
                        {network.network}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="mc-field mc-field-span-2">
                <span>Сумма</span>
                <input
                  value={invoiceForm.amount_fiat}
                  onChange={(event) =>
                    onInvoiceFormChange({ ...invoiceForm, amount_fiat: Number(event.target.value) })
                  }
                  min="0.00000001"
                  step="0.00000001"
                  type="number"
                />
              </label>
            </div>
            {selectedNetwork ? (
              <div className="mc-hint-box">
                <strong>
                  {invoiceForm.crypto_currency} · {selectedNetwork.network}
                </strong>
                <p>Мин. депозит: {selectedNetwork.min_deposit ?? "—"}</p>
                <p>Макс. депозит: {selectedNetwork.max_deposit ?? "—"}</p>
              </div>
            ) : null}
            <div className="mw-wizard-nav">
              <button className="ghost-button" onClick={() => setStep(0)} type="button">
                Назад
              </button>
              <button className="primary-button" disabled={!canSubmit} type="submit">
                {loading ? "Создаём…" : "Создать инвойс"}
              </button>
            </div>
          </div>
        )}
      </form>
    </section>
  );
}

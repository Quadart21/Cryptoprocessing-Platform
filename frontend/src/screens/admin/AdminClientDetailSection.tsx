import { useEffect, useState } from "react";

import type {
  AccountingSummary,
  InvoiceAdminDetail,
  InvoiceItem,
  PayoutRequestItem,
  ProjectAdminUpdatePayload,
  ProviderEventItem,
  TenantAdminUpdatePayload,
  TenantDetailResponse,
  TransactionItem,
} from "../../api";
import { TenantPayoutsPanel } from "./TenantPayoutsPanel";

type AdminClientDetailSectionProps = {
  loading: boolean;
  selectedTenantName: string;
  selectedTenantDetail: TenantDetailResponse | null;
  selectedTenantAccounting: AccountingSummary | null;
  selectedTenantInvoices: InvoiceItem[];
  selectedTenantTransactions: TransactionItem[];
  selectedTenantPayouts: PayoutRequestItem[];
  selectedInvoiceId: string | null;
  selectedInvoiceDetail: InvoiceAdminDetail | null;
  selectedInvoiceEvents: ProviderEventItem[];
  onBackToClients: () => void;
  onDeleteTenant: (tenantId: string) => void;
  onResetTenantOwnerPassword: (tenantId: string) => void;
  onResetTenantOwnerTwoFactor: (tenantId: string) => void;
  onAdminRegenerateApiKey: (apiKeyId: string) => void;
  onAdminRevokeApiKey: (apiKeyId: string) => void;
  onSelectInvoice: (invoiceId: string) => void;
  onUpdateAdminProject: (projectId: string, payload: ProjectAdminUpdatePayload) => void;
  onUpdateAdminTenant: (tenantId: string, payload: TenantAdminUpdatePayload) => void;
  onUpdateInvoiceStatus: (status: string) => void;
  onApprovePayout: (payoutId: string) => void;
  onRejectPayout: (payoutId: string) => void;
};

export function AdminClientDetailSection({
  loading,
  selectedTenantName,
  selectedTenantDetail,
  selectedTenantAccounting,
  selectedTenantInvoices,
  selectedTenantTransactions,
  selectedTenantPayouts,
  selectedInvoiceId,
  selectedInvoiceDetail,
  selectedInvoiceEvents,
  onBackToClients,
  onDeleteTenant,
  onResetTenantOwnerPassword,
  onResetTenantOwnerTwoFactor,
  onAdminRegenerateApiKey,
  onAdminRevokeApiKey,
  onSelectInvoice,
  onUpdateAdminProject,
  onUpdateAdminTenant,
  onUpdateInvoiceStatus,
  onApprovePayout,
  onRejectPayout,
}: AdminClientDetailSectionProps) {
  const [tenantForm, setTenantForm] = useState<TenantAdminUpdatePayload | null>(null);
  const [projectForms, setProjectForms] = useState<Record<string, ProjectAdminUpdatePayload>>({});

  useEffect(() => {
    if (!selectedTenantDetail) {
      setTenantForm(null);
      setProjectForms({});
      return;
    }
    setTenantForm({
      company_name: selectedTenantDetail.tenant?.name ?? "",
      slug: selectedTenantDetail.tenant?.slug ?? "",
      status: selectedTenantDetail.tenant?.status ?? "",
      review_comment: selectedTenantDetail.tenant?.review_comment ?? null,
      owner_email: selectedTenantDetail.owner?.email ?? "",
      owner_full_name: selectedTenantDetail.owner?.full_name ?? "",
      timezone: selectedTenantDetail.tenant?.timezone ?? "UTC",
      base_currency: selectedTenantDetail.tenant?.base_currency ?? "USD",
      plan: selectedTenantDetail.tenant?.plan ?? "free",
    });
    setProjectForms(
      Object.fromEntries(
        (selectedTenantDetail.projects ?? []).map((project) => [
          project.id,
          {
            name: project.name,
            domain: project.domain,
            description: project.description,
            webhook_url: project.webhook_url,
            status: project.status,
          },
        ]),
      ),
    );
  }, [selectedTenantDetail]);

  return (
    <section className="dashboard-grid client-grid">
      <article className="panel panel-span-2">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Карточка клиента</p>
            <h2>{selectedTenantName}</h2>
          </div>
          <button className="ghost-button" onClick={onBackToClients} type="button">
            Назад к списку клиентов
          </button>
        </div>

        {!selectedTenantDetail ? (
          <p className="muted-text">Выберите клиента в разделе «Клиенты».</p>
        ) : (
          <div className="detail-stack">
            <div className="detail-summary">
              <div className="detail-chip">
                <span>Компания</span>
                <strong>{selectedTenantDetail.tenant.name}</strong>
              </div>
              <div className="detail-chip">
                <span>Статус</span>
                <strong>{selectedTenantDetail.tenant.status}</strong>
              </div>
              <div className="detail-chip">
                <span>Инвойсов</span>
                <strong>{selectedTenantDetail.invoices_count}</strong>
              </div>
              <div className="detail-chip">
                <span>Активных проектов</span>
                <strong>{selectedTenantDetail.approved_projects_count}</strong>
              </div>
            </div>

            {selectedTenantAccounting ? (
              <div className="detail-summary">
                <div className="detail-chip">
                  <span>Сумма инвойсов</span>
                  <strong>{selectedTenantAccounting.invoices_total_amount}</strong>
                </div>
                <div className="detail-chip">
                  <span>Подтверждено</span>
                  <strong>{selectedTenantAccounting.invoices_confirmed_amount}</strong>
                </div>
                <div className="detail-chip">
                  <span>Выручка платформы</span>
                  <strong>{selectedTenantAccounting.total_platform_revenue_amount}</strong>
                </div>
                <div className="detail-chip">
                  <span>Средний чек</span>
                  <strong>{selectedTenantAccounting.average_invoice_amount}</strong>
                </div>
              </div>
            ) : null}

            <div className="detail-section">
              <h3>Редактирование клиента</h3>
              {tenantForm ? (
                <form
                  className="form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (selectedTenantDetail) {
                      onUpdateAdminTenant(selectedTenantDetail.tenant.id, tenantForm);
                    }
                  }}
                >
                  <div className="form-grid-2">
                    <label>
                      <span>Компания</span>
                      <input
                        value={tenantForm.company_name}
                        onChange={(event) =>
                          setTenantForm({ ...tenantForm, company_name: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Slug</span>
                      <input
                        value={tenantForm.slug}
                        onChange={(event) =>
                          setTenantForm({ ...tenantForm, slug: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Email владельца</span>
                      <input
                        value={tenantForm.owner_email}
                        onChange={(event) =>
                          setTenantForm({ ...tenantForm, owner_email: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Имя владельца</span>
                      <input
                        value={tenantForm.owner_full_name}
                        onChange={(event) =>
                          setTenantForm({ ...tenantForm, owner_full_name: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Timezone</span>
                      <input
                        value={tenantForm.timezone}
                        onChange={(event) =>
                          setTenantForm({ ...tenantForm, timezone: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Base currency</span>
                      <input
                        value={tenantForm.base_currency}
                        onChange={(event) =>
                          setTenantForm({ ...tenantForm, base_currency: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Plan</span>
                      <input
                        value={tenantForm.plan}
                        onChange={(event) =>
                          setTenantForm({ ...tenantForm, plan: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Status</span>
                      <input
                        value={tenantForm.status}
                        onChange={(event) =>
                          setTenantForm({ ...tenantForm, status: event.target.value })
                        }
                      />
                    </label>
                    <label className="panel-span-2">
                      <span>Комментарий</span>
                      <textarea
                        rows={3}
                        value={tenantForm.review_comment ?? ""}
                        onChange={(event) =>
                          setTenantForm({
                            ...tenantForm,
                            review_comment: event.target.value.trim() === "" ? null : event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="action-row-inline">
                    <button className="primary-button" type="submit" disabled={loading}>
                      Сохранить клиента
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => selectedTenantDetail && onDeleteTenant(selectedTenantDetail.tenant.id)}
                    >
                      Удалить клиента
                    </button>
                  </div>
                </form>
              ) : null}
            </div>

            <div className="detail-section">
              <h3>Доступ owner</h3>
              <div className="detail-summary">
                <div className="detail-chip">
                  <span>Email</span>
                  <strong>{selectedTenantDetail?.owner?.email ?? "—"}</strong>
                </div>
                <div className="detail-chip">
                  <span>Владелец</span>
                  <strong>{selectedTenantDetail?.owner?.full_name ?? "—"}</strong>
                </div>
                <div className="detail-chip">
                  <span>Статус owner</span>
                  <strong>{selectedTenantDetail?.owner?.status ?? "—"}</strong>
                </div>
              </div>
              <div className="action-row-inline">
                <button
                  className="primary-button"
                  type="button"
                  disabled={loading}
                  onClick={() => selectedTenantDetail && onResetTenantOwnerPassword(selectedTenantDetail.tenant.id)}
                >
                  Сбросить пароль owner
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={loading}
                  onClick={() => selectedTenantDetail && onResetTenantOwnerTwoFactor(selectedTenantDetail.tenant.id)}
                >
                  Сбросить 2FA owner
                </button>
              </div>
            </div>

            <div className="detail-section">
              <h3>Проекты</h3>
              <div className="tenant-list">
                {(selectedTenantDetail.projects ?? []).map((project) => (
                  <article className="tenant-card" key={project.id}>
                    {projectForms[project.id] ? (
                      <form
                        className="form panel-span-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          onUpdateAdminProject(project.id, projectForms[project.id]);
                        }}
                      >
                        <div className="form-grid-2">
                          <label>
                            <span>Название проекта</span>
                            <input
                              value={projectForms[project.id].name}
                              onChange={(event) =>
                                setProjectForms({
                                  ...projectForms,
                                  [project.id]: {
                                    ...projectForms[project.id],
                                    name: event.target.value,
                                  },
                                })
                              }
                            />
                          </label>
                          <label>
                            <span>Домен</span>
                            <input
                              value={projectForms[project.id].domain}
                              onChange={(event) =>
                                setProjectForms({
                                  ...projectForms,
                                  [project.id]: {
                                    ...projectForms[project.id],
                                    domain: event.target.value,
                                  },
                                })
                              }
                            />
                          </label>
                          <label>
                            <span>Status</span>
                            <input
                              value={projectForms[project.id].status}
                              onChange={(event) =>
                                setProjectForms({
                                  ...projectForms,
                                  [project.id]: {
                                    ...projectForms[project.id],
                                    status: event.target.value,
                                  },
                                })
                              }
                            />
                          </label>
                          <label>
                            <span>Webhook URL</span>
                            <input
                              value={projectForms[project.id].webhook_url ?? ""}
                              onChange={(event) =>
                                setProjectForms({
                                  ...projectForms,
                                  [project.id]: {
                                    ...projectForms[project.id],
                                    webhook_url:
                                      event.target.value.trim() === "" ? null : event.target.value,
                                  },
                                })
                              }
                            />
                          </label>
                          <label className="panel-span-2">
                            <span>Описание</span>
                            <textarea
                              rows={3}
                              value={projectForms[project.id].description ?? ""}
                              onChange={(event) =>
                                setProjectForms({
                                  ...projectForms,
                                  [project.id]: {
                                    ...projectForms[project.id],
                                    description:
                                      event.target.value.trim() === "" ? null : event.target.value,
                                  },
                                })
                              }
                            />
                          </label>
                        </div>
                        <div className="tenant-meta">
                          <span>{project.has_webhook_secret ? "Webhook secret: задан" : "Webhook secret: нет"}</span>
                          <button className="primary-button" type="submit" disabled={loading}>
                            Сохранить проект
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>

            <div className="detail-section">
              <h3>API-ключи</h3>
              <div className="tenant-list">
                {selectedTenantDetail.api_keys.length === 0 ? (
                  <p className="muted-text">Ключи еще не выданы.</p>
                ) : (
                  selectedTenantDetail.api_keys.map((apiKey) => (
                    <article className="tenant-card" key={apiKey.id}>
                      <div>
                        <strong>{apiKey.public_key}</strong>
                      </div>
                      <div className="tenant-meta">
                        <span>{apiKey.status}</span>
                        <button
                          className="ghost-button"
                          onClick={() => onAdminRegenerateApiKey(apiKey.id)}
                          type="button"
                        >
                          Перевыпустить
                        </button>
                        <button
                          className="ghost-button"
                          onClick={() => onAdminRevokeApiKey(apiKey.id)}
                          type="button"
                        >
                          Отозвать
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="detail-section">
              <h3>Инвойсы клиента</h3>
              <div className="tenant-list">
                {selectedTenantInvoices.length === 0 ? (
                  <p className="muted-text">Инвойсов пока нет.</p>
                ) : (
                  selectedTenantInvoices.map((invoice) => (
                    <article
                      className={`tenant-card ${selectedInvoiceId === invoice.id ? "tenant-card-active" : ""}`}
                      key={invoice.id}
                    >
                      <div>
                        <strong>{invoice.merchant_order_id}</strong>
                        <p>
                          {invoice.amount_fiat} {invoice.fiat_currency} / {invoice.amount_crypto}{" "}
                          {invoice.crypto_currency}
                        </p>
                        <p>{invoice.payment_address}</p>
                      </div>
                      <div className="tenant-meta">
                        <span>{invoice.network}</span>
                        <span>{invoice.status}</span>
                        <button className="ghost-button" onClick={() => onSelectInvoice(invoice.id)} type="button">
                          Детали
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="detail-section">
              <h3>Транзакции клиента</h3>
              <div className="tenant-list">
                {selectedTenantTransactions.length === 0 ? (
                  <p className="muted-text">Транзакций пока нет.</p>
                ) : (
                  selectedTenantTransactions.map((transaction) => (
                    <article className="tenant-card" key={transaction.id}>
                      <div>
                        <strong>
                          {transaction.gross_amount} {transaction.currency}
                        </strong>
                        <p>Invoice: {transaction.invoice_id}</p>
                        <p>
                          Fees: provider {transaction.provider_fee} / platform {transaction.platform_fee}
                        </p>
                      </div>
                      <div className="tenant-meta">
                        <span>{transaction.status}</span>
                        <span>{transaction.paid_at ?? "Не оплачено"}</span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>

            <TenantPayoutsPanel
              loading={loading}
              payouts={selectedTenantPayouts}
              onApprove={onApprovePayout}
              onReject={onRejectPayout}
            />

            <div className="detail-section">
              <h3>Карточка инвойса</h3>
              {selectedInvoiceDetail ? (
                <div className="detail-stack">
                  <div className="detail-summary">
                    <div className="detail-chip">
                      <span>Статус</span>
                      <strong>{selectedInvoiceDetail.status}</strong>
                    </div>
                    <div className="detail-chip">
                      <span>Сумма</span>
                      <strong>
                        {selectedInvoiceDetail.amount_fiat} {selectedInvoiceDetail.fiat_currency}
                      </strong>
                    </div>
                    <div className="detail-chip">
                      <span>Криптосумма</span>
                      <strong>
                        {selectedInvoiceDetail.amount_crypto} {selectedInvoiceDetail.crypto_currency}
                      </strong>
                    </div>
                    <div className="detail-chip">
                      <span>Сеть</span>
                      <strong>{selectedInvoiceDetail.network}</strong>
                    </div>
                  </div>
                  <div className="result-box">
                    <p>Invoice ID: {selectedInvoiceDetail.id}</p>
                    <p>Provider order: {selectedInvoiceDetail.provider_order_id}</p>
                    <p>Адрес оплаты: {selectedInvoiceDetail.payment_address}</p>
                    <p>Создан: {selectedInvoiceDetail.created_at}</p>
                    <p>Оплачен: {selectedInvoiceDetail.paid_at ?? "Еще нет"}</p>
                    <p>Подтвержден: {selectedInvoiceDetail.confirmed_at ?? "Еще нет"}</p>
                  </div>
                  <div className="action-row-inline">
                    <button className="ghost-button" onClick={() => onUpdateInvoiceStatus("pending")} type="button">
                      pending
                    </button>
                    <button className="ghost-button" onClick={() => onUpdateInvoiceStatus("paid")} type="button">
                      paid
                    </button>
                    <button className="primary-button" onClick={() => onUpdateInvoiceStatus("confirmed")} type="button">
                      confirmed
                    </button>
                    <button className="ghost-button" onClick={() => onUpdateInvoiceStatus("failed")} type="button">
                      failed
                    </button>
                  </div>
                  <div className="result-box">
                    <strong>Raw provider payload</strong>
                    <pre className="json-box">
                      {JSON.stringify(selectedInvoiceDetail.raw_provider_payload_json, null, 2)}
                    </pre>
                  </div>
                  <div className="result-box">
                    <strong>События по инвойсу</strong>
                    <div className="tenant-list compact-list">
                      {selectedInvoiceEvents.length === 0 ? (
                        <p className="muted-text">Событий пока нет.</p>
                      ) : (
                        selectedInvoiceEvents.map((event) => (
                          <article className="tenant-card" key={event.id}>
                            <div>
                              <strong>{event.event_type}</strong>
                              <p>Source: {event.source}</p>
                            </div>
                            <div className="tenant-meta">
                              <span>{event.status}</span>
                              <span>{event.created_at}</span>
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="muted-text">Выберите инвойс, чтобы открыть его карточку.</p>
              )}
            </div>
          </div>
        )}
      </article>
    </section>
  );
}

import { useEffect, useState } from "react";

import { formatDecimal, formatMoneyAmount } from "../../utils/format";
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

type ClientDetailTab = "overview" | "profile" | "access" | "integration" | "ledger" | "invoice";

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

const DETAIL_TABS: Array<{ id: ClientDetailTab; label: string }> = [
  { id: "overview", label: "Сводка" },
  { id: "profile", label: "Профиль" },
  { id: "access", label: "Доступ" },
  { id: "integration", label: "Проекты и API" },
  { id: "ledger", label: "Инвойсы и платежи" },
  { id: "invoice", label: "Карточка инвойса" },
];

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
  const [detailTab, setDetailTab] = useState<ClientDetailTab>("overview");

  useEffect(() => {
    if (!selectedTenantDetail) {
      setTenantForm(null);
      setProjectForms({});
      return;
    }
    setDetailTab("overview");
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

  useEffect(() => {
    if (selectedInvoiceId) {
      setDetailTab("invoice");
    }
  }, [selectedInvoiceId]);

  return (
    <section className="dashboard-grid client-grid">
      <article className="panel panel-span-2 pw-client-detail-panel">
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
          <div className="pw-client-detail-shell">
            <nav className="pw-console-tabs" role="tablist" aria-label="Раздел карточки клиента">
              {DETAIL_TABS.map((t) => (
                <button
                  aria-selected={detailTab === t.id}
                  className={`pw-console-tab ${detailTab === t.id ? "pw-console-tab-active" : ""}`}
                  key={t.id}
                  role="tab"
                  type="button"
                  onClick={() => setDetailTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            <div className="pw-console-tabpanels">
              {detailTab === "overview" ? (
                <div aria-label="Сводка" className="pw-console-tabpanel" role="tabpanel">
                  <p className="muted-text pw-tabpanel-intro">Ключевые метрики по выбранному тенанту.</p>
                  <div className="detail-summary pw-readonly-kv-grid">
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
                    <div className="detail-summary pw-readonly-kv-grid">
                      <div className="detail-chip">
                        <span>Сумма инвойсов</span>
                        <strong>{formatDecimal(selectedTenantAccounting.invoices_total_amount)}</strong>
                      </div>
                      <div className="detail-chip">
                        <span>Подтверждено</span>
                        <strong>{formatDecimal(selectedTenantAccounting.invoices_confirmed_amount)}</strong>
                      </div>
                      <div className="detail-chip">
                        <span>Выручка платформы</span>
                        <strong>{formatDecimal(selectedTenantAccounting.total_platform_revenue_amount)}</strong>
                      </div>
                      <div className="detail-chip">
                        <span>Средний чек</span>
                        <strong>{formatDecimal(selectedTenantAccounting.average_invoice_amount)}</strong>
                      </div>
                    </div>
                  ) : (
                    <p className="muted-text">Учётные суммы недоступны.</p>
                  )}
                </div>
              ) : null}

              {detailTab === "profile" ? (
                <div aria-label="Профиль" className="pw-console-tabpanel" role="tabpanel">
                  <p className="muted-text pw-tabpanel-intro">Юридические и учётные поля клиента.</p>
                  <div className="detail-section pw-form-block">
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
                        <fieldset className="pw-fieldset">
                          <legend className="sr-only">Редактирование профиля клиента</legend>
                          <div className="pw-fieldset-cap">
                            <h3 className="pw-fieldset-title">Профиль и учётная запись</h3>
                            <p className="pw-fieldset-desc">
                              Название, slug и данные владельца сохраняются отдельно от операций ниже —
                              здесь только редактируемые поля.
                            </p>
                          </div>
                          <div className="pw-fieldset-body">
                            <div className="form-grid-2 pw-form-fields">
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
                            <span className="pw-field-hint">Идентификатор URL, без пробелов.</span>
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
                            <span className="pw-field-hint">Видим модератору и в истории статусов.</span>
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
                            <div className="pw-form-actions">
                          <button className="primary-button" type="submit" disabled={loading}>
                            Сохранить клиента
                          </button>
                          <button
                            className="ghost-button danger-soft"
                            type="button"
                            onClick={() => selectedTenantDetail && onDeleteTenant(selectedTenantDetail.tenant.id)}
                          >
                            Удалить клиента
                          </button>
                            </div>
                          </div>
                        </fieldset>
                      </form>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {detailTab === "access" ? (
                <div aria-label="Доступ" className="pw-console-tabpanel" role="tabpanel">
                  <p className="muted-text pw-tabpanel-intro">Учётная запись владельца и сбросы доступа.</p>
                  <div className="detail-section pw-form-block">
                    <div className="pw-fieldset">
                      <div className="pw-fieldset-cap">
                        <h3 className="pw-fieldset-title">Учётная запись владельца</h3>
                        <p className="pw-fieldset-desc">
                          Только чтение — сами учётные данные меняются в кабинете клиента или через сбросы ниже.
                        </p>
                      </div>
                      <div className="pw-fieldset-body">
                        <div className="pw-readonly-kv-grid">
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
                        <div className="pw-form-actions">
                          <button
                            className="primary-button"
                            type="button"
                            disabled={loading}
                            onClick={() =>
                              selectedTenantDetail && onResetTenantOwnerPassword(selectedTenantDetail.tenant.id)
                            }
                          >
                            Сбросить пароль owner
                          </button>
                          <button
                            className="ghost-button"
                            type="button"
                            disabled={loading}
                            onClick={() =>
                              selectedTenantDetail && onResetTenantOwnerTwoFactor(selectedTenantDetail.tenant.id)
                            }
                          >
                            Сбросить 2FA owner
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {detailTab === "integration" ? (
                <div aria-label="Интеграция" className="pw-console-tabpanel" role="tabpanel">
                  <p className="muted-text pw-tabpanel-intro">Проекты, домены и API-ключи.</p>

                  <div className="detail-section">
                    <h3 className="pw-subsection-title">Проекты</h3>
                    <div className="tenant-list pw-tenant-cards-spaced">
                      {(selectedTenantDetail.projects ?? []).map((project) => (
                        <article className="tenant-card" key={project.id}>
                          {projectForms[project.id] ? (
                            <form
                              className="form"
                              onSubmit={(event) => {
                                event.preventDefault();
                                onUpdateAdminProject(project.id, projectForms[project.id]);
                              }}
                            >
                              <fieldset className="pw-fieldset">
                                <legend className="sr-only">Проект {projectForms[project.id].name}</legend>
                                <div className="pw-fieldset-cap">
                                  <h4 className="pw-fieldset-title">{projectForms[project.id].name}</h4>
                                  <p className="pw-fieldset-desc">
                                    Настройки этого проекта: домен, статус, вебхук и публичное описание.
                                  </p>
                                </div>
                                <div className="pw-fieldset-body">
                              <div className="form-grid-2 pw-form-fields">
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
                                  <span className="pw-field-hint">Пустое значение отключает доставку событий на URL.</span>
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
                              <div className="pw-form-actions">
                                <span className="muted-text">
                                  {project.has_webhook_secret ? "Webhook secret: задан" : "Webhook secret: нет"}
                                </span>
                                <button className="primary-button" type="submit" disabled={loading}>
                                  Сохранить проект
                                </button>
                              </div>
                                </div>
                              </fieldset>
                            </form>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3 className="pw-subsection-title">API-ключи</h3>
                    <div className="tenant-list pw-tenant-cards-spaced">
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
                </div>
              ) : null}

              {detailTab === "ledger" ? (
                <div aria-label="Движения" className="pw-console-tabpanel" role="tabpanel">
                  <p className="muted-text pw-tabpanel-intro">
                    Инвойсы, транзакции и заявки на вывод. Для карточки инвойса нажмите «Детали».
                  </p>

                  <div className="detail-section">
                    <h4 className="pw-subheading">Инвойсы клиента</h4>
                    <div className="tenant-list pw-tenant-cards-compact">
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
                                {formatDecimal(invoice.amount_fiat)} {invoice.fiat_currency} /{" "}
                                {formatDecimal(invoice.amount_crypto)} {invoice.crypto_currency}
                              </p>
                              <p className="muted-text truncate-address">{invoice.payment_address}</p>
                            </div>
                            <div className="tenant-meta">
                              <span>{invoice.network}</span>
                              <span>{invoice.status}</span>
                              <button
                                className="ghost-button"
                                onClick={() => onSelectInvoice(invoice.id)}
                                type="button"
                              >
                                Детали и статусы →
                              </button>
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h4 className="pw-subheading">Транзакции клиента</h4>
                    <div className="tenant-list pw-tenant-cards-compact">
                      {selectedTenantTransactions.length === 0 ? (
                        <p className="muted-text">Транзакций пока нет.</p>
                      ) : (
                        selectedTenantTransactions.map((transaction) => (
                          <article className="tenant-card" key={transaction.id}>
                            <div>
                              <strong>{formatMoneyAmount(transaction.gross_amount, transaction.currency)}</strong>
                              <p className="muted-text">Invoice: {transaction.invoice_id}</p>
                              <p className="muted-text">
                                Fees: provider {formatDecimal(transaction.provider_fee)} · platform{" "}
                                {formatDecimal(transaction.platform_fee)}
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
                </div>
              ) : null}

              {detailTab === "invoice" ? (
                <div aria-label="Инвойс" className="pw-console-tabpanel" role="tabpanel">
                  {!selectedInvoiceDetail ? (
                    <p className="muted-text pw-tabpanel-intro">
                      Выберите инвойс на вкладке «Инвойсы и платежи», затем вернитесь сюда.
                    </p>
                  ) : (
                    <>
                      <p className="muted-text pw-tabpanel-intro">
                        Ручное изменение статуса и технические данные провайдера.
                      </p>
                      <div className="detail-summary">
                        <div className="detail-chip">
                          <span>Статус</span>
                          <strong>{selectedInvoiceDetail.status}</strong>
                        </div>
                        <div className="detail-chip">
                          <span>Сумма</span>
                          <strong>
                            {formatDecimal(selectedInvoiceDetail.amount_fiat)}{" "}
                            {selectedInvoiceDetail.fiat_currency}
                          </strong>
                        </div>
                        <div className="detail-chip">
                          <span>Криптосумма</span>
                          <strong>
                            {formatDecimal(selectedInvoiceDetail.amount_crypto)}{" "}
                            {selectedInvoiceDetail.crypto_currency}
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
                      <div className="action-row-inline pw-action-strip">
                        <button
                          className="ghost-button"
                          onClick={() => onUpdateInvoiceStatus("pending")}
                          type="button"
                        >
                          pending
                        </button>
                        <button className="ghost-button" onClick={() => onUpdateInvoiceStatus("paid")} type="button">
                          paid
                        </button>
                        <button
                          className="primary-button"
                          onClick={() => onUpdateInvoiceStatus("confirmed")}
                          type="button"
                        >
                          confirmed
                        </button>
                        <button className="ghost-button" onClick={() => onUpdateInvoiceStatus("failed")} type="button">
                          failed
                        </button>
                      </div>
                      <div className="result-box">
                        <strong>Raw provider payload</strong>
                        <pre className="json-box">{JSON.stringify(selectedInvoiceDetail.raw_provider_payload_json, null, 2)}</pre>
                      </div>
                      <div className="result-box">
                        <strong>События по инвойсу</strong>
                        <div className="tenant-list compact-list pw-tenant-cards-compact">
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
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </article>
    </section>
  );
}

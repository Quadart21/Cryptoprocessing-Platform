/** Нормализованные статусы инвойса после маппинга провайдера (см. invoice_service._normalize_provider_status). */

export type InvoiceStatusTone = "success" | "warning" | "danger";

export function invoiceStatusTone(status: string): InvoiceStatusTone {
  const s = status.trim().toLowerCase();
  if (s === "paid" || s === "confirmed") {
    return "success";
  }
  if (s === "pending" || s === "confirming") {
    return "warning";
  }
  return "danger";
}

export function invoiceStatusLabelRu(status: string): string {
  const s = status.trim().toLowerCase();
  const map: Record<string, string> = {
    pending: "Ожидает оплату",
    confirming: "Подтверждение в сети",
    paid: "Оплачен",
    confirmed: "Подтверждён",
    expired: "Истёк срок",
    cancelled: "Отменён",
    failed: "Ошибка оплаты",
  };
  return map[s] ?? status;
}

/** Бейджи в модалках инвойса (.invoice-status-badge + модификатор). */
export function invoiceDetailBadgeClass(status: string): string {
  const s = status.trim().toLowerCase();
  switch (s) {
    case "pending":
      return "invoice-status-badge-pending";
    case "confirming":
      return "invoice-status-badge-pending";
    case "paid":
      return "invoice-status-badge-paid";
    case "confirmed":
      return "invoice-status-badge-confirmed";
    case "failed":
      return "invoice-status-badge-failed";
    case "expired":
      return "invoice-status-badge-expired";
    case "cancelled":
      return "invoice-status-badge-expired";
    default:
      return "invoice-status-badge-neutral";
  }
}

export function getInvoiceDetailStatusMeta(status: string): { label: string; className: string } {
  return {
    label: invoiceStatusLabelRu(status),
    className: invoiceDetailBadgeClass(status),
  };
}

/** Компактные ячейки и строки в админке (.inv-status-pill). */
export function invoiceCompactPillClass(status: string): string {
  const tone = invoiceStatusTone(status);
  return `inv-status-pill inv-status-pill--${tone}`;
}

/** Список инвойсов мерчанта (.mc-badge). */
export function invoiceMerchantBadgeClass(status: string): string {
  const tone = invoiceStatusTone(status);
  if (tone === "success") {
    return "mc-badge mc-badge-ok";
  }
  if (tone === "warning") {
    return "mc-badge mc-badge-warn";
  }
  return "mc-badge mc-badge-bad";
}

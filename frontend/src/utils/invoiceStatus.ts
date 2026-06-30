/** Нормализованные статусы инвойса после маппинга провайдера (см. invoice_service._normalize_provider_status). */

export type InvoiceStatusTone = "success" | "warning" | "danger";

export const PLATFORM_INVOICE_STATUSES = [
  "pending",
  "confirming",
  "paid",
  "confirmed",
  "expired",
  "cancelled",
  "failed",
  "aml_frozen",
] as const;

export type PlatformInvoiceStatus = (typeof PLATFORM_INVOICE_STATUSES)[number];

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

const INVOICE_STATUS_KEYS: Record<string, string> = {
  pending: "merchant.invoiceStatus.pending",
  confirming: "merchant.invoiceStatus.confirming",
  paid: "merchant.invoiceStatus.paid",
  confirmed: "merchant.invoiceStatus.confirmed",
  expired: "merchant.invoiceStatus.expired",
  cancelled: "merchant.invoiceStatus.cancelled",
  failed: "merchant.invoiceStatus.failed",
  aml_frozen: "merchant.invoiceStatus.amlFrozen",
};

export function invoiceStatusTone(status: string): InvoiceStatusTone {
  const s = status.trim().toLowerCase();
  if (s === "paid" || s === "confirmed") {
    return "success";
  }
  if (s === "pending" || s === "confirming" || s === "aml_frozen") {
    return "warning";
  }
  return "danger";
}

export function invoiceStatusLabel(status: string, t: TranslateFn): string {
  const s = status.trim().toLowerCase();
  const key = INVOICE_STATUS_KEYS[s];
  return key ? t(key) : status;
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
    aml_frozen: "AML: заморожен",
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
    case "aml_frozen":
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

export function getInvoiceDetailStatusMeta(
  status: string,
  t?: TranslateFn,
): { label: string; className: string } {
  return {
    label: t ? invoiceStatusLabel(status, t) : invoiceStatusLabelRu(status),
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

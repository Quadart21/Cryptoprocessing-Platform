/** Человекочитаемые подписи событий провайдера / платформы для админки. */

export type EventTone = "success" | "warning" | "danger" | "neutral" | "info";

const EVENT_TYPE_LABELS: Record<string, string> = {
  "acquiring::created": "Инвойс создан у провайдера",
  "acquiring::confirmation_started": "Началось подтверждение в сети",
  "acquiring::confirmation": "Подтверждение в сети",
  "acquiring::deposit_received": "Депозит получен",
  "acquiring::completed": "Оплата завершена",
  "acquiring::overpaid": "Переплата",
  "acquiring::underpaid": "Недоплата",
  "acquiring::currency_mismatch": "Неверная валюта депозита",
  "acquiring::declined": "Отклонено провайдером",
  "acquiring::canceled": "Отменено у провайдера",
  "acquiring::cancelled": "Отменено у провайдера",
  "invoice.created": "Инвойс создан",
  "invoice.pending": "Инвойс ожидает оплату",
  "invoice.confirming": "Инвойс подтверждается",
  "invoice.paid": "Инвойс оплачен",
  "invoice.confirmed": "Инвойс подтверждён",
  "invoice.expired": "Инвойс истёк",
  "invoice.cancelled": "Инвойс отменён",
  "invoice.canceled": "Инвойс отменён",
  "invoice.failed": "Ошибка оплаты инвойса",
  "invoice.aml_frozen": "Инвойс заморожен (AML)",
  "provider.webhook": "Webhook от провайдера",
  "client_webhook.sent": "Webhook клиенту отправлен",
  "client_webhook.failed": "Webhook клиенту не доставлен",
};

const SOURCE_LABELS: Record<string, string> = {
  webhook: "Webhook",
  sync: "Синхронизация",
  poll: "Опрос",
  manual: "Вручную",
  system: "Система",
};

const STATUS_LABELS: Record<string, string> = {
  processed: "Обработано",
  failed: "Ошибка",
  pending: "В очереди",
  ignored: "Пропущено",
  duplicate: "Дубликат",
  error: "Ошибка",
};

const PROVIDER_STATUS_LABELS: Record<string, string> = {
  queued: "В очереди",
  new: "Новый",
  waiting: "Ожидает подтверждений",
  paid: "Оплачен",
  overpaid: "Переплата",
  underpaid: "Недоплата",
  canceled: "Отменён",
  cancelled: "Отменён",
  currencymismatch: "Неверная валюта",
  canceledbutpaid: "Отменён, но оплачен",
  canceledbutoverpaid: "Отменён, переплата",
  canceledbutunderpaid: "Отменён, недоплата",
  pending: "Ожидает",
  confirming: "Подтверждение",
  confirmed: "Подтверждён",
  expired: "Истёк",
  failed: "Ошибка",
  declined: "Отклонён",
  completed: "Завершён",
  deposit_received: "Депозит получен",
  amlfrozen: "AML: заморожен",
  aml_frozen: "AML: заморожен",
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function providerEventTypeLabel(eventType: string | null | undefined): string {
  if (!eventType) {
    return "Событие";
  }
  const raw = eventType.trim();
  const key = normalizeKey(raw);
  for (const [code, label] of Object.entries(EVENT_TYPE_LABELS)) {
    if (normalizeKey(code) === key) {
      return label;
    }
  }
  if (raw.includes("::")) {
    const [, tail] = raw.split("::");
    if (tail) {
      return tail.replace(/[_-]+/g, " ");
    }
  }
  if (raw.includes(".")) {
    return raw.replace(/[._]+/g, " ");
  }
  return raw;
}

export function providerEventSourceLabel(source: string | null | undefined): string {
  if (!source) {
    return "Источник неизвестен";
  }
  const key = normalizeKey(source);
  return SOURCE_LABELS[key] ?? source;
}

export function providerEventStatusLabel(status: string | null | undefined): string {
  if (!status) {
    return "—";
  }
  const key = normalizeKey(status);
  return STATUS_LABELS[key] ?? status;
}

export function providerStatusShortLabel(status: string | null | undefined): string {
  if (!status) {
    return "—";
  }
  const key = normalizeKey(status).replace(/[_-]/g, "");
  return PROVIDER_STATUS_LABELS[key] ?? status;
}

export function providerEventStatusTone(status: string | null | undefined): EventTone {
  const key = normalizeKey(status ?? "");
  if (key === "processed") {
    return "success";
  }
  if (key === "failed" || key === "error") {
    return "danger";
  }
  if (key === "pending") {
    return "warning";
  }
  if (key === "ignored" || key === "duplicate") {
    return "neutral";
  }
  return "info";
}

export function providerEventOutcomeTone(params: {
  status: string | null | undefined;
  eventType?: string | null;
  providerStatus?: string | null;
  effectiveStatus?: string | null;
}): EventTone {
  const statusTone = providerEventStatusTone(params.status);
  if (statusTone === "danger") {
    return "danger";
  }
  const typeKey = normalizeKey(params.eventType ?? "");
  if (
    typeKey.includes("fail") ||
    typeKey.includes("declin") ||
    typeKey.includes("mismatch") ||
    typeKey.includes("cancel")
  ) {
    return "danger";
  }
  if (typeKey.includes("overpaid") || typeKey.includes("underpaid") || typeKey.includes("aml")) {
    return "warning";
  }
  const outcome = normalizeKey(params.effectiveStatus ?? params.providerStatus ?? "");
  if (["paid", "confirmed", "completed", "depositreceived"].some((s) => outcome.includes(s))) {
    return "success";
  }
  if (["pending", "waiting", "confirming", "queued", "new"].some((s) => outcome.includes(s))) {
    return "warning";
  }
  if (["fail", "cancel", "expir", "declin", "mismatch"].some((s) => outcome.includes(s))) {
    return "danger";
  }
  return statusTone === "success" ? "info" : statusTone;
}

export function formatEventDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatEventRelative(value: string | null | undefined, now = Date.now()): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const diffSec = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat("ru", { numeric: "auto" });
  if (abs < 60) {
    return rtf.format(diffSec, "second");
  }
  if (abs < 3600) {
    return rtf.format(Math.round(diffSec / 60), "minute");
  }
  if (abs < 86400) {
    return rtf.format(Math.round(diffSec / 3600), "hour");
  }
  if (abs < 86400 * 30) {
    return rtf.format(Math.round(diffSec / 86400), "day");
  }
  return formatEventDateTime(value);
}

export function truncateId(value: string | null | undefined, head = 8, tail = 6): string {
  if (!value) {
    return "—";
  }
  if (value.length <= head + tail + 1) {
    return value;
  }
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

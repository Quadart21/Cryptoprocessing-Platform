import type {
  CheckoutDeliveryMode,
  ProjectAdminUpdatePayload,
  ProjectItem,
  TenantAdminUpdatePayload,
  TenantDetailResponse,
} from "../../../api";

export const TENANT_STATUSES = ["pending_review", "approved", "rejected", "suspended"] as const;
export const PROJECT_STATUSES = ["active", "pending_review", "rejected", "suspended"] as const;

export const TIMEZONE_SUGGESTIONS = [
  "UTC",
  "Europe/Moscow",
  "Europe/Kaliningrad",
  "Europe/Samara",
  "Asia/Yekaterinburg",
  "Asia/Novosibirsk",
  "Asia/Vladivostok",
  "Europe/Kyiv",
  "Europe/Berlin",
  "Europe/London",
  "Asia/Dubai",
  "Asia/Singapore",
  "America/New_York",
] as const;

export const CURRENCY_SUGGESTIONS = ["USD", "EUR", "RUB", "USDT", "KZT"] as const;
export const PLAN_SUGGESTIONS = ["default", "free", "sandbox"] as const;

const TENANT_STATUS_LABELS: Record<string, string> = {
  approved: "Активен",
  pending_review: "На модерации",
  rejected: "Отклонён",
  suspended: "Заблокирован",
};

const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: "Активен",
  pending_review: "На модерации",
  rejected: "Отклонён",
  suspended: "Заблокирован",
};

const PLAN_LABELS: Record<string, string> = {
  default: "Стандарт",
  free: "Free",
  sandbox: "Песочница",
};

const CHECKOUT_LABELS: Record<string, string> = {
  payment_page: "Платёжная ссылка",
  h2h: "H2H",
  both: "Ссылка и H2H",
};

const PAYOUT_STATUS_LABELS: Record<string, string> = {
  pending_review: "На модерации",
  approved: "Одобрен",
  rejected: "Отклонён",
  processing: "В обработке",
  paid: "Выплачен",
  completed: "Выплачен",
  failed: "Ошибка",
};

const API_KEY_STATUS_LABELS: Record<string, string> = {
  active: "Активен",
  revoked: "Отозван",
};

const USER_STATUS_LABELS: Record<string, string> = {
  active: "Активен",
  invited: "Приглашён",
  suspended: "Заблокирован",
  disabled: "Отключён",
};

export type StatusTone = "ok" | "wait" | "bad" | "muted";

export function labelOf(map: Record<string, string>, value: string | null | undefined): string {
  const key = (value ?? "").trim();
  if (!key) return "—";
  return map[key] ?? key;
}

export function tenantStatusLabel(status: string): string {
  return labelOf(TENANT_STATUS_LABELS, status);
}

export function projectStatusLabel(status: string): string {
  return labelOf(PROJECT_STATUS_LABELS, status);
}

export function planLabel(plan: string): string {
  return labelOf(PLAN_LABELS, plan);
}

export function checkoutLabel(mode: string): string {
  return labelOf(CHECKOUT_LABELS, mode);
}

export function payoutStatusLabel(status: string): string {
  return labelOf(PAYOUT_STATUS_LABELS, status);
}

export function apiKeyStatusLabel(status: string): string {
  return labelOf(API_KEY_STATUS_LABELS, status);
}

export function userStatusLabel(status: string): string {
  return labelOf(USER_STATUS_LABELS, status);
}

export function tenantStatusTone(status: string): StatusTone {
  if (status === "approved" || status === "active") return "ok";
  if (status === "pending_review" || status === "invited") return "wait";
  if (status === "rejected" || status === "suspended" || status === "disabled" || status === "revoked") {
    return "bad";
  }
  return "muted";
}

export function projectStatusTone(status: string): StatusTone {
  return tenantStatusTone(status === "active" ? "approved" : status);
}

export function payoutStatusTone(status: string): StatusTone {
  if (status === "approved" || status === "paid" || status === "completed") return "ok";
  if (status === "pending_review" || status === "processing") return "wait";
  if (status === "rejected" || status === "failed") return "bad";
  return "muted";
}

export function formatWhen(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function tenantPayloadFromDetail(detail: TenantDetailResponse): TenantAdminUpdatePayload {
  return {
    company_name: detail.tenant?.name ?? "",
    slug: detail.tenant?.slug ?? "",
    status: detail.tenant?.status ?? "",
    review_comment: detail.tenant?.review_comment ?? null,
    owner_email: detail.owner?.email ?? "",
    owner_full_name: detail.owner?.full_name ?? "",
    timezone: detail.tenant?.timezone ?? "UTC",
    base_currency: detail.tenant?.base_currency ?? "USD",
    plan: detail.tenant?.plan ?? "default",
  };
}

export function projectPayloadFromProject(project: ProjectItem): ProjectAdminUpdatePayload {
  const checkout: CheckoutDeliveryMode =
    project.checkout_delivery === "h2h" || project.checkout_delivery === "both"
      ? project.checkout_delivery
      : "payment_page";
  return {
    name: project.name,
    domain: project.domain,
    description: project.description,
    webhook_url: project.webhook_url,
    checkout_delivery: checkout,
    status: project.status,
  };
}

export function sameTenantPayload(left: TenantAdminUpdatePayload, right: TenantAdminUpdatePayload): boolean {
  return (
    left.company_name === right.company_name &&
    left.slug === right.slug &&
    left.status === right.status &&
    (left.review_comment ?? "") === (right.review_comment ?? "") &&
    left.owner_email === right.owner_email &&
    left.owner_full_name === right.owner_full_name &&
    left.timezone === right.timezone &&
    left.base_currency === right.base_currency &&
    left.plan === right.plan
  );
}

export function sameProjectPayload(left: ProjectAdminUpdatePayload, right: ProjectAdminUpdatePayload): boolean {
  return (
    left.name === right.name &&
    left.domain === right.domain &&
    (left.description ?? "") === (right.description ?? "") &&
    (left.webhook_url ?? "") === (right.webhook_url ?? "") &&
    left.checkout_delivery === right.checkout_delivery &&
    left.status === right.status
  );
}

export function ruNoun(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun = mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
  return `${count} ${noun}`;
}

export function moneyPair(left: string | number, right: string | number): number | null {
  const a = Number(left);
  const b = Number(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a + b;
}

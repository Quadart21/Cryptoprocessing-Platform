export const MERCHANT_COMMISSION_PERCENT = 0.4;
export const MERCHANT_COMMISSION_MIN_USD = 7;

export type MerchantCommissionExample = {
  paymentUsd: number;
  percentFeeUsd: number;
  commissionUsd: number;
  note: string;
};

export const MERCHANT_COMMISSION_EXAMPLES: MerchantCommissionExample[] = [
  {
    paymentUsd: 500,
    percentFeeUsd: 2,
    commissionUsd: 7,
    note: "Срабатывает минимум $7",
  },
  {
    paymentUsd: 1_000,
    percentFeeUsd: 4,
    commissionUsd: 7,
    note: "Срабатывает минимум $7",
  },
  {
    paymentUsd: 1_750,
    percentFeeUsd: 7,
    commissionUsd: 7,
    note: "Порог: 0,4% = $7",
  },
  {
    paymentUsd: 2_000,
    percentFeeUsd: 8,
    commissionUsd: 8,
    note: "Уже выше минимума",
  },
  {
    paymentUsd: 10_000,
    percentFeeUsd: 40,
    commissionUsd: 40,
    note: "0,4% от суммы",
  },
];

export const MERCHANT_COMMISSION_BREAK_EVEN_USD =
  MERCHANT_COMMISSION_MIN_USD / (MERCHANT_COMMISSION_PERCENT / 100);

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

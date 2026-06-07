export const MERCHANT_COMMISSION_PERCENT = 0.4;
export const MERCHANT_COMMISSION_MIN_USD = 0.7;

export type MerchantCommissionExample = {
  paymentUsd: number;
  percentFeeUsd: number;
  commissionUsd: number;
  note: string;
};

export const MERCHANT_COMMISSION_EXAMPLES: MerchantCommissionExample[] = [
  {
    paymentUsd: 50,
    percentFeeUsd: 0.2,
    commissionUsd: 0.7,
    note: "Срабатывает минимум $0,70",
  },
  {
    paymentUsd: 100,
    percentFeeUsd: 0.4,
    commissionUsd: 0.7,
    note: "Срабатывает минимум $0,70",
  },
  {
    paymentUsd: 175,
    percentFeeUsd: 0.7,
    commissionUsd: 0.7,
    note: "Порог: 0,4% = $0,70",
  },
  {
    paymentUsd: 200,
    percentFeeUsd: 0.8,
    commissionUsd: 0.8,
    note: "Уже выше минимума",
  },
  {
    paymentUsd: 500,
    percentFeeUsd: 2,
    commissionUsd: 2,
    note: "0,4% от суммы",
  },
];

export const MERCHANT_COMMISSION_BREAK_EVEN_USD =
  MERCHANT_COMMISSION_MIN_USD / (MERCHANT_COMMISSION_PERCENT / 100);

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

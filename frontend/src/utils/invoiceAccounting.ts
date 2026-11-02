import type { InvoiceAmountReview, InvoiceDetail, InvoiceSettlement, TransactionItem } from "../api";
import { formatDecimal } from "./format";

const STABLE_ASSETS = new Set(["USD", "USDT", "USDC"]);

/** True when crypto/fiat are both stable — safe to show 1:1 fiat hint before settlement. */
export function isStableCoinFiatPair(cryptoCurrency: string, fiatCurrency: string): boolean {
  return (
    STABLE_ASSETS.has(cryptoCurrency.trim().toUpperCase()) &&
    STABLE_ASSETS.has(fiatCurrency.trim().toUpperCase())
  );
}

type InvoiceWithStatus = {
  status: string;
  settlement?: InvoiceSettlement | null;
};

/** Accounting (USDT gross, fees) is exposed only after Crypto-Cash confirmed + settlement. */
export function invoiceAccountingReady(invoice: InvoiceWithStatus): boolean {
  return (
    invoice.status.trim().toLowerCase() === "confirmed" &&
    Boolean(invoice.settlement?.is_final && Number(invoice.settlement.gross_amount) > 0)
  );
}

export function invoiceAccountingGrossLabel(invoice: InvoiceDetail): string | null {
  if (!invoiceAccountingReady(invoice) || !invoice.settlement) {
    return null;
  }
  return `${invoice.settlement.gross_amount} ${invoice.settlement.currency}`;
}

export type TransactionQuote = Pick<
  TransactionItem,
  | "gross_amount"
  | "currency"
  | "amount_fiat"
  | "fiat_currency"
  | "amount_crypto"
  | "crypto_currency"
  | "amount_review"
>;

export function amountReviewMessage(
  review: Pick<InvoiceAmountReview, "kind" | "received_amount" | "expected_amount" | "currency"> | null | undefined,
  fallbackCurrency: string,
): { key: string; params: Record<string, string> } | null {
  if (!review?.received_amount) {
    return null;
  }
  const currency = review.currency || fallbackCurrency;
  const received = formatDecimal(review.received_amount);
  if (review.expected_amount) {
    return {
      key:
        review.kind === "overpaid"
          ? "merchant.invoiceStatus.amountReviewOverpaid"
          : "merchant.invoiceStatus.amountReviewUnderpaid",
      params: {
        received,
        expected: formatDecimal(review.expected_amount),
        currency,
      },
    };
  }
  return {
    key:
      review.kind === "overpaid"
        ? "merchant.invoiceStatus.amountReviewOverpaidReceived"
        : "merchant.invoiceStatus.amountReviewUnderpaidReceived",
    params: { received, currency },
  };
}

export function transactionHasSettlement(transaction: Pick<TransactionItem, "gross_amount">): boolean {
  const gross = Number(String(transaction.gross_amount ?? "").replace(",", "."));
  return Number.isFinite(gross) && gross > 0;
}

/** Before settlement the ledger gross is zero. Show the invoice quote, or the received sum on a mismatch. */
export function transactionDisplayAmount(transaction: TransactionQuote): {
  amount: string;
  currency: string;
  cryptoAmount: string | null;
  cryptoCurrency: string | null;
} {
  const review = transaction.amount_review;
  const received =
    review?.received_amount && Number(review.received_amount) > 0 ? review.received_amount : null;
  const reviewCurrency = received ? review?.currency || transaction.crypto_currency || null : null;
  const cryptoAmount =
    transaction.amount_crypto && Number(transaction.amount_crypto) > 0 ? transaction.amount_crypto : null;
  const cryptoCurrency = cryptoAmount ? transaction.crypto_currency ?? null : null;
  if (transactionHasSettlement(transaction)) {
    const grossMatchesReceived =
      reviewCurrency != null &&
      transaction.currency.trim().toUpperCase() === reviewCurrency.trim().toUpperCase();
    return {
      amount: transaction.gross_amount,
      currency: transaction.currency,
      cryptoAmount: grossMatchesReceived ? null : received,
      cryptoCurrency: grossMatchesReceived ? null : reviewCurrency,
    };
  }
  if (received && reviewCurrency) {
    return {
      amount: received,
      currency: reviewCurrency,
      cryptoAmount: null,
      cryptoCurrency: null,
    };
  }
  const fiat = Number(transaction.amount_fiat ?? "");
  if (transaction.amount_fiat && transaction.fiat_currency && Number.isFinite(fiat) && fiat > 0) {
    const sameAsset =
      cryptoCurrency != null &&
      transaction.fiat_currency.trim().toUpperCase() === cryptoCurrency.trim().toUpperCase();
    return {
      amount: transaction.amount_fiat,
      currency: transaction.fiat_currency,
      cryptoAmount: sameAsset ? null : cryptoAmount,
      cryptoCurrency: sameAsset ? null : cryptoCurrency,
    };
  }
  if (cryptoAmount && cryptoCurrency) {
    return {
      amount: cryptoAmount,
      currency: cryptoCurrency,
      cryptoAmount: null,
      cryptoCurrency: null,
    };
  }
  return {
    amount: transaction.gross_amount,
    currency: transaction.currency,
    cryptoAmount: null,
    cryptoCurrency: null,
  };
}

export function transactionTotalFee(
  transaction: Pick<
    TransactionItem,
    "total_fee" | "provider_fee" | "platform_fee" | "turnover_fee"
  >,
): string {
  if (transaction.total_fee) {
    return transaction.total_fee;
  }
  const parts = [transaction.provider_fee, transaction.platform_fee, transaction.turnover_fee]
    .filter((value): value is string => Boolean(value))
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (parts.length === 0) {
    return "0";
  }
  return parts.reduce((sum, value) => sum + value, 0).toString();
}

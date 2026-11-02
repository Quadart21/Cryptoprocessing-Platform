import type { InvoiceDetail, InvoiceSettlement, TransactionItem } from "../api";

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
>;

export function transactionHasSettlement(transaction: Pick<TransactionItem, "gross_amount">): boolean {
  const gross = Number(String(transaction.gross_amount ?? "").replace(",", "."));
  return Number.isFinite(gross) && gross > 0;
}

/** Before settlement the ledger gross is zero. Show the invoice quote instead. */
export function transactionDisplayAmount(transaction: TransactionQuote): {
  amount: string;
  currency: string;
  cryptoAmount: string | null;
  cryptoCurrency: string | null;
} {
  const cryptoAmount =
    transaction.amount_crypto && Number(transaction.amount_crypto) > 0 ? transaction.amount_crypto : null;
  const cryptoCurrency = cryptoAmount ? transaction.crypto_currency ?? null : null;
  if (transactionHasSettlement(transaction)) {
    return {
      amount: transaction.gross_amount,
      currency: transaction.currency,
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

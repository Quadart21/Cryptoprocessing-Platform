import type { InvoiceItem, TransactionItem } from "../api";

const STABLECOIN_EQUIVALENTS = new Set(["USDT", "USDC", "USD"]);

function normalizeAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim().replace(",", ".");
}

function amountsEqual(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
): boolean {
  const a = normalizeAmount(left);
  const b = normalizeAmount(right);
  if (!a || !b) {
    return false;
  }
  return a === b;
}

export function findTransactionForInvoice(
  transactions: TransactionItem[],
  invoiceId: string,
): TransactionItem | undefined {
  return transactions.find((transaction) => transaction.invoice_id === invoiceId);
}

function isPaidLikeAltcoInvoice(
  invoice: Pick<InvoiceItem, "status" | "crypto_currency">,
): boolean {
  const status = (invoice.status ?? "").trim().toLowerCase();
  if (status !== "paid" && status !== "confirmed") {
    return false;
  }
  const crypto = (invoice.crypto_currency ?? "").trim().toUpperCase();
  return crypto.length > 0 && !STABLECOIN_EQUIVALENTS.has(crypto);
}

/** Gross in USDT equals crypto units — classic DOGE-as-USDT settlement bug. */
export function invoiceNeedsSettlementRepair(
  invoice: Pick<InvoiceItem, "id" | "status" | "amount_crypto" | "crypto_currency">,
  transaction: TransactionItem | undefined,
): boolean {
  if (!transaction || !isPaidLikeAltcoInvoice(invoice)) {
    return false;
  }
  if ((transaction.currency ?? "").trim().toUpperCase() !== "USDT") {
    return false;
  }
  return amountsEqual(transaction.gross_amount, invoice.amount_crypto);
}

/** Paid altcoin — repair can be attempted even if heuristic mismatch (API validates). */
export function invoiceCanAttemptSettlementRepair(
  invoice: Pick<InvoiceItem, "status" | "crypto_currency">,
  transaction: TransactionItem | undefined,
): boolean {
  if (!transaction || !isPaidLikeAltcoInvoice(invoice)) {
    return false;
  }
  return (transaction.currency ?? "").trim().toUpperCase() === "USDT";
}

import type { InvoiceItem, TransactionItem } from "../api";

const STABLECOIN_EQUIVALENTS = new Set(["USDT", "USDC", "USD"]);

export function findTransactionForInvoice(
  transactions: TransactionItem[],
  invoiceId: string,
): TransactionItem | undefined {
  return transactions.find((transaction) => transaction.invoice_id === invoiceId);
}

/** Gross in USDT equals crypto units — classic DOGE-as-USDT settlement bug. */
export function invoiceNeedsSettlementRepair(
  invoice: Pick<InvoiceItem, "id" | "status" | "amount_crypto" | "crypto_currency">,
  transaction: TransactionItem | undefined,
): boolean {
  if (!transaction) {
    return false;
  }
  const status = invoice.status.trim().toLowerCase();
  if (status !== "paid" && status !== "confirmed") {
    return false;
  }
  const crypto = invoice.crypto_currency.trim().toUpperCase();
  if (STABLECOIN_EQUIVALENTS.has(crypto)) {
    return false;
  }
  if (transaction.currency.trim().toUpperCase() !== "USDT") {
    return false;
  }
  return transaction.gross_amount === invoice.amount_crypto;
}

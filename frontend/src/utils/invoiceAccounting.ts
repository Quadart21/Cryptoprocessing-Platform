import type { InvoiceDetail, InvoiceSettlement } from "../api";

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

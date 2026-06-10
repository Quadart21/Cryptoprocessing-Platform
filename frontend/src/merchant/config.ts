import type { MerchantSection } from "./types";

const MERCHANT_SECTION_KEYS: MerchantSection[] = [
  "overview",
  "transactions",
  "balance",
  "docs",
  "projects",
  "keys",
  "invoices",
  "security",
];

export function isMerchantSection(value: string): value is MerchantSection {
  return MERCHANT_SECTION_KEYS.includes(value as MerchantSection);
}

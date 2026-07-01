export type DocsSectionKey =
  | "quickstart"
  | "checkout"
  | "webhooks"
  | "integrations"
  | "commissions"
  | "reference"
  | "faq";

const DOCS_SECTION_BLOCKS: Record<DocsSectionKey, string[]> = {
  quickstart: ["toolbar", "start", "auth"],
  checkout: ["checkout"],
  webhooks: ["webhooks"],
  integrations: ["integrations"],
  commissions: ["commissions"],
  reference: ["toolbar", "endpoints", "reference"],
  faq: ["faq"],
};

export function docsShowsBlock(
  section: DocsSectionKey | undefined,
  block: string,
  isDocsPresentation: boolean,
): boolean {
  if (!isDocsPresentation) {
    return true;
  }
  if (!section) {
    return false;
  }
  return DOCS_SECTION_BLOCKS[section]?.includes(block) ?? false;
}

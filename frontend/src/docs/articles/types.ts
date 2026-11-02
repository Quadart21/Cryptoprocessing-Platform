export type DocsArticleKey =
  | "quickstart"
  | "invoices"
  | "checkout"
  | "webhooks"
  | "balance"
  | "transactions"
  | "rates"
  | "reference";

export type DocsBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; ordered?: boolean; items: string[] }
  | { kind: "note"; tone: "info" | "warn"; text: string }
  | { kind: "params"; rows: Array<{ name: string; required: string; text: string }> }
  | { kind: "code"; label: string; text: string }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "links"; items: Array<{ to: string; title: string; text: string }> };

export type DocsArticleSection = {
  id: string;
  title: string;
  blocks: DocsBlock[];
};

export type DocsArticle = {
  sections: DocsArticleSection[];
};

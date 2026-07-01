export type IntegrationModuleId = "wordpress" | "dle" | "tilda" | "oneC";

export type IntegrationModuleMeta = {
  id: IntegrationModuleId;
  downloadFile: string;
  githubPath: string;
  orderPrefix: string;
  requirementsKey: string;
};

export const INTEGRATION_MODULES: IntegrationModuleMeta[] = [
  {
    id: "wordpress",
    downloadFile: "noren-wordpress.zip",
    githubPath: "integrations/wordpress/noren-payments",
    orderPrefix: "wc-{order_id}",
    requirementsKey: "wordpress",
  },
  {
    id: "dle",
    downloadFile: "noren-dle.zip",
    githubPath: "integrations/dle",
    orderPrefix: "dle-{billing_invoice_id}",
    requirementsKey: "dle",
  },
  {
    id: "tilda",
    downloadFile: "noren-tilda.zip",
    githubPath: "integrations/tilda",
    orderPrefix: "tilda-{order_id}",
    requirementsKey: "tilda",
  },
  {
    id: "oneC",
    downloadFile: "noren-1c.zip",
    githubPath: "integrations/1c",
    orderPrefix: "1c-{order_number}",
    requirementsKey: "oneC",
  },
];

export const INTEGRATIONS_BUNDLE_FILE = "noren-integrations-all.zip";

export const GITHUB_REPO = "Quadart21/Cryptoprocessing-Platform";

export function integrationDownloadUrl(fileName: string): string {
  return `/downloads/${fileName}`;
}

export function integrationGithubTreeUrl(githubPath: string, tag = "main"): string {
  return `https://github.com/${GITHUB_REPO}/tree/${tag}/${githubPath}`;
}

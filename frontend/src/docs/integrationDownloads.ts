export type IntegrationModuleId = "wordpress" | "dle" | "tilda" | "oneC";

export type IntegrationModuleMeta = {
  id: IntegrationModuleId;
  downloadFile: string;
  orderPrefix: string;
  requirementsKey: string;
};

export const INTEGRATION_MODULES: IntegrationModuleMeta[] = [
  {
    id: "wordpress",
    downloadFile: "noren-wordpress.zip",
    orderPrefix: "wc-{order_id}",
    requirementsKey: "wordpress",
  },
  {
    id: "dle",
    downloadFile: "noren-dle.zip",
    orderPrefix: "dle-{billing_invoice_id}",
    requirementsKey: "dle",
  },
  {
    id: "tilda",
    downloadFile: "noren-tilda.zip",
    orderPrefix: "tilda-{order_id}",
    requirementsKey: "tilda",
  },
  {
    id: "oneC",
    downloadFile: "noren-1c.zip",
    orderPrefix: "1c-{order_number}",
    requirementsKey: "oneC",
  },
];

export const INTEGRATIONS_BUNDLE_FILE = "noren-integrations-all.zip";

export function integrationDownloadUrl(fileName: string): string {
  return `/downloads/${fileName}`;
}

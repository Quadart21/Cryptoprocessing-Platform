import { useTranslation } from "../i18n";

const PYTHON_SAMPLE = `from noren import NorenClient

client = NorenClient(
    public_key="pk_...",
    secret_key="sk_...",
    project_id="prj_...",
)
invoice = client.create_invoice(
    merchant_order_id="order-1001",
    amount_fiat="100.00",
)
print(invoice["payment_page_url"])`;

const NODE_SAMPLE = `import { NorenClient } from "noren-merchant";

const client = new NorenClient({
  publicKey: process.env.NOREN_PUBLIC_KEY,
  secretKey: process.env.NOREN_SECRET_KEY,
  projectId: process.env.NOREN_PROJECT_ID,
});
const invoice = await client.createInvoice({
  merchantOrderId: "order-1001",
  amountFiat: "100.00",
});
console.log(invoice.payment_page_url);`;

export function DocsSdkSection() {
  const { t } = useTranslation();

  return (
    <section className="docs-intro-section">
      <div className="docs-section-head">
        <p>{t("merchant.apiDocs.integrations.sdkEyebrow")}</p>
        <h2>{t("merchant.apiDocs.integrations.sdkTitle")}</h2>
      </div>
      <p className="muted-text">{t("merchant.apiDocs.integrations.sdkLead")}</p>
      <div className="docs-integration-grid">
        <article className="docs-integration-card">
          <div className="docs-integration-card-head">
            <span className="docs-integration-card-icon">PY</span>
            <div>
              <h3>{t("merchant.apiDocs.integrations.sdkPythonTitle")}</h3>
              <p>{t("merchant.apiDocs.integrations.sdkPythonSubtitle")}</p>
            </div>
          </div>
          <p className="docs-integration-card-body">
            <code>pip install ./sdks/python</code>
          </p>
          <pre className="json-box">{PYTHON_SAMPLE}</pre>
        </article>
        <article className="docs-integration-card">
          <div className="docs-integration-card-head">
            <span className="docs-integration-card-icon">JS</span>
            <div>
              <h3>{t("merchant.apiDocs.integrations.sdkNodeTitle")}</h3>
              <p>{t("merchant.apiDocs.integrations.sdkNodeSubtitle")}</p>
            </div>
          </div>
          <p className="docs-integration-card-body">
            <code>npm install ./sdks/node</code>
          </p>
          <pre className="json-box">{NODE_SAMPLE}</pre>
        </article>
      </div>
      <p className="muted-text">{t("merchant.apiDocs.integrations.sdkPublishNote")}</p>
    </section>
  );
}

import { ApiDocumentationPanel } from "./client/ApiDocumentationPanel";
import { resolveClientApiBaseUrl } from "../config/apiBase";
import { PlatformBrandMark, usePlatformBrand } from "../brand/PlatformBrandLogo";

type PublicDocsPageProps = {
  onBackToLanding: () => void;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
};

export function PublicDocsPage({
  onBackToLanding,
  onOpenLogin,
  onOpenRegister,
}: PublicDocsPageProps) {
  const apiBaseUrl = resolveClientApiBaseUrl();
  const { brandName, logoUrl } = usePlatformBrand();
  const integrationCurl = `curl -X POST "${apiBaseUrl}/invoices" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "<project_id>",
    "merchant_order_id": "order_1001",
    "amount_fiat": 100,
    "fiat_currency": "USD",
    "crypto_currency": "USDT",
    "network": "TRC20"
  }'`;

  return (
    <main className="public-docs-page">
      <header className="public-docs-topbar">
        <a
          className="nc-brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            onBackToLanding();
          }}
          aria-label={brandName}
        >
          {logoUrl ? (
            <PlatformBrandMark imgClassName="nc-brand-logo-img" />
          ) : (
            <span className="nc-brand-dot" />
          )}
          {!logoUrl ? <strong>{brandName}</strong> : null}
        </a>
        <div className="public-docs-actions">
          <button className="ghost-button" type="button" onClick={onBackToLanding}>
            Главная
          </button>
          <button className="ghost-button" type="button" onClick={onOpenLogin}>
            Войти
          </button>
          <button className="primary-button" type="button" onClick={onOpenRegister}>
            Подключить проект
          </button>
        </div>
      </header>

      <section className="public-docs-shell public-docs-shell-landing">
        <ApiDocumentationPanel
          apiBaseUrl={apiBaseUrl}
          activeApiKeyPublic={null}
          selectedRoute="USDT / TRC20"
          activeWebhookUrl="https://merchant.example.com/webhooks/norencash"
          integrationCurl={integrationCurl}
        />
      </section>
    </main>
  );
}

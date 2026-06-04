import { resolveMainSiteOrigin } from "../config/siteHost";

export function PayPageMissing() {
  const mainSite = resolveMainSiteOrigin();
  return (
    <div className="pay-missing">
      <div className="pay-missing__card">
        <h1>Ссылка на оплату недействительна</h1>
        <p>Откройте полную ссылку из счёта или письма с QR-кодом.</p>
        <a href={mainSite}>На главную</a>
      </div>
    </div>
  );
}

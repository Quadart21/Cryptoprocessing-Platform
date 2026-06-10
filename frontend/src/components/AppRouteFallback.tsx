import { useTranslation } from "../i18n";

/** Minimal UI while a lazy chunk loads (React.lazy + Suspense). */
export function AppRouteFallback() {
  const { t } = useTranslation();

  return (
    <div className="app-route-fallback">
      <div className="app-route-fallback-inner">
        <p>{t("merchant.app.loadingUi")}</p>
      </div>
    </div>
  );
}

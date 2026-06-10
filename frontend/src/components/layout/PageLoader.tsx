import { useTranslation } from "../../i18n";

type PageLoaderProps = {
  label?: string;
};

export function PageLoader({ label }: PageLoaderProps) {
  const { t } = useTranslation();

  return (
    <div className="page-loader">
      <p>{label ?? t("merchant.app.loadingUi")}</p>
    </div>
  );
}

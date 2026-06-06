import type {
  PlatformAccountingOverview,
  PlatformEarningsWithdrawalPayload,
} from "../../api";
import { PlatformAccountingPanel } from "./PlatformAccountingPanel";

type AdminOverviewSectionProps = {
  platformAccountingOverview: PlatformAccountingOverview | null;
  isSuperadmin?: boolean;
  loading?: boolean;
  onRecordPlatformWithdrawal?: (
    payload: PlatformEarningsWithdrawalPayload,
  ) => Promise<void>;
};

export function AdminOverviewSection({
  platformAccountingOverview,
  isSuperadmin = false,
  loading = false,
  onRecordPlatformWithdrawal,
}: AdminOverviewSectionProps) {
  if (platformAccountingOverview) {
    return (
      <PlatformAccountingPanel
        overview={platformAccountingOverview}
        isSuperadmin={isSuperadmin}
        loading={loading}
        onRecordPlatformWithdrawal={onRecordPlatformWithdrawal}
      />
    );
  }

  return (
    <section className="panel aps-empty-state">
      <p className="muted-text">Загружаем бухгалтерию платформы…</p>
    </section>
  );
}

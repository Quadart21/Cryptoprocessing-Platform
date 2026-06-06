import type {
  PlatformAccountingOverview,
  PlatformEarningsWithdrawalPayload,
} from "../../api";
import { PlatformAccountingPanel } from "./PlatformAccountingPanel";

type AdminAccountingSectionProps = {
  platformAccountingOverview: PlatformAccountingOverview | null;
  isSuperadmin?: boolean;
  loading?: boolean;
  onRecordPlatformWithdrawal?: (
    payload: PlatformEarningsWithdrawalPayload,
  ) => Promise<void>;
};

export function AdminAccountingSection({
  platformAccountingOverview,
  isSuperadmin = false,
  loading = false,
  onRecordPlatformWithdrawal,
}: AdminAccountingSectionProps) {
  if (!platformAccountingOverview) {
    return (
      <section className="panel aps-empty-state">
        <p className="muted-text">Загружаем бухгалтерию платформы…</p>
      </section>
    );
  }

  return (
    <PlatformAccountingPanel
      overview={platformAccountingOverview}
      isSuperadmin={isSuperadmin}
      loading={loading}
      onRecordPlatformWithdrawal={onRecordPlatformWithdrawal}
    />
  );
}

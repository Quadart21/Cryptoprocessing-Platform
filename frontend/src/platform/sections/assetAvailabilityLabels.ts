/** Человекочитаемые подписи к `availability_reason` у сети. */
export function mapAvailabilityReason(reason: string | null): string {
  if (!reason) {
    return "не указана";
  }
  if (reason === "available") {
    return "доступно";
  }
  if (reason === "disabled_by_platform") {
    return "отключено платформой";
  }
  if (reason === "disabled_by_provider") {
    return "отключено провайдером";
  }
  if (reason === "acquiring_off") {
    return "приём отключён у провайдера";
  }
  return reason;
}

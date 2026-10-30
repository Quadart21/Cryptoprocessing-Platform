type ApprovedTenantAccess = {
  api_public_key: string;
  api_secret_key: string;
  generated_password: string;
};

/** Текст после одобрения заявки: ключи показываются один раз, поэтому строки разделены. */
export function formatTenantApprovedMessage(result: ApprovedTenantAccess): string {
  return [
    "Заявка одобрена — доступ открыт. Сохраните данные ниже: секретный ключ показывается только сейчас.",
    "",
    `Публичный ключ: ${result.api_public_key}`,
    `Секретный ключ: ${result.api_secret_key}`,
    `Пароль для входа: ${result.generated_password}`,
  ].join("\n");
}

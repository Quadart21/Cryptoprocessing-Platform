export type TemplateFieldGuide = {
  key: "email_subject" | "email_body" | "message_lines" | "telegram_body";
  title: string;
  description: string;
  channel: string;
};

export const TEMPLATE_FIELD_GUIDES: TemplateFieldGuide[] = [
  {
    key: "email_subject",
    title: "Тема письма",
    description:
      "Заголовок в почтовом клиенте (Inbox). Коротко и по делу — пользователь видит это первым. Можно использовать переменные, например {{ brand_name }} или {{ event_title }}.",
    channel: "Email",
  },
  {
    key: "email_body",
    title: "Тело email (HTML)",
    description:
      "Основное содержимое письма с форматированием: абзацы, списки, жирный/курсив, выравнивание, ссылки и изображения. Сохраняется как HTML — теги вводить вручную не нужно.",
    channel: "Email",
  },
  {
    key: "message_lines",
    title: "Текстовая версия (plain)",
    description:
      "Тот же смысл, что и тело письма, но без HTML — только строки текста. Используется как запасной текст письма и как основа для Telegram в режиме «авто».",
    channel: "Email + Telegram (авто)",
  },
  {
    key: "telegram_body",
    title: "Текст Telegram",
    description:
      "Отдельное сообщение в Telegram. Поддерживаются жирный, курсив, ссылки и изображение (первая картинка в тексте уйдёт как фото). Если оставить авто — бот отправит тему + текстовую версию.",
    channel: "Telegram",
  },
];

export const TEMPLATE_VARIABLE_HINTS: Record<string, string> = {
  event_code: "Технический код события (application_submitted, payout_approved и т.д.).",
  event_title: "Человекочитаемое название события на русском.",
  event_subject: "Готовая тема события — то, что система сформировала до подстановки в шаблон.",
  message_lines: "Основной текст уведомления одной строкой с переносами (plain).",
  message_lines_html: "HTML-версия основного текста — абзацы <p> без ручной вёрстки.",
  user_email: "Email получателя уведомления.",
  user_full_name: "Имя получателя из профиля.",
  brand_name: "Название платформы из раздела «Бренд».",
  brand_url: "Основная ссылка платформы (лендинг / кабинет).",
  notification_logo_url: "URL логотипа из раздела «Бренд» — удобно для картинок в email и Telegram.",
  utc_now: "Текущие дата и время UTC в момент отправки.",
  initiated_by_email: "Email пользователя, который инициировал действие (админ/мерчант).",
  tenant_name: "Название проекта / клиента.",
  project_id: "UUID проекта мерчанта.",
  project_name: "Отображаемое имя проекта.",
  owner_email: "Email владельца проекта.",
  temporary_password: "Временный пароль при выдаче доступа.",
  recovery_token: "Токен восстановления / invite (если есть).",
  api_secret_key: "Secret key API (конфиденциально).",
  api_public_key: "Public key API.",
  invite_token: "Invite-токен для подключения к проекту.",
  payout_id: "Идентификатор заявки на выплату.",
  payout_amount: "Сумма выплаты.",
  payout_currency: "Валюта выплаты.",
  payout_status: "Статус выплаты (approved, rejected и т.д.).",
  destination_address: "Адрес назначения выплаты.",
  review_comment: "Комментарий модератора / администратора.",
};

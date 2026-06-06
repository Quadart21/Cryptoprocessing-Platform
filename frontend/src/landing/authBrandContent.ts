export type AuthBrandFeature = {
  id: string;
  title: string;
  description: string;
  icon: "checkout" | "api" | "shield" | "rates";
};

export const AUTH_MERCHANT_FEATURES: AuthBrandFeature[] = [
  {
    id: "checkout",
    title: "Hosted checkout",
    description: "Страница оплаты /pay/{token} с QR и таймером — без своего UI.",
    icon: "checkout",
  },
  {
    id: "api",
    title: "REST API + webhooks",
    description: "Инвойсы, баланс, транзакции и колбэки в вашем backend.",
    icon: "api",
  },
  {
    id: "shield",
    title: "2FA и изоляция",
    description: "Двухфакторная защита и tenant-scoped доступ к данным.",
    icon: "shield",
  },
  {
    id: "rates",
    title: "USDT · BTC · сети",
    description: "TRC20, ERC20 и другие сети — в одном кабинете мерчанта.",
    icon: "rates",
  },
];

export const AUTH_ADMIN_FEATURES: AuthBrandFeature[] = [
  {
    id: "ops",
    title: "Операционная панель",
    description: "Инвойсы, клиенты, сверка и настройки платформы.",
    icon: "shield",
  },
  {
    id: "api",
    title: "Биллинг и курсы",
    description: "Комиссии, курсы, уведомления и бренд из одного места.",
    icon: "rates",
  },
  {
    id: "checkout",
    title: "Мониторинг",
    description: "События, транзакции и sandbox для мерчантов.",
    icon: "checkout",
  },
];

export const AUTH_TRUST_CHIPS = ["USDT", "BTC", "ETH", "TRON", "Webhooks", "H2H"] as const;

export const AUTH_REGISTRATION_STEPS = [
  { id: "profile", label: "Профиль компании" },
  { id: "access", label: "Доступ и домен" },
  { id: "cabinet", label: "Кабинет мерчанта" },
] as const;

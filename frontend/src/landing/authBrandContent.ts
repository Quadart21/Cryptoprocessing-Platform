export const AUTH_MERCHANT_HIGHLIGHTS = [
  "Инвойсы и hosted checkout",
  "REST API и webhooks",
  "USDT, BTC и другие сети",
] as const;

export const AUTH_ADMIN_HIGHLIGHTS = [
  "Клиенты и инвойсы",
  "Биллинг и курсы",
  "Sandbox и мониторинг",
] as const;

export const AUTH_TRUST_CHIPS = ["USDT", "BTC", "ETH", "TRON", "Webhooks", "H2H"] as const;

export const AUTH_REGISTRATION_STEPS = [
  { id: "profile", label: "Профиль компании" },
  { id: "access", label: "Доступ и домен" },
  { id: "cabinet", label: "Кабинет мерчанта" },
] as const;

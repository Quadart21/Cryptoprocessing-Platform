export const LANDING_FEATURE_CARDS = [

  {

    icon: "zap" as const,

    title: "Быстрый старт",

    description:

      "SDK, REST API и готовые примеры. Интеграция занимает дни, не месяцы.",

    bento: "wide" as const,

  },

  {

    icon: "globe" as const,

    title: "Без географии",

    description: "Приём платежей без привязки к локальным банкам и валютным ограничениям.",

    bento: "normal" as const,

  },

  {

    icon: "shield" as const,

    title: "Полный контроль",

    description: "Статусы инвойсов, вебхуки и журнал событий — весь цикл платежа в одном месте.",

    bento: "normal" as const,

  },

  {

    icon: "dollar" as const,

    title: "Фиксированные условия",

    description: "Одна модель комиссии. Условия согласуются до запуска.",

    bento: "wide" as const,

  },

];



export const LANDING_FLOW_STEPS = [

  {

    number: "01",

    title: "Заявка",

    description: "Короткая анкета и согласование формата подключения.",

  },

  {

    number: "02",

    title: "Интеграция",

    description: "API или виджет, вебхуки, тестовая среда.",

  },

  {

    number: "03",

    title: "Приёмка",

    description: "Проверяем сценарии оплаты, колбэки и статусы.",

  },

  {

    number: "04",

    title: "Запуск",

    description: "Включаем продакшн — приём платежей в вашем продукте.",

  },

];



export const LANDING_FAQ = [

  {

    question: "Какие сети и активы поддерживаются?",

    answer:

      "BTC, ETH, USDT (TRC-20, ERC-20) и ряд L1/L2. Полный список — при подключении.",

  },

  {

    question: "Как устроены выплаты и сроки?",

    answer:

      "График и лимиты зависят от тарифа. Фиксируются в договоре.",

  },

  {

    question: "Нужно ли юридическое лицо?",

    answer:

      "Работаем с юрлицами и ИП. Пакет документов — по юрисдикции.",

  },

  {

    question: "Есть ли тестовая среда?",

    answer:

      "Да. Sandbox для отладки интеграции и вебхуков до продакшна.",

  },

];



export const LANDING_TOKEN_STRIP = ["BTC", "ETH", "USDT", "TRON", "BNB", "SOL"] as const;



export const LANDING_TRUST_PILLARS = [

  { title: "Без карточных данных", subtitle: "Клиент платит в сети — вы управляете заказами." },

  { title: "Статусы и вебхуки", subtitle: "События на ваш backend для учёта и CRM." },

  { title: "Сопровождение", subtitle: "Один контакт на технические и платёжные вопросы." },

] as const;



export const LANDING_PLATFORM_POINTS = [

  "REST API с ключами и rate limit по проекту",

  "Webhooks с подписью и идемпотентностью",

  "Sandbox до выхода в продакшн",

  "Кабинет: инвойсы, транзакции, оборот",

] as const;



export const LANDING_HERO_STATS_CARD = [

  { value: "≤24 ч", label: "Слот на интеграцию" },

  { value: "SLA", label: "Поддержка" },

  { value: "API", label: "Статусы в реальном времени" },

] as const;

/** Три карточки в ряд (как на референсе); четвёртая — в сетке ниже */
export const LANDING_FEATURE_SHOWCASE = LANDING_FEATURE_CARDS.slice(0, 3);


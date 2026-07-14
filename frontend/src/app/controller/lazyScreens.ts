import { lazy } from "react";

/** Консоль платформы (~ platform/* + секции админки) */
export const AdminDashboardLazy = lazy(async () => {
  const m = await import("../../screens/AdminDashboard");
  return { default: m.AdminDashboard };
});

/** Кабинет мерчанта (~ merchant/*) */
export const ClientDashboardLazy = lazy(async () => {
  const m = await import("../../screens/ClientDashboard");
  return { default: m.ClientDashboard };
});

/** Кабинет affiliate-партнёра */
export const PartnerDashboardLazy = lazy(async () => {
  const m = await import("../../screens/PartnerDashboard");
  return { default: m.PartnerDashboard };
});

/** Публичный лендинг (~ landing/*) */
export const LandingPageLazy = lazy(async () => {
  const m = await import("../../screens/LandingPage");
  return { default: m.LandingPage };
});

export const OnboardingScreenLazy = lazy(async () => {
  const m = await import("../../screens/OnboardingScreen");
  return { default: m.OnboardingScreen };
});

/** API-документация (тяжёлая MerchantApiReference из merchant/) */
export const PublicDocsPageLazy = lazy(async () => {
  const m = await import("../../screens/PublicDocsPage");
  return { default: m.PublicDocsPage };
});

export const PublicCmsPageLazy = lazy(async () => {
  const m = await import("../../screens/PublicCmsPage");
  return { default: m.PublicCmsPage };
});

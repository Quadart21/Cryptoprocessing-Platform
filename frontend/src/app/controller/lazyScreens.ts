import { lazy } from "react";

export const AdminDashboardScreen = lazy(async () => ({
  default: (await import("../../screens/AdminDashboard")).AdminDashboard,
}));

export const ClientDashboardScreen = lazy(async () => ({
  default: (await import("../../screens/ClientDashboard")).ClientDashboard,
}));

export const LandingPageScreen = lazy(async () => ({
  default: (await import("../../screens/LandingPage")).LandingPage,
}));

export const OnboardingScreenPage = lazy(async () => ({
  default: (await import("../../screens/OnboardingScreen")).OnboardingScreen,
}));

export const PublicDocsPageScreen = lazy(async () => ({
  default: (await import("../../screens/PublicDocsPage")).PublicDocsPage,
}));

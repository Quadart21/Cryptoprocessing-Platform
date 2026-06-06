import type { SeoSettings } from "../api";

export const DEFAULT_PLATFORM_BRAND_NAME = "NorenDigital";

export type PlatformBrand = {
  brandName: string;
  logoUrl: string | null;
  loaded: boolean;
};

export function resolvePlatformBrand(settings: SeoSettings | null): PlatformBrand {
  const brandName = settings?.brand_name?.trim() || DEFAULT_PLATFORM_BRAND_NAME;
  const logoUrl = settings?.logo_url?.trim() || null;

  return {
    brandName,
    logoUrl,
    loaded: settings !== null,
  };
}

export function brandInitials(brandName: string): string {
  const parts = brandName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "ND";
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

export function usesDefaultLandingWordmark(brand: PlatformBrand): boolean {
  return brand.brandName === DEFAULT_PLATFORM_BRAND_NAME && !brand.logoUrl;
}

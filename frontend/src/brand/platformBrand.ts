import type { SeoSettings } from "../api";

export const DEFAULT_PLATFORM_BRAND_NAME = "NorenDigital";

export type PlatformBrand = {
  brandName: string;
  logoUrl: string | null;
  loaded: boolean;
};

export function resolveBrandLogoUrlForDisplay(logoUrl: string | null | undefined): string | null {
  const normalized = logoUrl?.trim() ?? "";
  if (!normalized) {
    return null;
  }

  if (typeof window === "undefined") {
    return normalized;
  }

  let uploadPath: string | null = null;

  if (normalized.startsWith("/uploads/")) {
    uploadPath = normalized;
  } else {
    try {
      const parsed = new URL(normalized);
      if (parsed.pathname.startsWith("/uploads/")) {
        uploadPath = `${parsed.pathname}${parsed.search}`;
      }
    } catch {
      return normalized;
    }
  }

  if (uploadPath) {
    return `${window.location.origin}${uploadPath}`;
  }

  return normalized;
}

export function resolvePlatformBrand(settings: SeoSettings | null): PlatformBrand {
  const brandName = settings?.brand_name?.trim() || DEFAULT_PLATFORM_BRAND_NAME;
  const logoUrl = resolveBrandLogoUrlForDisplay(settings?.logo_url?.trim() || null);

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

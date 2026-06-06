import { createContext, useContext, type ReactNode } from "react";

import type { SeoSettings } from "../api";

import { DEFAULT_PLATFORM_BRAND_NAME, resolvePlatformBrand, type PlatformBrand } from "./platformBrand";

const PlatformBrandContext = createContext<PlatformBrand>({
  brandName: DEFAULT_PLATFORM_BRAND_NAME,
  logoUrl: null,
  loaded: false,
});

type PlatformBrandProviderProps = {
  settings: SeoSettings | null;
  children: ReactNode;
};

export function PlatformBrandProvider({ settings, children }: PlatformBrandProviderProps) {
  return (
    <PlatformBrandContext.Provider value={resolvePlatformBrand(settings)}>
      {children}
    </PlatformBrandContext.Provider>
  );
}

export function usePlatformBrand(): PlatformBrand {
  return useContext(PlatformBrandContext);
}

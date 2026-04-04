import { useCallback, useEffect, useState } from "react";

import {
  fetchPublicPageBySlug,
  fetchPublicPages,
  type PublicPageItem,
  type PublicPageNavigationItem,
} from "../api";

export type PublicPageView = "landing" | "docs" | "cms";

export type PublicRouteState = {
  view: PublicPageView;
  cmsSlug: string | null;
};

function resolvePublicRoute(): PublicRouteState {
  if (typeof window === "undefined") {
    return { view: "landing", cmsSlug: null };
  }
  const hash = window.location.hash.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();
  if (pathname.startsWith("/page/")) {
    const slug = window.location.pathname.slice("/page/".length).trim();
    return { view: "cms", cmsSlug: slug || null };
  }
  return { view: hash === "#docs" ? "docs" : "landing", cmsSlug: null };
}

function applyPublicRoute(route: PublicRouteState): void {
  if (typeof window === "undefined") {
    return;
  }
  const nextUrl =
    route.view === "docs"
      ? "/#docs"
      : route.view === "cms" && route.cmsSlug
        ? `/page/${route.cmsSlug}`
        : "/";
  const current = `${window.location.pathname}${window.location.hash}`;
  if (current === nextUrl) {
    return;
  }
  window.history.pushState({}, "", nextUrl);
}

type UsePublicSiteNavigationParams = {
  authenticated: boolean;
};

export function usePublicSiteNavigation({ authenticated }: UsePublicSiteNavigationParams) {
  const [publicRoute, setPublicRoute] = useState<PublicRouteState>(() => resolvePublicRoute());
  const [publicNavigationItems, setPublicNavigationItems] = useState<PublicPageNavigationItem[]>([]);
  const [publicPageDetail, setPublicPageDetail] = useState<PublicPageItem | null>(null);

  const refreshPublicContent = useCallback(async () => {
    try {
      const nav = await fetchPublicPages("published");
      setPublicNavigationItems(nav.items);
      if (publicRoute.view === "cms" && publicRoute.cmsSlug) {
        const page = await fetchPublicPageBySlug(publicRoute.cmsSlug);
        setPublicPageDetail(page);
      } else {
        setPublicPageDetail(null);
      }
    } catch {
      setPublicNavigationItems([]);
      setPublicPageDetail(null);
    }
  }, [publicRoute.view, publicRoute.cmsSlug]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    function syncPublicRoute() {
      setPublicRoute(resolvePublicRoute());
    }
    window.addEventListener("hashchange", syncPublicRoute);
    window.addEventListener("popstate", syncPublicRoute);
    return () => {
      window.removeEventListener("hashchange", syncPublicRoute);
      window.removeEventListener("popstate", syncPublicRoute);
    };
  }, []);

  useEffect(() => {
    if (authenticated) {
      return;
    }
    void refreshPublicContent();
  }, [authenticated, refreshPublicContent]);

  const openPublicPage = useCallback((nextView: PublicPageView, slug: string | null = null) => {
    const nextRoute: PublicRouteState = { view: nextView, cmsSlug: slug };
    setPublicRoute(nextRoute);
    applyPublicRoute(nextRoute);
  }, []);

  return {
    publicRoute,
    publicNavigationItems,
    publicPageDetail,
    openPublicPage,
    refreshPublicContent,
  };
}

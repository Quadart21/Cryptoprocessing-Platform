import { type ReactNode } from "react";
import { Router, parsePath, type Path, type To } from "react-router-dom";

function createHref(to: To): string {
  if (typeof to === "string") {
    return to;
  }
  const pathname = to.pathname ?? "";
  const search = to.search ?? "";
  const hash = to.hash ?? "";
  return `${pathname}${search}${hash}` || "/";
}

const staticNavigator = {
  createHref,
  encodeLocation(to: To): Path {
    const parsed = typeof to === "string" ? parsePath(to) : to;
    return {
      pathname: parsed.pathname ?? "/",
      search: parsed.search ?? "",
      hash: parsed.hash ?? "",
    };
  },
  push() {},
  replace() {},
  go() {},
};

type StaticPublicRouterProps = {
  location: string;
  children: ReactNode;
};

/** Router for renderToString. BrowserRouter needs window.history. */
export function StaticPublicRouter({ location, children }: StaticPublicRouterProps) {
  return (
    <Router location={location} navigator={staticNavigator} static={true}>
      {children}
    </Router>
  );
}

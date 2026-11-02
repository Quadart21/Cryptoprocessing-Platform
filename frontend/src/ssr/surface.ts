import { resolvePayPageToken } from "../pay/publicPayApi";
import { getPublicRequestContext, type PublicSurface } from "./requestContext";

export type InitialSurface = PublicSurface | "app";

export function resolveInitialSurface(): InitialSurface {
  const ctx = getPublicRequestContext();
  if (ctx) {
    return ctx.surface;
  }
  if (typeof window === "undefined") {
    return "app";
  }
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.startsWith("docs.")) {
    return "docs";
  }
  const prefix = hostname.split(".")[0] ?? "";
  if (prefix === "admin" || prefix === "app" || prefix === "pay" || prefix === "api") {
    return "app";
  }
  if (resolvePayPageToken()) {
    return "app";
  }
  const path = window.location.pathname;
  if (path === "/" || path === "") {
    return "landing";
  }
  return "app";
}

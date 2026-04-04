export type PublicPage = "landing" | "docs";

export function resolvePublicPage(): PublicPage {
  if (typeof window === "undefined") {
    return "landing";
  }

  return window.location.hash.toLowerCase() === "#docs" ? "docs" : "landing";
}

export function setPublicPageHash(page: PublicPage): void {
  if (typeof window === "undefined") {
    return;
  }

  const nextHash = page === "docs" ? "#docs" : "";
  if (window.location.hash === nextHash) {
    return;
  }

  window.location.hash = nextHash;
}

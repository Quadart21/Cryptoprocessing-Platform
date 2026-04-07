import { request } from "./base";
import type {
  PublicPageItem,
  PublicPageListResponse,
  PublicPageNavigationItem,
  SeoSettings,
} from "./base";

export function fetchPublicPages(statusFilter = "published"): Promise<PublicPageListResponse> {
  const query = `?status_filter=${encodeURIComponent(statusFilter)}`;
  return request<PublicPageListResponse>(`/client/public-pages${query}`);
}

export function fetchPublicPageBySlug(slug: string): Promise<PublicPageItem> {
  return request<PublicPageItem>(`/client/public-pages/${encodeURIComponent(slug)}`);
}

export function fetchSeoSettings(): Promise<SeoSettings> {
  return request<SeoSettings>("/public/seo");
}

export type {
  PublicPageItem,
  PublicPageListResponse,
  PublicPageNavigationItem,
};

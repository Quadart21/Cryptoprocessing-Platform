import { request } from "./base";
import type {
  PublicPageItem,
  PublicPageListResponse,
  PublicPageNavigationItem,
} from "./base";

export function fetchPublicPages(statusFilter = "published"): Promise<PublicPageListResponse> {
  const query = `?status_filter=${encodeURIComponent(statusFilter)}`;
  return request<PublicPageListResponse>(`/client/public-pages${query}`);
}

export function fetchPublicPageBySlug(slug: string): Promise<PublicPageItem> {
  return request<PublicPageItem>(`/client/public-pages/${encodeURIComponent(slug)}`);
}

export type {
  PublicPageItem,
  PublicPageListResponse,
  PublicPageNavigationItem,
};

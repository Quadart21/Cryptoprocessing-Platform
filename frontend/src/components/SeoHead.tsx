import { useEffect } from "react";

import type { SeoSettings } from "../api";

type SeoHeadProps = {
  settings: SeoSettings | null;
};

export function SeoHead({ settings }: SeoHeadProps) {
  useEffect(() => {
    if (!settings) {
      return;
    }

    const updateMetaTag = (nameOrProperty: string, content: string | null, isProperty: boolean = false) => {
      let element = document.querySelector(isProperty ? `meta[property="${nameOrProperty}"]` : `meta[name="${nameOrProperty}"]`) as HTMLMetaElement | null;
      
      if (!content) {
        if (element) {
          element.remove();
        }
        return;
      }

      if (!element) {
        element = document.createElement("meta");
        if (isProperty) {
          element.setAttribute("property", nameOrProperty);
        } else {
          element.setAttribute("name", nameOrProperty);
        }
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    if (settings.title) {
      document.title = settings.title;
    }

    updateMetaTag("description", settings.description);
    updateMetaTag("keywords", settings.keywords);
    updateMetaTag("robots", settings.robots);

    updateMetaTag("og:title", settings.title, true);
    updateMetaTag("og:description", settings.description, true);
    updateMetaTag("og:image", settings.og_image_url, true);
    updateMetaTag("og:url", settings.canonical_url, true);

    if (settings.favicon_url) {
      let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        document.head.appendChild(favicon);
      }
      favicon.href = settings.favicon_url;
    }

    if (settings.canonical_url) {
      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
      }
      canonical.href = settings.canonical_url;
    }
  }, [settings]);

  return null;
}

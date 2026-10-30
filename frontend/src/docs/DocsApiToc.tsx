import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { useTranslation } from "../i18n";
import { useDocsApiEndpoints } from "./useDocsNav";

type DocsApiTocProps = {
  variant?: "aside" | "inline";
};

export function DocsApiToc({ variant = "aside" }: DocsApiTocProps) {
  const location = useLocation();
  const { t } = useTranslation();
  const endpoints = useDocsApiEndpoints();
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const anchors = endpoints.map((item) => item.href.slice(1));
    const elements = anchors
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (!elements.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-15% 0px -60% 0px", threshold: [0.1, 0.35, 0.6] },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [endpoints, location.pathname, location.hash]);

  return (
    <aside
      className={`docs-api-toc${variant === "inline" ? " docs-api-toc--inline" : ""}`}
      aria-label={t("docsSite.endpointsAria")}
    >
      <div className="docs-api-toc-panel">
        <p className="docs-site-sidebar-label">{t("docsSite.onThisPage")}</p>
        <nav className="docs-api-toc-nav">
          {endpoints.map((item) => {
            const id = item.href.slice(1);
            return (
              <a className={activeId === id ? "is-active" : undefined} href={item.href} key={item.href}>
                <span className={`docs-api-toc-method docs-api-toc-method-${item.method.toLowerCase()}`}>
                  {item.method}
                </span>
                {item.label}
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

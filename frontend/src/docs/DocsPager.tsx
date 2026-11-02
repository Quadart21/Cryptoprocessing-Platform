import { Link } from "react-router-dom";

import { useTranslation } from "../i18n";
import { DOCS_PAGE_ORDER, DOCS_PAGE_TITLE_KEYS } from "./docsNav";

type DocsPagerProps = {
  currentPath: string;
};

function normalizePath(path: string) {
  if (path.startsWith("/integrations/")) {
    return "/integrations";
  }
  return path;
}

export function DocsPager({ currentPath }: DocsPagerProps) {
  const { t } = useTranslation();
  const path = normalizePath(currentPath);
  const index = DOCS_PAGE_ORDER.indexOf(path as (typeof DOCS_PAGE_ORDER)[number]);
  if (index < 0) {
    return null;
  }
  const prev = index > 0 ? DOCS_PAGE_ORDER[index - 1] : null;
  const next = index < DOCS_PAGE_ORDER.length - 1 ? DOCS_PAGE_ORDER[index + 1] : null;

  return (
    <nav className="docs-pager" aria-label={t("docsSite.pagerAria")}>
      {prev ? (
        <Link className="docs-pager-link docs-pager-link--prev" to={prev}>
          <span>{t("docsSite.pagerPrevious")}</span>
          <strong>{t(DOCS_PAGE_TITLE_KEYS[prev])}</strong>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link className="docs-pager-link docs-pager-link--next" to={next}>
          <span>{t("docsSite.pagerNext")}</span>
          <strong>{t(DOCS_PAGE_TITLE_KEYS[next])}</strong>
        </Link>
      ) : null}
    </nav>
  );
}

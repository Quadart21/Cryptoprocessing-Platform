import { Link } from "react-router-dom";

import { resolveClientApiBaseUrl } from "../config/apiBase";
import { useTranslation } from "../i18n";
import { getDocsArticle, type DocsArticleKey } from "./articles";
import type { DocsBlock } from "./articles/types";
import { DocsPager } from "./DocsPager";

type DocsArticlePageProps = {
  articleKey: DocsArticleKey;
};

function withBase(text: string, apiBaseUrl: string) {
  return text.split("{{apiBase}}").join(apiBaseUrl);
}

function ArticleBlock({ block, apiBaseUrl }: { block: DocsBlock; apiBaseUrl: string }) {
  if (block.kind === "p") {
    return <p>{withBase(block.text, apiBaseUrl)}</p>;
  }
  if (block.kind === "list") {
    const items = block.items.map((item) => <li key={item}>{withBase(item, apiBaseUrl)}</li>);
    return block.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
  }
  if (block.kind === "note") {
    return <p className={`docs-callout docs-callout--${block.tone}`}>{withBase(block.text, apiBaseUrl)}</p>;
  }
  if (block.kind === "code") {
    return (
      <figure className="docs-code">
        <figcaption>{block.label}</figcaption>
        <pre>
          <code>{withBase(block.text, apiBaseUrl)}</code>
        </pre>
      </figure>
    );
  }
  if (block.kind === "params") {
    return (
      <div className="docs-table-wrap">
        <table className="docs-table">
          <tbody>
            {block.rows.map((row) => (
              <tr key={row.name}>
                <th scope="row">
                  <code>{row.name}</code>
                  <small>{row.required}</small>
                </th>
                <td>{withBase(row.text, apiBaseUrl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.kind === "table") {
    return (
      <div className="docs-table-wrap">
        <table className="docs-table docs-table--grid">
          <thead>
            <tr>
              {block.headers.map((header) => (
                <th key={header} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row) => (
              <tr key={row.join("|")}>
                {row.map((cell) => (
                  <td key={cell}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="docs-link-cards">
      {block.items.map((item) => (
        <Link className="docs-link-card" key={item.to} to={item.to}>
          <strong>{item.title}</strong>
          <span>{item.text}</span>
        </Link>
      ))}
    </div>
  );
}

export function DocsArticlePage({ articleKey }: DocsArticlePageProps) {
  const { t, locale } = useTranslation();
  const apiBaseUrl = resolveClientApiBaseUrl();
  const article = getDocsArticle(locale, articleKey);

  return (
    <article className="docs-guide docs-article">
      <header className="docs-page-head">
        <p className="docs-page-eyebrow">{t(`docsSite.pages.${articleKey}.eyebrow`)}</p>
        <h1>{t(`docsSite.pages.${articleKey}.title`)}</h1>
        <p className="docs-page-lead">{t(`docsSite.pages.${articleKey}.lead`)}</p>
      </header>

      <div className="docs-article-layout">
        <div className="docs-article-body">
          {article.sections.map((section) => (
            <section className="docs-article-section" id={section.id} key={section.id}>
              <h2>{section.title}</h2>
              {section.blocks.map((block, index) => (
                <ArticleBlock apiBaseUrl={apiBaseUrl} block={block} key={`${section.id}-${index}`} />
              ))}
            </section>
          ))}
        </div>
        <aside className="docs-article-toc">
          <p>{t("docsSite.onThisPage")}</p>
          <nav>
            {article.sections.map((section) => (
              <a href={`#${section.id}`} key={section.id}>
                {section.title}
              </a>
            ))}
          </nav>
        </aside>
      </div>

      <DocsPager currentPath={`/${articleKey}`} />
    </article>
  );
}

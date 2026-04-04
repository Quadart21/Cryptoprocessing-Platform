import type { PublicPageItem } from "../api";

type PublicCmsPageProps = {
  page: PublicPageItem | null;
  loading?: boolean;
  onBackToLanding: () => void;
};

export function PublicCmsPage({ page, loading = false, onBackToLanding }: PublicCmsPageProps) {
  return (
    <main className="public-docs-page">
      <section className="public-docs-topbar">
        <button className="ghost-button" onClick={onBackToLanding} type="button">
          На главную
        </button>
      </section>
      <section className="panel public-docs-shell">
        {loading ? <p className="muted-text">Загрузка страницы...</p> : null}
        {!loading && !page ? <p className="error-box">Страница не найдена.</p> : null}
        {page ? (
          <article className="panel panel-span-2">
            <p className="eyebrow">Публичная страница</p>
            <h2>{page.title}</h2>
            <p className="muted-text">/page/{page.slug}</p>
            <div
              className="result-box"
              dangerouslySetInnerHTML={{ __html: page.content_html }}
            />
          </article>
        ) : null}
      </section>
    </main>
  );
}

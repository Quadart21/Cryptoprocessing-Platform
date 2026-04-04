import { FormEvent, useMemo, useState } from "react";

import type { PublicPageItem } from "../../api";

type AdminPublicPagesSectionProps = {
  loading: boolean;
  pages: PublicPageItem[];
  onCreate: (payload: Omit<PublicPageItem, "id" | "created_at" | "updated_at">) => void;
  onUpdate: (
    pageId: string,
    payload: Partial<Omit<PublicPageItem, "id" | "created_at" | "updated_at">>,
  ) => void;
  onDelete: (pageId: string) => void;
};

const DEFAULT_FORM: Omit<PublicPageItem, "id" | "created_at" | "updated_at"> = {
  slug: "",
  title: "",
  content_html: "",
  status: "draft",
  show_in_header: false,
  show_in_footer: false,
  header_order: 0,
  footer_order: 0,
};

export function AdminPublicPagesSection({
  loading,
  pages,
  onCreate,
  onUpdate,
  onDelete,
}: AdminPublicPagesSectionProps) {
  const [draft, setDraft] = useState(DEFAULT_FORM);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedPage = useMemo(
    () => pages.find((item) => item.id === selectedId) ?? null,
    [pages, selectedId],
  );

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate(draft);
    setDraft(DEFAULT_FORM);
  }

  return (
    <section className="dashboard-grid client-grid">
      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">CMS</p>
            <h2>Публичные страницы</h2>
          </div>
        </div>
        <div className="tenant-list">
          {pages.map((item) => (
            <button
              className={`tenant-card ${selectedId === item.id ? "tenant-card-active" : ""}`}
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              type="button"
            >
              <div>
                <strong>{item.title}</strong>
                <p>/{item.slug}</p>
              </div>
              <div className="tenant-meta">
                <span>{item.status}</span>
                <span>
                  {item.show_in_header ? "menu" : "-"} / {item.show_in_footer ? "footer" : "-"}
                </span>
              </div>
            </button>
          ))}
        </div>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Новая страница</p>
            <h2>Создание</h2>
          </div>
        </div>
        <form className="form" onSubmit={handleCreate}>
          <label>
            <span>Slug</span>
            <input
              value={draft.slug}
              onChange={(event) => setDraft((prev) => ({ ...prev, slug: event.target.value }))}
              placeholder="about-us"
              required
            />
          </label>
          <label>
            <span>Заголовок</span>
            <input
              value={draft.title}
              onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="О компании"
              required
            />
          </label>
          <label>
            <span>HTML</span>
            <textarea
              rows={10}
              value={draft.content_html}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, content_html: event.target.value }))
              }
            />
          </label>
          <label className="switch-row">
            <span>Показывать в главном меню</span>
            <input
              type="checkbox"
              checked={draft.show_in_header}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, show_in_header: event.target.checked }))
              }
            />
          </label>
          <label className="switch-row">
            <span>Показывать в футере</span>
            <input
              type="checkbox"
              checked={draft.show_in_footer}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, show_in_footer: event.target.checked }))
              }
            />
          </label>
          <label>
            <span>Порядок в меню</span>
            <input
              type="number"
              value={draft.header_order}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, header_order: Number(event.target.value) || 0 }))
              }
            />
          </label>
          <label>
            <span>Порядок в футере</span>
            <input
              type="number"
              value={draft.footer_order}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, footer_order: Number(event.target.value) || 0 }))
              }
            />
          </label>
          <button className="ghost-button" type="button" onClick={() => onCreate({ ...draft, status: "draft" })}>
            Save draft
          </button>
          <button className="primary-button" disabled={loading} type="button" onClick={() => onCreate({ ...draft, status: "published" })}>
            Publish
          </button>
        </form>
      </article>

      {selectedPage ? (
        <article className="panel panel-span-2">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Редактирование</p>
              <h2>{selectedPage.title}</h2>
            </div>
          </div>
          <div className="form-grid form-grid-2">
            <button
              className="ghost-button"
              onClick={() => onUpdate(selectedPage.id, { status: "draft" })}
              type="button"
            >
              Unpublish
            </button>
            <button
              className="primary-button"
              onClick={() => onUpdate(selectedPage.id, { status: "published" })}
              type="button"
            >
              Publish
            </button>
            <button
              className="ghost-button"
              onClick={() => onDelete(selectedPage.id)}
              type="button"
            >
              Delete
            </button>
          </div>
          <label>
            <span>Live preview</span>
            <div
              className="result-box"
              dangerouslySetInnerHTML={{ __html: selectedPage.content_html }}
            />
          </label>
        </article>
      ) : null}
    </section>
  );
}

import { FormEvent, useEffect, useMemo, useState } from "react";

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
  const [workspace, setWorkspace] = useState<"new" | "edit">("new");
  const [draftNew, setDraftNew] = useState(DEFAULT_FORM);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedPage = useMemo(
    () => pages.find((item) => item.id === selectedId) ?? null,
    [pages, selectedId],
  );

  const [editDraft, setEditDraft] = useState<{
    slug: string;
    title: string;
    content_html: string;
    status: PublicPageItem["status"];
    show_in_header: boolean;
    show_in_footer: boolean;
    header_order: number;
    footer_order: number;
  } | null>(null);

  useEffect(() => {
    if (!selectedPage) {
      setEditDraft(null);
      return;
    }
    setEditDraft({
      slug: selectedPage.slug,
      title: selectedPage.title,
      content_html: selectedPage.content_html,
      status: selectedPage.status,
      show_in_header: selectedPage.show_in_header,
      show_in_footer: selectedPage.show_in_footer,
      header_order: selectedPage.header_order,
      footer_order: selectedPage.footer_order,
    });
  }, [selectedPage]);

  function persistEdit(
    partial?: Partial<Omit<PublicPageItem, "id" | "created_at" | "updated_at">>,
  ) {
    if (!selectedPage || !editDraft) {
      return;
    }
    const payload = {
      slug: editDraft.slug,
      title: editDraft.title,
      content_html: editDraft.content_html,
      status: partial?.status ?? editDraft.status,
      show_in_header: editDraft.show_in_header,
      show_in_footer: editDraft.show_in_footer,
      header_order: editDraft.header_order,
      footer_order: editDraft.footer_order,
      ...partial,
    };
    onUpdate(selectedPage.id, payload);
  }

  function submitNewDraft() {
    if (loading) return;
    onCreate({ ...draftNew, status: "draft" });
    setDraftNew(DEFAULT_FORM);
  }

  function submitNewPublished() {
    if (loading) return;
    onCreate({ ...draftNew, status: "published" });
    setDraftNew(DEFAULT_FORM);
  }

  return (
    <section className="pw-cms-shell">
      <aside className="panel pw-cms-rail">
        <div className="panel-header">
          <div>
            <p className="eyebrow">CMS</p>
            <h2>Страницы</h2>
          </div>
        </div>
        <p className="muted-text pw-rail-help">Выберите страницу или создайте новую справа.</p>
        <div className="tenant-list pw-cms-page-list">
          {pages.length === 0 ? (
            <p className="muted-text">Пока ни одной страницы.</p>
          ) : (
            pages.map((item) => (
              <button
                className={`tenant-card pw-cms-page-card ${selectedId === item.id && workspace === "edit" ? "tenant-card-active" : ""}`}
                key={item.id}
                onClick={() => {
                  setSelectedId(item.id);
                  setWorkspace("edit");
                }}
                type="button"
              >
                <div className="pw-cms-card-title-wrap">
                  <strong>{item.title}</strong>
                  <span className="muted-text mono-sm">/{item.slug}</span>
                </div>
                <div className="tenant-meta pw-cms-card-meta">
                  <span className={`pw-status-pill pw-status-${item.status}`}>{item.status}</span>
                  <span className="muted-text nowrap">
                    {item.show_in_header ? "Меню" : "—"} · {item.show_in_footer ? "Футер" : "—"}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
        <div className="pw-rail-footer">
          <button
            className="ghost-button pw-rail-footer-btn"
            onClick={() => {
              setWorkspace("new");
              setSelectedId(null);
            }}
            type="button"
          >
            + Новая страница
          </button>
        </div>
      </aside>

      <div className="panel pw-cms-workspace">
        <div className="panel-header pw-cms-workspace-header">
          <div>
            <p className="eyebrow">Редактор</p>
            <h2>
              {workspace === "new"
                ? "Новая страница"
                : selectedPage
                  ? `Редактирование: ${selectedPage.title}`
                  : "Выберите страницу"}
            </h2>
          </div>
          <div className="pw-workspace-switch" role="group">
            <button
              className={`ghost-button ${workspace === "new" ? "pw-chip-active" : ""}`}
              onClick={() => {
                setWorkspace("new");
                setSelectedId(null);
              }}
              type="button"
            >
              Создание
            </button>
            <button
              className={`ghost-button ${workspace === "edit" && selectedPage ? "pw-chip-active" : ""}`}
              disabled={!selectedId}
              onClick={() => {
                setWorkspace("edit");
              }}
              type="button"
            >
              Выбранная
            </button>
          </div>
        </div>

        {workspace === "new" ? (
          <div className="pw-cms-editor-form pw-form-block">
            <p className="muted-text pw-tabpanel-intro pw-cms-workspace-intro">
              Задайте адрес страницы, разметку и видимость в меню перед публикацией.
            </p>
            <fieldset className="pw-fieldset">
              <legend className="sr-only">Метаданные страницы</legend>
              <div className="pw-fieldset-cap">
                <h3 className="pw-fieldset-title">Slug и заголовок</h3>
                <p className="pw-fieldset-desc">
                  Slug станет частью адреса; заголовок показывается в интерфейсе и в результатах поиска.
                </p>
              </div>
              <div className="pw-fieldset-body">
                <div className="form-grid-2 pw-form-fields">
              <label>
                <span>Slug</span>
                <span className="pw-field-hint">Латиница, дефисы, без пробелов.</span>
                <input
                  value={draftNew.slug}
                  onChange={(event) =>
                    setDraftNew((prev) => ({ ...prev, slug: event.target.value }))
                  }
                  placeholder="about-us"
                  required
                />
              </label>
              <label>
                <span>Заголовок</span>
                <input
                  value={draftNew.title}
                  onChange={(event) =>
                    setDraftNew((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="О компании"
                  required
                />
              </label>
                </div>
              </div>
            </fieldset>
            <fieldset className="pw-fieldset">
              <legend className="sr-only">Содержимое</legend>
              <div className="pw-fieldset-cap">
                <h3 className="pw-fieldset-title">HTML контент</h3>
                <p className="pw-fieldset-desc">Разметка попадёт на публичную страницу как есть — проверяйте валидность и безопасность.</p>
              </div>
              <div className="pw-fieldset-body">
                <div className="pw-form-fields">
            <label>
              <span>Разметка</span>
              <textarea
                rows={14}
                value={draftNew.content_html}
                onChange={(event) =>
                  setDraftNew((prev) => ({ ...prev, content_html: event.target.value }))
                }
              />
            </label>
                </div>
              </div>
            </fieldset>
            <fieldset className="pw-fieldset">
              <legend className="sr-only">Навигация</legend>
              <div className="pw-fieldset-cap">
                <h3 className="pw-fieldset-title">Меню и футер</h3>
                <p className="pw-fieldset-desc">Включение ссылки в шапке и в подвале сайта и порядок сортировки.</p>
              </div>
              <div className="pw-fieldset-body">
            <div className="pw-toggle-grid">
              <label className="switch-row pw-switch pw-field-toggle-row">
                <span>В главном меню</span>
                <input
                  checked={draftNew.show_in_header}
                  onChange={(event) =>
                    setDraftNew((prev) => ({ ...prev, show_in_header: event.target.checked }))
                  }
                  type="checkbox"
                />
              </label>
              <label className="switch-row pw-switch pw-field-toggle-row">
                <span>В футере</span>
                <input
                  checked={draftNew.show_in_footer}
                  onChange={(event) =>
                    setDraftNew((prev) => ({ ...prev, show_in_footer: event.target.checked }))
                  }
                  type="checkbox"
                />
              </label>
            </div>
            <div className="form-grid-2 pw-form-fields">
              <label>
                <span>Порядок в меню</span>
                <input
                  min={0}
                  type="number"
                  value={draftNew.header_order}
                  onChange={(event) =>
                    setDraftNew((prev) => ({
                      ...prev,
                      header_order: Number(event.target.value) || 0,
                    }))
                  }
                />
              </label>
              <label>
                <span>Порядок в футере</span>
                <input
                  min={0}
                  type="number"
                  value={draftNew.footer_order}
                  onChange={(event) =>
                    setDraftNew((prev) => ({
                      ...prev,
                      footer_order: Number(event.target.value) || 0,
                    }))
                  }
                />
              </label>
            </div>
              </div>
            </fieldset>
            <div className="pw-form-actions">
              <button className="ghost-button" disabled={loading} onClick={submitNewDraft} type="button">
                Черновик
              </button>
              <button
                className="primary-button pw-btn-primary-soft"
                disabled={loading}
                onClick={submitNewPublished}
                type="button"
              >
                Опубликовать
              </button>
            </div>
          </div>
        ) : !selectedPage || !editDraft ? (
          <p className="muted-text pw-cms-placeholder">Выберите страницу в списке слева или создайте новую.</p>
        ) : (
          <div className="pw-cms-edit-split">
            <form
              className="form pw-cms-editor-form"
              onSubmit={(event) => {
                event.preventDefault();
                persistEdit();
              }}
            >
              <p className="muted-text pw-tabpanel-intro pw-cms-workspace-intro">
                Изменения сохраняются по кнопке «Сохранить»; статус можно переключить отдельными действиями.
              </p>
              <fieldset className="pw-fieldset">
                <legend className="sr-only">Метаданные</legend>
                <div className="pw-fieldset-cap">
                  <h3 className="pw-fieldset-title">Slug и заголовок</h3>
                  <p className="pw-fieldset-desc">Адрес страницы и отображаемое имя.</p>
                </div>
                <div className="pw-fieldset-body">
              <div className="form-grid-2 pw-form-fields">
                <label>
                  <span>Slug</span>
                  <span className="pw-field-hint">Меняйте осторожно — старые ссылки перестанут работать.</span>
                  <input
                    required
                    value={editDraft.slug}
                    onChange={(event) => setEditDraft((d) => (d ? { ...d, slug: event.target.value } : d))}
                  />
                </label>
                <label>
                  <span>Заголовок</span>
                  <input
                    required
                    value={editDraft.title}
                    onChange={(event) => setEditDraft((d) => (d ? { ...d, title: event.target.value } : d))}
                  />
                </label>
              </div>
                </div>
              </fieldset>
              <fieldset className="pw-fieldset">
                <legend className="sr-only">Содержимое</legend>
                <div className="pw-fieldset-cap">
                  <h3 className="pw-fieldset-title">HTML контент</h3>
                  <p className="pw-fieldset-desc">Текущая разметка страницы.</p>
                </div>
                <div className="pw-fieldset-body">
                  <div className="pw-form-fields">
              <label>
                <span>Разметка</span>
                <textarea
                  rows={12}
                  value={editDraft.content_html}
                  onChange={(event) =>
                    setEditDraft((d) => (d ? { ...d, content_html: event.target.value } : d))
                  }
                />
              </label>
                  </div>
                </div>
              </fieldset>
              <fieldset className="pw-fieldset">
                <legend className="sr-only">Навигация</legend>
                <div className="pw-fieldset-cap">
                  <h3 className="pw-fieldset-title">Меню и футер</h3>
                  <p className="pw-fieldset-desc">Видимость и порядок в навигации.</p>
                </div>
                <div className="pw-fieldset-body">
              <div className="pw-toggle-grid">
                <label className="switch-row pw-switch pw-field-toggle-row">
                  <span>В меню</span>
                  <input
                    checked={editDraft.show_in_header}
                    onChange={(event) =>
                      setEditDraft((d) =>
                        d ? { ...d, show_in_header: event.target.checked } : d,
                      )
                    }
                    type="checkbox"
                  />
                </label>
                <label className="switch-row pw-switch pw-field-toggle-row">
                  <span>В футере</span>
                  <input
                    checked={editDraft.show_in_footer}
                    onChange={(event) =>
                      setEditDraft((d) =>
                        d ? { ...d, show_in_footer: event.target.checked } : d,
                      )
                    }
                    type="checkbox"
                  />
                </label>
              </div>
              <div className="form-grid-2 pw-form-fields">
                <label>
                  <span>Порядок меню</span>
                  <input
                    min={0}
                    type="number"
                    value={editDraft.header_order}
                    onChange={(event) =>
                      setEditDraft((d) =>
                        d ? { ...d, header_order: Number(event.target.value) || 0 } : d,
                      )
                    }
                  />
                </label>
                <label>
                  <span>Порядок футера</span>
                  <input
                    min={0}
                    type="number"
                    value={editDraft.footer_order}
                    onChange={(event) =>
                      setEditDraft((d) =>
                        d ? { ...d, footer_order: Number(event.target.value) || 0 } : d,
                      )
                    }
                  />
                </label>
              </div>
                </div>
              </fieldset>
              <div className="pw-form-actions">
                <button className="primary-button pw-btn-primary-soft" disabled={loading} type="submit">
                  Сохранить изменения
                </button>
                <button
                  className="ghost-button"
                  disabled={loading}
                  onClick={() => persistEdit({ status: "draft" })}
                  type="button"
                >
                  В черновик
                </button>
                <button
                  className="ghost-button"
                  disabled={loading}
                  onClick={() => persistEdit({ status: "published" })}
                  type="button"
                >
                  Опубликовать
                </button>
                <button
                  className="ghost-button danger-soft"
                  disabled={loading}
                  onClick={() => onDelete(selectedPage.id)}
                  type="button"
                >
                  Удалить
                </button>
              </div>
            </form>
            <div className="pw-cms-preview">
              <p className="pw-subheading">Предпросмотр HTML</p>
              <div
                className="result-box pw-cms-preview-frame"
                dangerouslySetInnerHTML={{ __html: editDraft.content_html }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

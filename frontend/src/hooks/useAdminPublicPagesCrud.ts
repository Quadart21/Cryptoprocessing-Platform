import {
  createAdminPublicPage,
  deleteAdminPublicPage,
  fetchAdminPublicPages,
  updateAdminPublicPage,
  type PublicPageItem,
} from "../api";

type CommonHandlers = {
  setLoading: (value: boolean) => void;
  setError: (value: string | null) => void;
  setSuccess: (value: string | null) => void;
  setAdminPublicPages: (value: PublicPageItem[]) => void;
};

export function useAdminPublicPagesCrud(token: string | null, handlers: CommonHandlers) {
  async function handleCreatePublicPage(
    payload: Omit<PublicPageItem, "id" | "created_at" | "updated_at">,
  ) {
    if (!token) return;
    try {
      handlers.setLoading(true);
      handlers.setError(null);
      handlers.setSuccess(null);
      await createAdminPublicPage(token, payload);
      handlers.setAdminPublicPages(await fetchAdminPublicPages(token));
      handlers.setSuccess("Публичная страница сохранена.");
    } catch (err) {
      handlers.setError(err instanceof Error ? err.message : "Не удалось создать страницу.");
    } finally {
      handlers.setLoading(false);
    }
  }

  async function handleUpdatePublicPage(
    pageId: string,
    payload: Partial<Omit<PublicPageItem, "id" | "created_at" | "updated_at">>,
  ) {
    if (!token) return;
    try {
      handlers.setLoading(true);
      handlers.setError(null);
      handlers.setSuccess(null);
      await updateAdminPublicPage(token, pageId, payload);
      handlers.setAdminPublicPages(await fetchAdminPublicPages(token));
      handlers.setSuccess("Страница обновлена.");
    } catch (err) {
      handlers.setError(err instanceof Error ? err.message : "Не удалось обновить страницу.");
    } finally {
      handlers.setLoading(false);
    }
  }

  async function handleDeletePublicPage(pageId: string) {
    if (!token) return;
    try {
      handlers.setLoading(true);
      handlers.setError(null);
      handlers.setSuccess(null);
      await deleteAdminPublicPage(token, pageId);
      handlers.setAdminPublicPages(await fetchAdminPublicPages(token));
      handlers.setSuccess("Страница удалена.");
    } catch (err) {
      handlers.setError(err instanceof Error ? err.message : "Не удалось удалить страницу.");
    } finally {
      handlers.setLoading(false);
    }
  }

  return {
    handleCreatePublicPage,
    handleUpdatePublicPage,
    handleDeletePublicPage,
  };
}

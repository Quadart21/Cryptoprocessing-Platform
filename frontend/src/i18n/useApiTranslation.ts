import { useCallback, useMemo } from "react";

import { LOCALES } from "./locales";
import { getTranslationArray, resolveTranslation } from "./resolve";

type TParams = Record<string, string | number>;

const EN_DICT = LOCALES.en;

/** API docs and integration reference are always English regardless of UI locale. */
export function useApiTranslation() {
  const t = useCallback(
    (key: string, params?: TParams) => resolveTranslation(EN_DICT, key, params),
    [],
  );

  const ta = useCallback(<T,>(key: string) => getTranslationArray<T>(EN_DICT, key), []);

  return useMemo(
    () => ({
      t,
      ta,
      locale: "en" as const,
      dir: "ltr" as const,
    }),
    [t, ta],
  );
}

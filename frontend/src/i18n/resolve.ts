import type { TranslationDict, TranslationValue } from "./types";

export function resolveTranslation(
  dict: TranslationDict,
  key: string,
  params?: Record<string, string | number>,
): string {
  const parts = key.split(".");
  let current: TranslationValue = dict;

  for (const part of parts) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) {
      return key;
    }
    current = (current as TranslationDict)[part];
    if (current === undefined) {
      return key;
    }
  }

  if (typeof current !== "string") {
    return key;
  }

  if (!params) {
    return current;
  }

  return current.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const value = params[name];
    return value === undefined ? `{{${name}}}` : String(value);
  });
}

export function getTranslationArray<T>(dict: TranslationDict, key: string): T[] {
  const parts = key.split(".");
  let current: TranslationValue = dict;

  for (const part of parts) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) {
      return [];
    }
    current = (current as TranslationDict)[part];
    if (current === undefined) {
      return [];
    }
  }

  return Array.isArray(current) ? (current as T[]) : [];
}

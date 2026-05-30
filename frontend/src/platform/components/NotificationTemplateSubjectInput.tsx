import { useRef } from "react";

export function useNotificationTemplateSubjectInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  function insertVariable(variable: string) {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const token = `{{ ${variable} }}`;
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    onChange(`${value.slice(0, start)}${token}${value.slice(end)}`);
    window.requestAnimationFrame(() => {
      const cursor = start + token.length;
      input.setSelectionRange(cursor, cursor);
    });
  }

  return { inputRef, insertVariable };
}

export function useNotificationTemplateTextareaInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function insertVariable(variable: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    const token = `{{ ${variable} }}`;
    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    onChange(`${value.slice(0, start)}${token}${value.slice(end)}`);
    window.requestAnimationFrame(() => {
      const cursor = start + token.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  return { textareaRef, insertVariable };
}

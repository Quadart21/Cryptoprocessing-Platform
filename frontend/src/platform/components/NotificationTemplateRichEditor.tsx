import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type FocusEvent,
} from "react";

import {
  editorHtmlToStorage,
  injectVariableTokens,
  resolveEditorSourceHtml,
} from "./notificationTemplateEditorUtils";

export type NotificationTemplateRichEditorHandle = {
  insertVariable: (variable: string) => void;
  focus: () => void;
};

type NotificationTemplateRichEditorProps = {
  messageLines: string | null;
  emailBody: string | null;
  fallbackMessageLines: string;
  placeholder: string;
  onChange: (payload: { message_lines: string | null; email_body: string | null }) => void;
};

export const NotificationTemplateRichEditor = forwardRef<
  NotificationTemplateRichEditorHandle,
  NotificationTemplateRichEditorProps
>(function NotificationTemplateRichEditor(
  { messageLines, emailBody, fallbackMessageLines, placeholder, onChange },
  ref,
) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const lastSerializedRef = useRef("");

  function syncFromProps() {
    const editor = editorRef.current;
    if (!editor) return;
    const nextHtml = resolveEditorSourceHtml(messageLines, emailBody, fallbackMessageLines);
    if (nextHtml === lastSerializedRef.current) return;
    editor.innerHTML = nextHtml;
    lastSerializedRef.current = nextHtml;
    setIsEmpty(editorHtmlToStorage(nextHtml).message_lines === null);
  }

  useEffect(() => {
    syncFromProps();
  }, [messageLines, emailBody, fallbackMessageLines]);

  function emitChange() {
    const editor = editorRef.current;
    if (!editor) return;
    const html = editor.innerHTML;
    lastSerializedRef.current = html;
    const storage = editorHtmlToStorage(html);
    setIsEmpty(storage.message_lines === null);
    onChange(storage);
  }

  function insertVariable(variable: string) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const tokenHtml = injectVariableTokens(`{{ ${variable} }}`);
    document.execCommand("insertHTML", false, `${tokenHtml}&nbsp;`);
    emitChange();
  }

  function runCommand(command: string) {
    editorRef.current?.focus();
    document.execCommand(command, false);
    emitChange();
  }

  useImperativeHandle(ref, () => ({
    insertVariable,
    focus: () => editorRef.current?.focus(),
  }));

  return (
    <div className="nte-shell">
      <div className="nte-toolbar" role="toolbar" aria-label="Форматирование текста">
        <button type="button" className="ghost-button" onClick={() => runCommand("bold")}>
          Ж
        </button>
        <button type="button" className="ghost-button" onClick={() => runCommand("italic")}>
          К
        </button>
        <button type="button" className="ghost-button" onClick={() => runCommand("insertUnorderedList")}>
          • Список
        </button>
        <button type="button" className="ghost-button" onClick={() => runCommand("insertOrderedList")}>
          1. Список
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            const url = window.prompt("Ссылка (https://...)", "https://");
            if (!url?.trim()) return;
            editorRef.current?.focus();
            document.execCommand("createLink", false, url.trim());
            emitChange();
          }}
        >
          Ссылка
        </button>
      </div>
      <div className="nte-editor-wrap">
        {isEmpty ? <span className="nte-placeholder">{placeholder}</span> : null}
        <div
          ref={editorRef}
          className="nte-editor"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          onInput={emitChange}
          onBlur={emitChange}
          onFocus={(event: FocusEvent<HTMLDivElement>) => {
            if (event.currentTarget.textContent?.trim()) {
              setIsEmpty(false);
            }
          }}
        />
      </div>
      <p className="muted-text nte-hint">
        Форматирование сохраняется автоматически. HTML-теги вводить не нужно — для email они
        соберутся сами.
      </p>
    </div>
  );
});

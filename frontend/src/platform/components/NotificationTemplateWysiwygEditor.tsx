import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from "react";

import { prepareStoredHtmlForEditor } from "./notificationTemplateEditorUtils";

export type NotificationTemplateWysiwygHandle = {
  insertVariable: (variable: string) => void;
  focus: () => void;
};

type NotificationTemplateWysiwygEditorProps = {
  html: string;
  placeholder?: string;
  onChange: (html: string) => void;
  variant?: "email" | "telegram";
};

function ToolbarButton({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`nte-tool-btn${active ? " is-active" : ""}`}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export const NotificationTemplateWysiwygEditor = forwardRef<
  NotificationTemplateWysiwygHandle,
  NotificationTemplateWysiwygEditorProps
>(function NotificationTemplateWysiwygEditor(
  { html, placeholder, onChange, variant = "email" },
  ref,
) {
  const lastHtmlRef = useRef("");
  const skipUpdateRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: "nte-image" },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Введите текст уведомления…",
      }),
    ],
    content: prepareStoredHtmlForEditor(html || "<p></p>"),
    editorProps: {
      attributes: {
        class: "nte-prosemirror",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      if (skipUpdateRef.current) return;
      const nextHtml = currentEditor.getHTML();
      lastHtmlRef.current = nextHtml;
      onChange(nextHtml);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const normalized = prepareStoredHtmlForEditor(html || "<p></p>");
    if (normalized === lastHtmlRef.current) return;
    skipUpdateRef.current = true;
    editor.commands.setContent(normalized, { emitUpdate: false });
    lastHtmlRef.current = normalized;
    skipUpdateRef.current = false;
  }, [editor, html]);

  useImperativeHandle(ref, () => ({
    insertVariable: (variable: string) => {
      if (!editor) return;
      editor
        .chain()
        .focus()
        .insertContent([
          { type: "text", marks: [{ type: "code" }], text: `{{ ${variable} }}` },
          { type: "text", text: " " },
        ])
        .run();
    },
    focus: () => editor?.commands.focus(),
  }));

  if (!editor) {
    return null;
  }

  function promptLink() {
    const previous = editor?.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL ссылки", previous ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor?.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  function promptImage() {
    const url = window.prompt(
      "URL изображения (https://… или переменная, напр. {{ notification_logo_url }})",
      "{{ notification_logo_url }}",
    );
    if (!url?.trim()) return;
    editor?.chain().focus().setImage({ src: url.trim() }).run();
  }

  return (
    <div className={`nte-shell nte-shell-${variant}`}>
      <div className="nte-toolbar nte-toolbar-wide" role="toolbar" aria-label="Редактор уведомления">
        <div className="nte-toolbar-group">
          <ToolbarButton
            title="Жирный"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton
            title="Курсив"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton
            title="Подчёркнутый"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <u>U</u>
          </ToolbarButton>
          <ToolbarButton
            title="Зачёркнутый"
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <s>S</s>
          </ToolbarButton>
        </div>
        <div className="nte-toolbar-group">
          <ToolbarButton
            title="По левому краю"
            active={editor.isActive({ textAlign: "left" })}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          >
            ≡
          </ToolbarButton>
          <ToolbarButton
            title="По центру"
            active={editor.isActive({ textAlign: "center" })}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            ≡|
          </ToolbarButton>
          <ToolbarButton
            title="По правому краю"
            active={editor.isActive({ textAlign: "right" })}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          >
            |≡
          </ToolbarButton>
        </div>
        <div className="nte-toolbar-group">
          <ToolbarButton
            title="Маркированный список"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            • —
          </ToolbarButton>
          <ToolbarButton
            title="Нумерованный список"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            1. —
          </ToolbarButton>
          <ToolbarButton
            title="Цитата"
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            “
          </ToolbarButton>
          <ToolbarButton title="Разделитель" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            ─
          </ToolbarButton>
        </div>
        <div className="nte-toolbar-group">
          <ToolbarButton
            title="Заголовок H2"
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            title="Заголовок H3"
            active={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            H3
          </ToolbarButton>
        </div>
        <div className="nte-toolbar-group">
          <ToolbarButton title="Ссылка" active={editor.isActive("link")} onClick={promptLink}>
            🔗
          </ToolbarButton>
          <ToolbarButton title="Изображение" onClick={promptImage}>
            🖼
          </ToolbarButton>
          <ToolbarButton
            title="Очистить форматирование"
            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          >
            ✕
          </ToolbarButton>
        </div>
      </div>
      <EditorContent editor={editor} className="nte-editor-wrap" />
      {variant === "telegram" ? (
        <p className="muted-text nte-hint">
          В Telegram первая картинка отправится отдельным фото, остальной текст — подписью. Выравнивание
          по центру в Telegram не поддерживается.
        </p>
      ) : (
        <p className="muted-text nte-hint">
          Редактор как на форумах: форматирование, списки, выравнивание, ссылки и картинки сохраняются в
          HTML письма автоматически.
        </p>
      )}
    </div>
  );
});

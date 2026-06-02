const VARIABLE_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g;

const ALLOWED_TAGS = new Set([
  "P",
  "STRONG",
  "B",
  "EM",
  "I",
  "U",
  "S",
  "STRIKE",
  "UL",
  "OL",
  "LI",
  "BR",
  "A",
  "SPAN",
  "IMG",
  "H1",
  "H2",
  "H3",
  "H4",
  "BLOCKQUOTE",
  "HR",
  "DIV",
  "CODE",
]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderVariableToken(variable: string): string {
  const trimmed = variable.trim();
  return `<code>{{ ${escapeHtml(trimmed)} }}</code>`;
}

export function isTemplateVariableReference(value: string): boolean {
  return /^\{\{\s*[a-zA-Z0-9_]+\s*\}\}$/.test(value.trim());
}

export function isSafeMediaSrc(src: string): boolean {
  const trimmed = src.trim();
  if (!trimmed) return false;
  if (isTemplateVariableReference(trimmed)) return true;
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("/")
  );
}

export function injectVariableTokens(text: string): string {
  return text.replace(VARIABLE_PATTERN, (_, variable: string) => renderVariableToken(variable));
}

/** Не трогать {{ }} внутри HTML-атрибутов (src картинок, href ссылок). */
export function prepareStoredHtmlForEditor(html: string): string {
  return html.trim() || "<p></p>";
}

export function plainLinesToEditorHtml(text: string): string {
  const normalized = text.replace(/\r/g, "").trim();
  if (!normalized) {
    return "<p></p>";
  }
  return normalized
    .split("\n")
    .map((line) => {
      const content = injectVariableTokens(line.trim());
      return `<p>${content || "<br>"}</p>`;
    })
    .join("");
}

export function isDefaultEmailBody(value: string | null | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  return trimmed === "" || trimmed === "{{ message_lines_html }}";
}

export function isTelegramAutoBody(value: string | null | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  return trimmed === "" || trimmed === "{{ event_subject }}\n\n{{ message_lines }}";
}

export function resolveEmailEditorHtml(
  messageLines: string | null | undefined,
  emailBody: string | null | undefined,
  fallbackMessageLines: string,
): string {
  if (!isDefaultEmailBody(emailBody) && emailBody?.trim()) {
    return prepareStoredHtmlForEditor(emailBody);
  }
  const source = (messageLines ?? fallbackMessageLines).replace(/\r/g, "");
  return plainLinesToEditorHtml(source);
}

export function resolveTelegramEditorHtml(
  telegramBody: string | null | undefined,
  fallbackTelegramBody: string,
): string {
  const source = (telegramBody ?? fallbackTelegramBody).replace(/\r/g, "").trim();
  if (!source) return "<p></p>";
  if (source.includes("<") && source.includes(">")) {
    return prepareStoredHtmlForEditor(source);
  }
  return plainLinesToEditorHtml(source);
}

function nodeToPlainText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }
  const element = node as HTMLElement;
  const tag = element.tagName;
  if (element.classList.contains("nte-var") || tag === "CODE") {
    const text = (element.textContent ?? "").trim();
    return text;
  }
  if (tag === "BR") {
    return "\n";
  }
  if (tag === "IMG") {
    const alt = (element.getAttribute("alt") ?? "").trim();
    return alt ? `[image: ${alt}]` : "[image]";
  }
  if (tag === "LI") {
    return Array.from(element.childNodes).map(nodeToPlainText).join("").trim();
  }
  if (tag === "HR") {
    return "———";
  }
  return Array.from(element.childNodes).map(nodeToPlainText).join("");
}

export function editorHtmlToPlainLines(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;
  const blocks: string[] = [];

  for (const child of Array.from(body.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent ?? "").trim();
      if (text) blocks.push(text);
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const element = child as HTMLElement;
    const tag = element.tagName;
    if (tag === "UL" || tag === "OL") {
      for (const item of Array.from(element.querySelectorAll(":scope > li"))) {
        const line = nodeToPlainText(item).trim();
        if (line) blocks.push(`• ${line}`);
      }
      continue;
    }
    if (tag === "IMG") {
      const alt = (element.getAttribute("alt") ?? "").trim();
      blocks.push(alt ? `[image: ${alt}]` : "[image]");
      continue;
    }
    const line = nodeToPlainText(element).replace(/\n+/g, " ").trim();
    if (line) blocks.push(line);
  }

  return blocks.join("\n").trim();
}

function allowedStyle(styleValue: string | null): string | null {
  if (!styleValue) return null;
  const textAlign = styleValue
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("text-align:"));
  if (!textAlign) return null;
  const value = textAlign.split(":")[1]?.trim().toLowerCase();
  if (value === "left" || value === "center" || value === "right" || value === "justify") {
    return `text-align: ${value}`;
  }
  return null;
}

function sanitizeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent ?? "");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }
  const element = node as HTMLElement;
  const tag = element.tagName;
  if (element.classList.contains("nte-var") || tag === "CODE") {
    const text = (element.textContent ?? "").trim();
    return escapeHtml(text);
  }
  if (!ALLOWED_TAGS.has(tag)) {
    return Array.from(element.childNodes).map(sanitizeNode).join("");
  }
  if (tag === "BR") {
    return "<br>";
  }
  if (tag === "HR") {
    return "<hr>";
  }
  if (tag === "IMG") {
    const src = (element.getAttribute("src") ?? "").trim();
    if (!isSafeMediaSrc(src)) return "";
    const alt = (element.getAttribute("alt") ?? "").trim();
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="nte-image" />`;
  }
  if (tag === "A") {
    const href = (element.getAttribute("href") ?? "").trim();
    if (
      !isTemplateVariableReference(href) &&
      !href.startsWith("http://") &&
      !href.startsWith("https://") &&
      !href.startsWith("mailto:")
    ) {
      return Array.from(element.childNodes).map(sanitizeNode).join("");
    }
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${Array.from(element.childNodes).map(sanitizeNode).join("")}</a>`;
  }
  const normalizedTag =
    tag === "B" ? "strong" : tag === "I" ? "em" : tag === "STRIKE" ? "s" : tag.toLowerCase();
  const style = allowedStyle(element.getAttribute("style"));
  const styleAttr = style ? ` style="${style}"` : "";
  return `<${normalizedTag}${styleAttr}>${Array.from(element.childNodes).map(sanitizeNode).join("")}</${normalizedTag}>`;
}

export function sanitizeEditorHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.body.childNodes).map(sanitizeNode).join("").trim();
}

export function emailEditorHtmlToStorage(html: string): {
  message_lines: string | null;
  email_body: string | null;
} {
  const plain = editorHtmlToPlainLines(html);
  const sanitized = sanitizeEditorHtml(html);
  const hasImage = /<img\b/i.test(sanitized);
  const textOnly = sanitized.replace(/<[^>]+>/g, "").trim();
  if (!plain && !textOnly && !hasImage) {
    return { message_lines: null, email_body: null };
  }
  return {
    message_lines: plain || (hasImage ? "[image]" : null),
    email_body: sanitized || null,
  };
}

export function telegramEditorHtmlToStorage(html: string): string | null {
  const plain = editorHtmlToPlainLines(html);
  const sanitized = sanitizeEditorHtml(html);
  const hasImage = /<img\b/i.test(sanitized);
  const textOnly = sanitized.replace(/<[^>]+>/g, "").trim();
  if (!plain && !textOnly && !hasImage) {
    return null;
  }
  return sanitized || null;
}

export function isEmptyEditorHtml(html: string): boolean {
  const plain = editorHtmlToPlainLines(html);
  return !plain;
}

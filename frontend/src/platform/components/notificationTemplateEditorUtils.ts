const VARIABLE_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g;

const ALLOWED_TAGS = new Set(["P", "STRONG", "B", "EM", "I", "UL", "OL", "LI", "BR", "A", "SPAN"]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderVariableToken(variable: string): string {
  const trimmed = variable.trim();
  return `<span class="nte-var" contenteditable="false" data-var="${escapeHtml(trimmed)}">{{ ${escapeHtml(trimmed)} }}</span>`;
}

export function injectVariableTokens(text: string): string {
  return text.replace(VARIABLE_PATTERN, (_, variable: string) => renderVariableToken(variable));
}

export function plainLinesToEditorHtml(text: string): string {
  const normalized = text.replace(/\r/g, "").trim();
  if (!normalized) {
    return "<p><br></p>";
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

export function resolveEditorSourceHtml(
  messageLines: string | null | undefined,
  emailBody: string | null | undefined,
  fallbackMessageLines: string,
): string {
  if (!isDefaultEmailBody(emailBody) && emailBody?.trim()) {
    return injectVariableTokens(emailBody.trim());
  }
  const source = (messageLines ?? fallbackMessageLines).replace(/\r/g, "");
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
  if (element.classList.contains("nte-var")) {
    const variable = element.dataset.var?.trim();
    return variable ? `{{ ${variable} }}` : element.textContent ?? "";
  }
  const tag = element.tagName;
  if (tag === "BR") {
    return "\n";
  }
  if (tag === "LI") {
    return Array.from(element.childNodes).map(nodeToPlainText).join("").trim();
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
    const line = nodeToPlainText(element).replace(/\n+/g, " ").trim();
    if (line) blocks.push(line);
  }

  return blocks.join("\n").trim();
}

function sanitizeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent ?? "");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }
  const element = node as HTMLElement;
  if (element.classList.contains("nte-var")) {
    const variable = element.dataset.var?.trim();
    return variable ? `{{ ${variable} }}` : escapeHtml(element.textContent ?? "");
  }
  const tag = element.tagName;
  if (!ALLOWED_TAGS.has(tag)) {
    return Array.from(element.childNodes).map(sanitizeNode).join("");
  }
  if (tag === "BR") {
    return "<br>";
  }
  if (tag === "A") {
    const href = (element.getAttribute("href") ?? "").trim();
    if (!href.startsWith("http://") && !href.startsWith("https://") && !href.startsWith("mailto:")) {
      return Array.from(element.childNodes).map(sanitizeNode).join("");
    }
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${Array.from(element.childNodes).map(sanitizeNode).join("")}</a>`;
  }
  const normalizedTag = tag === "B" ? "strong" : tag === "I" ? "em" : tag.toLowerCase();
  return `<${normalizedTag}>${Array.from(element.childNodes).map(sanitizeNode).join("")}</${normalizedTag}>`;
}

export function sanitizeEditorHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.body.childNodes).map(sanitizeNode).join("").trim();
}

export function hasRichFormatting(html: string): boolean {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Boolean(doc.body.querySelector("strong,b,em,i,ul,ol,a"));
}

export function editorHtmlToStorage(html: string): {
  message_lines: string | null;
  email_body: string | null;
} {
  const plain = editorHtmlToPlainLines(html);
  if (!plain) {
    return { message_lines: null, email_body: null };
  }
  const sanitized = sanitizeEditorHtml(html);
  const email_body = hasRichFormatting(sanitized) ? sanitized : null;
  return {
    message_lines: plain,
    email_body,
  };
}

export function insertTextAtSelection(text: string) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  selection.deleteFromDocument();
  const range = selection.getRangeAt(0);
  range.collapse(false);
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.setEndAfter(textNode);
  selection.removeAllRanges();
  selection.addRange(range);
}

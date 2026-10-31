"""Тёмное письмо в цветах кабинета. Оболочка зашита в код, не в редактор шаблонов."""

from __future__ import annotations

from html import escape
import re
from urllib.parse import urlparse

EMAIL_SITE_URL = "https://noren.digital"
EMAIL_REPLY_TO = "support@noren.digital"
EMAIL_TELEGRAM_URL = "https://t.me/norendigital"
LANGUAGE_BREAK = "---"

_EMPTY_VALUE = re.compile(r"^[-—–]+$")
_LABELED_LINE = re.compile(r"^([^:\n]{1,80}):\s*(.*)$")
_GREETING_EMPTY = re.compile(r"(Здравствуйте|Hello),\s*!")
_BLANK_RUN = re.compile(r"\n{3,}")

# Строки, которые удобно копировать: пароль, ключи, токены, адрес.
_COPY_LABELS = {
    "временный пароль",
    "temporary password",
    "код восстановления",
    "recovery code",
    "recovery token",
    "публичный ключ",
    "public key",
    "секретный ключ",
    "secret key",
    "токен приглашения",
    "invite token",
    "адрес",
    "address",
}


def resolve_site_url(brand_url: str | None) -> str:
    value = (brand_url or "").strip()
    if value.startswith("http://") or value.startswith("https://"):
        return value
    return EMAIL_SITE_URL


def resolve_reply_email(reply_to: str | None) -> str:
    value = (reply_to or "").strip()
    if "@" in value:
        return value
    return EMAIL_REPLY_TO


def prepare_letter_text(raw_text: str) -> str:
    """Убирает пустые поля вроде «Комментарий: -» и пустое обращение."""
    text = (raw_text or "").replace("\r\n", "\n").replace("\r", "\n")
    kept: list[str] = []
    for line in text.split("\n"):
        stripped = line.strip()
        if stripped == LANGUAGE_BREAK:
            kept.append(LANGUAGE_BREAK)
            continue
        match = _LABELED_LINE.match(stripped)
        if match:
            value = match.group(2).strip()
            if not value or _EMPTY_VALUE.match(value):
                continue
        kept.append(stripped)
    cleaned = _GREETING_EMPTY.sub(r"\1!", "\n".join(kept))
    cleaned = _BLANK_RUN.sub("\n\n", cleaned).strip()
    return cleaned


def letter_body_html(raw_text: str) -> str:
    text = prepare_letter_text(raw_text)
    if not text:
        return ""
    parts = re.split(r"\n---\n", text, maxsplit=1)
    russian = _section_html(parts[0].strip(), muted=False)
    if len(parts) == 1:
        return russian
    english = _section_html(parts[1].strip(), muted=True)
    divider = (
        '<p style="margin:22px 0 12px;font-size:11px;letter-spacing:.08em;'
        'text-transform:uppercase;color:#64748b;">English</p>'
    )
    return russian + divider + english


def letter_footer_lines(*, site_url: str, reply_email: str) -> list[str]:
    site_label = _site_label(site_url)
    return [
        site_label,
        f"Telegram: {EMAIL_TELEGRAM_URL}",
        reply_email,
    ]


def wrap_letter_html(
    *,
    body_html: str,
    brand_name: str,
    logo_url: str | None,
    brand_url: str | None,
    reply_to: str | None,
) -> str:
    if "<html" in (body_html or "").lower():
        return body_html
    site_url = resolve_site_url(brand_url)
    reply_email = resolve_reply_email(reply_to)
    safe_brand = escape(brand_name.strip() or "NorenDigital")
    preheader = _preheader(body_html)
    logo = _logo_html(logo_url, safe_brand, height=36)
    footer_logo = _logo_html(logo_url, safe_brand, height=22)
    footer_links = _footer_links_html(site_url=site_url, reply_email=reply_email)
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>{safe_brand}</title>
</head>
<body style="margin:0;padding:0;background:#181922;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#181922;">{preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#181922" style="background:#181922;margin:0;padding:0;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#2a2c39" style="width:600px;max-width:600px;background:#2a2c39;border-radius:16px;border:1px solid #343746;">
<tr><td bgcolor="#00a3ff" height="3" style="height:3px;background:#00a3ff;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 8px;font-family:Segoe UI,Arial,sans-serif;">
{logo}
</td></tr>
<tr><td style="padding:8px 28px 28px;font-family:Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.55;color:#f8fafc;">
{body_html}
</td></tr>
<tr><td bgcolor="#23242f" style="padding:18px 28px 22px;background:#23242f;border-top:1px solid #343746;font-family:Segoe UI,Arial,sans-serif;">
{footer_logo}
{footer_links}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""


def _section_html(text: str, *, muted: bool) -> str:
    if not text:
        return ""
    color = "#94a3b8" if muted else "#f8fafc"
    chunks: list[str] = []
    for block in re.split(r"\n{2,}", text):
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        if not lines:
            continue
        for line in lines:
            chunks.append(_line_html(line, color=color))
    return "".join(chunks)


def _line_html(line: str, *, color: str) -> str:
    match = _LABELED_LINE.match(line)
    if not match:
        return (
            f'<p style="margin:0 0 14px;color:{color};font-size:15px;line-height:1.55;">'
            f"{escape(line)}</p>"
        )
    label = match.group(1).strip()
    value = match.group(2).strip()
    if label.casefold() in _COPY_LABELS:
        return _copy_block_html(label, value)
    return (
        '<p style="margin:0 0 10px;font-size:15px;line-height:1.5;">'
        f'<span style="color:#94a3b8;">{escape(label)}</span><br>'
        f'<span style="color:{color};">{escape(value)}</span></p>'
    )


def _copy_block_html(label: str, value: str) -> str:
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'bgcolor="#1e1f29" style="width:100%;background:#1e1f29;border:1px solid #343746;'
        'border-radius:10px;margin:0 0 10px;">'
        '<tr><td style="padding:10px 14px;font-family:Segoe UI,Arial,sans-serif;">'
        f'<div style="font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#94a3b8;">{escape(label)}</div>'
        '<div style="margin-top:4px;font-family:Consolas,Menlo,monospace;font-size:14px;'
        f'line-height:1.45;color:#f8fafc;word-break:break-all;">{escape(value)}</div>'
        "</td></tr></table>"
    )


def _logo_html(logo_url: str | None, safe_brand: str, *, height: int) -> str:
    url = (logo_url or "").strip()
    if url.startswith("http://") or url.startswith("https://"):
        return (
            f'<img src="{escape(url)}" alt="{safe_brand}" height="{height}" '
            f'style="height:{height}px;max-width:220px;display:block;border:0;outline:none;">'
        )
    if height > 28:
        return (
            f'<p style="margin:0;font-size:18px;font-weight:700;color:#f8fafc;">{safe_brand}</p>'
        )
    return f'<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#f8fafc;">{safe_brand}</p>'


def _footer_links_html(*, site_url: str, reply_email: str) -> str:
    site_label = escape(_site_label(site_url))
    telegram = escape(EMAIL_TELEGRAM_URL)
    reply = escape(reply_email)
    link = "color:#00a3ff;text-decoration:none;"
    cell = "font-family:Segoe UI,Arial,sans-serif;font-size:13px;line-height:1.6;color:#94a3b8;"
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:10px;">'
        "<tr>"
        f'<td style="{cell}padding-right:16px;"><a href="{escape(site_url)}" style="{link}">{site_label}</a></td>'
        f'<td style="{cell}padding-right:16px;"><a href="{telegram}" style="{link}">Telegram</a></td>'
        f'<td style="{cell}"><a href="mailto:{reply}" style="{link}">{reply}</a></td>'
        "</tr></table>"
    )


def _site_label(site_url: str) -> str:
    parsed = urlparse(site_url)
    host = (parsed.netloc or site_url).strip()
    if host.startswith("www."):
        host = host[4:]
    return host or site_url


def _preheader(body_html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", body_html or "")
    text = re.sub(r"\s+", " ", text).strip()
    return escape(text[:140])

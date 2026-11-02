from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

SSR_MAIN_ORIGIN = "__SSR_MAIN_ORIGIN__"
SSR_API_BASE = "__SSR_API_BASE__"
LOCALE_COOKIE = "cryptoprocessing_locale"
LOCALES = ("ru", "en", "ar")
RTL_LOCALES = {"ar"}
RESERVED_HOST_PREFIXES = ("docs", "admin", "app", "pay", "api", "www")

_ROOT_RE = re.compile(r'<div id="root">\s*</div>')
_TITLE_RE = re.compile(r"<title>[^<]*</title>")
_HTML_RE = re.compile(r"<html\b[^>]*>")


def pick_locale(cookie_header: str | None, accept_language: str | None) -> str:
    if cookie_header:
        for part in cookie_header.split(";"):
            name, sep, value = part.strip().partition("=")
            if sep and name == LOCALE_COOKIE and value in LOCALES:
                return value
    if accept_language:
        for item in accept_language.split(","):
            token = item.split(";", 1)[0].strip().lower()
            primary = token.split("-", 1)[0]
            if primary in LOCALES:
                return primary
    return "ru"


def _hostname(host: str) -> str:
    return host.split(",")[0].strip().split(":")[0].lower()


def _apex_host(hostname: str) -> str:
    for prefix in RESERVED_HOST_PREFIXES:
        marker = f"{prefix}."
        if hostname.startswith(marker):
            return hostname[len(marker) :]
    return hostname


def is_marketing_host(hostname: str) -> bool:
    parts = [part for part in hostname.split(".") if part]
    if len(parts) < 2:
        return True
    prefix = parts[0]
    if prefix == "www":
        return True
    return prefix not in {"app", "admin", "api", "docs", "pay"}


def classify_public_request(host: str, path: str) -> tuple[str, str] | None:
    hostname = _hostname(host)
    normalized = urlsplit(path).path or "/"
    if normalized != "/" and normalized.endswith("/"):
        normalized = normalized.rstrip("/") or "/"
    if hostname.startswith("docs."):
        return ("docs", normalized)
    if is_marketing_host(hostname) and normalized == "/":
        return ("landing", "/")
    return None


def origins_for_request(host: str, proto: str) -> dict[str, str]:
    hostname = _hostname(host)
    scheme = proto.split(",")[0].strip() or "https"
    apex = _apex_host(hostname)
    if hostname.startswith("docs."):
        main_host = apex
    else:
        main_host = hostname or apex
    return {
        "mainOrigin": f"{scheme}://{main_host}",
        "apiBaseUrl": f"{scheme}://api.{apex}/api/v1",
    }


def _fragment_path(ssr_root: Path, surface: str, locale: str, url_path: str) -> Path:
    base = ssr_root / surface / locale
    if url_path in ("", "/"):
        return base / "index.json"
    return base / f"{url_path.strip('/')}.json"


def load_public_fragment(ssr_root: Path, surface: str, locale: str, url_path: str) -> dict[str, str] | None:
    candidate = _fragment_path(ssr_root, surface, locale, url_path)
    if not candidate.is_file():
        return None
    payload = json.loads(candidate.read_text(encoding="utf-8"))
    html = payload.get("html")
    title = payload.get("title")
    description = payload.get("description")
    if not isinstance(html, str) or not html.strip():
        return None
    return {
        "html": html,
        "title": title if isinstance(title, str) else "",
        "description": description if isinstance(description, str) else "",
    }


def _escape_meta(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace('"', "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _upsert_meta(document: str, attribute: str, key: str, content: str) -> str:
    escaped = _escape_meta(content)
    tag = f'<meta {attribute}="{key}" content="{escaped}" />'
    pattern = re.compile(rf'<meta {attribute}="{re.escape(key)}" content="[^"]*"\s*/>')
    if pattern.search(document):
        return pattern.sub(tag, document, count=1)
    return document.replace("</head>", f"    {tag}\n  </head>", 1)


def _upsert_canonical(document: str, href: str) -> str:
    escaped = _escape_meta(href)
    tag = f'<link rel="canonical" href="{escaped}" />'
    pattern = re.compile(r'<link rel="canonical" href="[^"]*"\s*/>')
    if pattern.search(document):
        return pattern.sub(tag, document, count=1)
    return document.replace("</head>", f"    {tag}\n  </head>", 1)


def apply_public_ssr(
    index_html: str,
    *,
    host: str,
    path: str,
    cookie: str | None,
    accept_language: str | None,
    proto: str,
    seo: dict[str, Any],
    ssr_root: Path,
) -> str:
    classified = classify_public_request(host, path)
    if classified is None:
        return index_html
    surface, url_path = classified
    locale = pick_locale(cookie, accept_language)
    fragment = load_public_fragment(ssr_root, surface, locale, url_path)
    if fragment is None:
        return index_html

    origins = origins_for_request(host, proto)
    html = fragment["html"].replace(SSR_MAIN_ORIGIN, origins["mainOrigin"]).replace(SSR_API_BASE, origins["apiBaseUrl"])
    if not _ROOT_RE.search(index_html):
        return index_html

    direction = "rtl" if locale in RTL_LOCALES else "ltr"
    document = _HTML_RE.sub(f'<html lang="{locale}" dir="{direction}">', index_html, count=1)
    document = _ROOT_RE.sub(f'<div id="root">{html}</div>', document, count=1)

    if surface == "docs":
        brand = str(seo.get("brand_name") or "NorenDigital").strip() or "NorenDigital"
        title = fragment["title"].strip() or brand
        description = fragment["description"].strip()
        full_title = title if brand in title else f"{title} · {brand}"
        canonical = f"{origins['mainOrigin'].split('://', 1)[0]}://{_hostname(host)}{url_path}"
        if _TITLE_RE.search(document):
            document = _TITLE_RE.sub(f"<title>{_escape_meta(full_title)}</title>", document, count=1)
        document = _upsert_meta(document, "name", "description", description)
        document = _upsert_meta(document, "property", "og:title", full_title)
        document = _upsert_meta(document, "property", "og:description", description)
        document = _upsert_meta(document, "property", "og:url", canonical)
        document = _upsert_canonical(document, canonical)

    bootstrap = {
        "surface": surface,
        "locale": locale,
        "url": url_path,
        "mainOrigin": origins["mainOrigin"],
        "apiBaseUrl": origins["apiBaseUrl"],
    }
    payload = json.dumps(bootstrap, ensure_ascii=False).replace("<", "\\u003c")
    script = f'<script id="public-ssr" type="application/json">{payload}</script>'
    return document.replace("</head>", f"    {script}\n  </head>", 1)

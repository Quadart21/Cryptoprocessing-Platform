from __future__ import annotations

import html
import re
from functools import lru_cache
from pathlib import Path
from typing import Any


def _meta(name: str, content: str | None, *, property_name: bool = False) -> str | None:
    if not content:
        return None
    escaped = html.escape(content, quote=True)
    if property_name:
        return f'<meta property="{html.escape(name, quote=True)}" content="{escaped}" />'
    return f'<meta name="{html.escape(name, quote=True)}" content="{escaped}" />'


def render_spa_index_html(index_html: str, seo: dict[str, Any]) -> str:
    title = html.escape(str(seo.get("title") or "NorenDigital"))
    rendered = re.sub(r"<title>[^<]*</title>", f"<title>{title}</title>", index_html, count=1)

    tags: list[str] = []
    for tag in (
        _meta("description", seo.get("description")),
        _meta("keywords", seo.get("keywords")),
        _meta("robots", seo.get("robots") or "index, follow"),
        _meta("og:title", seo.get("title"), property_name=True),
        _meta("og:description", seo.get("description"), property_name=True),
        _meta("og:image", seo.get("og_image_url"), property_name=True),
        _meta("og:url", seo.get("canonical_url"), property_name=True),
    ):
        if tag:
            tags.append(tag)

    favicon_url = seo.get("favicon_url")
    if favicon_url:
        tags.append(
            f'<link rel="icon" href="{html.escape(str(favicon_url), quote=True)}" />'
        )

    canonical_url = seo.get("canonical_url")
    if canonical_url:
        tags.append(
            f'<link rel="canonical" href="{html.escape(str(canonical_url), quote=True)}" />'
        )

    if not tags:
        return rendered

    injection = "\n    ".join(tags)
    return rendered.replace("</head>", f"    {injection}\n  </head>", 1)


@lru_cache(maxsize=4)
def load_index_template(index_path: str) -> str:
    return Path(index_path).read_text(encoding="utf-8")

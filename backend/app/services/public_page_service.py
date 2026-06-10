from __future__ import annotations

from html.parser import HTMLParser
from html import escape
import re
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.public_page import PublicPage


class _HtmlAllowlistSanitizer(HTMLParser):
    ALLOWED_TAGS = {
        "a",
        "abbr",
        "b",
        "blockquote",
        "br",
        "code",
        "div",
        "em",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "hr",
        "i",
        "img",
        "li",
        "ol",
        "p",
        "pre",
        "span",
        "strong",
        "table",
        "tbody",
        "td",
        "th",
        "thead",
        "tr",
        "u",
        "ul",
    }
    ALLOWED_ATTRS = {
        "a": {"href", "title", "target", "rel"},
        "img": {"src", "alt", "title", "width", "height"},
        "div": {"class"},
        "span": {"class"},
        "p": {"class"},
        "table": {"class"},
        "th": {"colspan", "rowspan"},
        "td": {"colspan", "rowspan"},
        "code": {"class"},
        "pre": {"class"},
    }
    SELF_CLOSING = {"br", "hr", "img"}
    URL_ATTRS = {"href", "src"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.stack: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        t = tag.lower().strip()
        if t not in self.ALLOWED_TAGS:
            return
        cleaned = self._clean_attrs(t, attrs)
        attrs_part = "".join(f' {k}="{escape(v, quote=True)}"' for k, v in cleaned)
        if t in self.SELF_CLOSING:
            self.parts.append(f"<{t}{attrs_part}>")
            return
        self.parts.append(f"<{t}{attrs_part}>")
        self.stack.append(t)

    def handle_endtag(self, tag: str) -> None:
        t = tag.lower().strip()
        if t not in self.ALLOWED_TAGS or t in self.SELF_CLOSING:
            return
        if t not in self.stack:
            return
        while self.stack:
            top = self.stack.pop()
            self.parts.append(f"</{top}>")
            if top == t:
                break

    def handle_data(self, data: str) -> None:
        if data:
            self.parts.append(escape(data))

    def handle_entityref(self, name: str) -> None:
        self.parts.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        self.parts.append(f"&#{name};")

    def get_html(self) -> str:
        while self.stack:
            self.parts.append(f"</{self.stack.pop()}>")
        return "".join(self.parts).strip()

    def _clean_attrs(self, tag: str, attrs: list[tuple[str, str | None]]) -> list[tuple[str, str]]:
        allowed = self.ALLOWED_ATTRS.get(tag, set())
        output: list[tuple[str, str]] = []
        for key, raw_value in attrs:
            attr = (key or "").lower().strip()
            if attr not in allowed:
                continue
            value = str(raw_value or "").strip()
            if not value:
                continue
            if attr in self.URL_ATTRS and not PublicPageService.is_safe_url(value):
                continue
            if tag == "a" and attr == "target" and value not in {"_blank", "_self"}:
                continue
            output.append((attr, value))
        return output


class PublicPageService:
    STATUS_DRAFT = "draft"
    STATUS_PUBLISHED = "published"
    VALID_STATUSES = {STATUS_DRAFT, STATUS_PUBLISHED}
    SLUG_PATTERN = re.compile(r"[^a-z0-9-]+")

    def __init__(self, db: AsyncSession):
        self.db = db

    @classmethod
    def normalize_slug(cls, raw_slug: str) -> str:
        slug = raw_slug.strip().lower().replace("_", "-")
        slug = re.sub(r"\s+", "-", slug)
        slug = cls.SLUG_PATTERN.sub("-", slug)
        slug = re.sub(r"-{2,}", "-", slug).strip("-")
        return slug

    @staticmethod
    def is_safe_url(url: str) -> bool:
        normalized = url.strip().lower()
        if normalized.startswith("http://") or normalized.startswith("https://"):
            return True
        if normalized.startswith("/"):
            return True
        return False

    @staticmethod
    def sanitize_html(content_html: str) -> str:
        parser = _HtmlAllowlistSanitizer()
        parser.feed(content_html or "")
        parser.close()
        return parser.get_html()

    async def list_pages(self) -> list[PublicPage]:
        stmt = select(PublicPage).order_by(PublicPage.created_at.desc())
        return list((await self.db.scalars(stmt)).all())

    async def list_published_pages(self) -> list[PublicPage]:
        stmt = (
            select(PublicPage)
            .where(PublicPage.status == self.STATUS_PUBLISHED)
            .order_by(PublicPage.header_order.asc(), PublicPage.footer_order.asc(), PublicPage.title.asc())
        )
        return list((await self.db.scalars(stmt)).all())

    async def get_published_page_by_slug(self, slug: str) -> PublicPage | None:
        normalized = self.normalize_slug(slug)
        stmt = select(PublicPage).where(
            PublicPage.slug == normalized,
            PublicPage.status == self.STATUS_PUBLISHED,
        )
        return await self.db.scalar(stmt)

    async def create_page(self, **payload) -> PublicPage:
        normalized = self._normalize_payload(payload)
        page = PublicPage(id=str(uuid4()), **normalized)
        self.db.add(page)
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise ValueError("A page with this slug already exists.") from exc
        await self.db.refresh(page)
        return page

    async def update_page(self, page_id: str, updates: dict) -> PublicPage:
        page = await self.db.get(PublicPage, page_id)
        if page is None:
            raise ValueError("Page not found.")

        merged = {
            "slug": page.slug,
            "title": page.title,
            "content_html": page.content_html,
            "status": page.status,
            "show_in_header": page.show_in_header,
            "show_in_footer": page.show_in_footer,
            "header_order": page.header_order,
            "footer_order": page.footer_order,
        }
        merged.update({k: v for k, v in updates.items() if v is not None})
        normalized = self._normalize_payload(merged)

        for key, value in normalized.items():
            setattr(page, key, value)

        self.db.add(page)
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise ValueError("A page with this slug already exists.") from exc
        await self.db.refresh(page)
        return page

    async def delete_page(self, page_id: str) -> None:
        page = await self.db.get(PublicPage, page_id)
        if page is None:
            raise ValueError("Page not found.")
        await self.db.delete(page)
        await self.db.commit()

    def _normalize_payload(self, payload: dict) -> dict:
        slug = self.normalize_slug(str(payload.get("slug") or ""))
        if not slug:
            raise ValueError("Slug must contain Latin letters, digits, or hyphens.")
        title = str(payload.get("title") or "").strip()
        if not title:
            raise ValueError("Page title is required.")
        status = str(payload.get("status") or self.STATUS_DRAFT).strip().lower()
        if status not in self.VALID_STATUSES:
            raise ValueError("Page status must be draft or published.")
        content_html = self.sanitize_html(str(payload.get("content_html") or ""))
        if status == self.STATUS_PUBLISHED and not content_html:
            raise ValueError("Cannot publish an empty page.")
        show_in_header = bool(payload.get("show_in_header", False))
        show_in_footer = bool(payload.get("show_in_footer", False))
        header_order = int(payload.get("header_order") or 0)
        footer_order = int(payload.get("footer_order") or 0)

        return {
            "slug": slug,
            "title": title,
            "content_html": content_html,
            "status": status,
            "show_in_header": show_in_header,
            "show_in_footer": show_in_footer,
            "header_order": header_order,
            "footer_order": footer_order,
        }

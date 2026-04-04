from datetime import datetime

from pydantic import BaseModel, Field


class PublicPageBase(BaseModel):
    slug: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=1, max_length=255)
    content_html: str = Field(default="")
    status: str = Field(default="draft")
    show_in_header: bool = False
    show_in_footer: bool = False
    header_order: int = 0
    footer_order: int = 0


class PublicPageCreateRequest(PublicPageBase):
    pass


class PublicPageUpdateRequest(BaseModel):
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content_html: str | None = None
    status: str | None = None
    show_in_header: bool | None = None
    show_in_footer: bool | None = None
    header_order: int | None = None
    footer_order: int | None = None


class PublicPageResponse(PublicPageBase):
    id: str
    created_at: datetime
    updated_at: datetime


class PublicPageNavigationItem(BaseModel):
    slug: str
    title: str
    show_in_header: bool
    show_in_footer: bool
    header_order: int
    footer_order: int


class PublicPageListResponse(BaseModel):
    items: list[PublicPageNavigationItem]

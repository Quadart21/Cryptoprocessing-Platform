from pydantic import BaseModel


class PublicSeoResponse(BaseModel):
    title: str | None = None
    description: str | None = None
    keywords: str | None = None
    favicon_url: str | None = None
    og_image_url: str | None = None
    robots: str = "index, follow"
    canonical_url: str | None = None

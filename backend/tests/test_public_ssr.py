import json
import tempfile
import unittest
from pathlib import Path

from app.services.public_ssr import (
    apply_public_ssr,
    classify_public_request,
    origins_for_request,
    pick_locale,
)


INDEX = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>NorenDigital</title>
    <meta name="description" content="Accept crypto payments" />
    <meta property="og:title" content="NorenDigital" />
    <meta property="og:description" content="Accept crypto payments" />
    <meta property="og:url" content="https://noren.digital" />
    <link rel="canonical" href="https://noren.digital" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
"""


class PublicSsrTests(unittest.TestCase):
    def test_pick_locale_prefers_cookie(self) -> None:
        cookie = "session=1; cryptoprocessing_locale=en; other=1"
        self.assertEqual(pick_locale(cookie, "ru-RU,ru;q=0.9"), "en")

    def test_pick_locale_uses_accept_language(self) -> None:
        self.assertEqual(pick_locale(None, "en-US,en;q=0.8,ru;q=0.5"), "en")
        self.assertEqual(pick_locale(None, "ar,en;q=0.5"), "ar")
        self.assertEqual(pick_locale(None, "fr-FR,fr;q=0.9"), "ru")

    def test_classify_docs_and_landing(self) -> None:
        self.assertEqual(classify_public_request("docs.noren.digital", "/quickstart/"), ("docs", "/quickstart"))
        self.assertEqual(classify_public_request("noren.digital", "/"), ("landing", "/"))
        self.assertIsNone(classify_public_request("app.noren.digital", "/"))
        self.assertIsNone(classify_public_request("noren.digital", "/page/about"))

    def test_origins_strip_docs_host(self) -> None:
        origins = origins_for_request("docs.noren.digital", "https")
        self.assertEqual(origins["mainOrigin"], "https://noren.digital")
        self.assertEqual(origins["apiBaseUrl"], "https://api.noren.digital/api/v1")

    def test_apply_docs_fragment(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = root / "docs" / "ru" / "quickstart.json"
            target.parent.mkdir(parents=True)
            target.write_text(
                json.dumps(
                    {
                        "title": "Быстрый старт",
                        "description": "Семь шагов",
                        "html": "<article><h1>Быстрый старт</h1><code>__SSR_API_BASE__/client</code></article>",
                    }
                ),
                encoding="utf-8",
            )
            rendered = apply_public_ssr(
                INDEX,
                host="docs.noren.digital",
                path="/quickstart",
                cookie=None,
                accept_language="ru",
                proto="https",
                seo={"brand_name": "NorenDigital"},
                ssr_root=root,
            )
        self.assertIn("<h1>Быстрый старт</h1>", rendered)
        self.assertIn("https://api.noren.digital/api/v1/client", rendered)
        self.assertIn('<html lang="ru" dir="ltr">', rendered)
        self.assertIn("<title>Быстрый старт · NorenDigital</title>", rendered)
        self.assertIn('id="public-ssr"', rendered)
        self.assertIn('"surface": "docs"', rendered)
        self.assertIn('href="https://docs.noren.digital/quickstart"', rendered)

    def test_landing_keeps_db_title(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = root / "landing" / "en" / "index.json"
            target.parent.mkdir(parents=True)
            target.write_text(
                json.dumps(
                    {
                        "title": "Accept crypto the easy way",
                        "description": "Lead",
                        "html": "<main><h1>Accept crypto</h1></main>",
                    }
                ),
                encoding="utf-8",
            )
            rendered = apply_public_ssr(
                INDEX,
                host="noren.digital",
                path="/",
                cookie="cryptoprocessing_locale=en",
                accept_language="ru",
                proto="https",
                seo={"brand_name": "NorenDigital", "title": "NorenDigital"},
                ssr_root=root,
            )
        self.assertIn("<h1>Accept crypto</h1>", rendered)
        self.assertIn("<title>NorenDigital</title>", rendered)
        self.assertIn('"locale": "en"', rendered)
        self.assertNotIn("__SSR_", rendered)


if __name__ == "__main__":
    unittest.main()

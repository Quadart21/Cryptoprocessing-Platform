#!/usr/bin/env python3
"""Package CMS integration modules into frontend/public/downloads/*.zip."""

from __future__ import annotations

import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "frontend" / "public" / "downloads"

SKIP_DIR_NAMES = {"__pycache__", ".git", "node_modules"}


def add_tree(archive: zipfile.ZipFile, source: Path, arc_prefix: str = "") -> None:
    """Add a file or directory into the zip under optional arc_prefix."""
    if source.is_file():
        name = f"{arc_prefix}/{source.name}".strip("/") if arc_prefix else source.name
        archive.write(source, arcname=name)
        return

    for file_path in sorted(source.rglob("*")):
        if any(part in SKIP_DIR_NAMES for part in file_path.parts):
            continue
        if file_path.is_dir():
            continue
        rel = file_path.relative_to(source)
        name = f"{arc_prefix}/{rel.as_posix()}".strip("/") if arc_prefix else rel.as_posix()
        archive.write(file_path, arcname=name)


def package_wordpress(target: Path) -> None:
    """ZIP ready to drop into wp-content/plugins/ (folder noren-payments/)."""
    plugin = ROOT / "integrations" / "wordpress" / "noren-payments"
    readme = ROOT / "integrations" / "wordpress" / "README.md"
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        add_tree(archive, plugin, "noren-payments")
        if readme.exists():
            archive.write(readme, arcname="noren-payments/README.md")


def package_simple(target: Path, source: Path) -> None:
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        add_tree(archive, source)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []

    wordpress = OUT_DIR / "noren-wordpress.zip"
    package_wordpress(wordpress)
    written.append(wordpress)
    print(f"Created {wordpress.relative_to(ROOT)} ({wordpress.stat().st_size} bytes)")

    for filename, source in (
        ("noren-dle.zip", ROOT / "integrations" / "dle"),
        ("noren-tilda.zip", ROOT / "integrations" / "tilda"),
        ("noren-1c.zip", ROOT / "integrations" / "1c"),
        ("noren-integrations-all.zip", ROOT / "integrations"),
    ):
        path = OUT_DIR / filename
        package_simple(path, source)
        written.append(path)
        print(f"Created {path.relative_to(ROOT)} ({path.stat().st_size} bytes)")

    print(f"Done: {len(written)} archives in {OUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

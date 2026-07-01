#!/usr/bin/env python3
"""Package CMS integration modules into frontend/public/downloads/*.zip."""

from __future__ import annotations

import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "frontend" / "public" / "downloads"

PACKAGES: list[tuple[str, list[Path]]] = [
    (
        "noren-wordpress.zip",
        [ROOT / "integrations" / "wordpress" / "noren-payments"],
    ),
    (
        "noren-dle.zip",
        [ROOT / "integrations" / "dle"],
    ),
    (
        "noren-tilda.zip",
        [ROOT / "integrations" / "tilda"],
    ),
    (
        "noren-1c.zip",
        [ROOT / "integrations" / "1c"],
    ),
    (
        "noren-integrations-all.zip",
        [ROOT / "integrations"],
    ),
]

SKIP_DIR_NAMES = {"__pycache__", ".git", "node_modules"}


def add_path(archive: zipfile.ZipFile, path: Path, arc_prefix: str) -> None:
    if path.is_dir():
        for child in sorted(path.rglob("*")):
            if any(part in SKIP_DIR_NAMES for part in child.parts):
                continue
            if child.is_dir():
                continue
            rel = child.relative_to(path.parent if path.is_file() else path)
            archive.write(child, arcname=f"{arc_prefix}/{rel.as_posix()}".lstrip("/"))
        return

    archive.write(path, arcname=f"{arc_prefix}/{path.name}")


def package_one(filename: str, sources: list[Path]) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    target = OUT_DIR / filename
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for source in sources:
            if not source.exists():
                raise FileNotFoundError(f"Missing integration source: {source}")
            if source.is_dir():
                for file_path in sorted(source.rglob("*")):
                    if any(part in SKIP_DIR_NAMES for part in file_path.parts):
                        continue
                    if file_path.is_dir():
                        continue
                    rel = file_path.relative_to(source)
                    archive.write(file_path, arcname=rel.as_posix())
            else:
                archive.write(source, arcname=source.name)
    return target


def main() -> None:
    written: list[Path] = []
    for filename, sources in PACKAGES:
        path = package_one(filename, sources)
        written.append(path)
        print(f"Created {path.relative_to(ROOT)} ({path.stat().st_size} bytes)")
    print(f"Done: {len(written)} archives in {OUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

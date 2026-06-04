#!/usr/bin/env python3
"""Publish GitHub Releases from CHANGELOG (single version or backfill all missing)."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CHANGELOG = ROOT / "CHANGELOG.md"
RELEASES_URL = "https://github.com/Quadart21/Cryptoprocessing-Platform/releases"


def parse_changelog() -> dict[str, str]:
    text = CHANGELOG.read_text(encoding="utf-8")
    sections = re.split(r"\n## \[", text)[1:]
    notes: dict[str, str] = {}
    for section in sections:
        match = re.match(r"([\d.]+)\][^\n]*\n([\s\S]*?)(?=\n---\n|\Z)", section)
        if not match:
            continue
        version, body = match.group(1), match.group(2).strip()
        notes[version] = f"## [{version}]\n\n{body}".strip()
    return notes


def existing_releases() -> set[str]:
    result = subprocess.run(
        ["gh", "release", "list", "--limit", "500", "--json", "tagName", "-q", ".[].tagName"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return {line.strip() for line in result.stdout.splitlines() if line.strip()}


def git_tags() -> list[str]:
    result = subprocess.run(
        ["git", "tag", "--sort=-v:refname"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def create_release(tag: str, title: str, notes: str, latest: bool = False) -> str:
    cmd = ["gh", "release", "create", tag, "--title", title, "--notes", notes]
    if latest:
        cmd.append("--latest")
    result = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, check=True)
    url = result.stdout.strip() or f"{RELEASES_URL}/tag/{tag}"
    return url


def publish_version(version: str, changelog_notes: dict[str, str], released: set[str]) -> str:
    normalized = version.lstrip("v")
    tag = f"v{normalized}"
    if normalized not in changelog_notes:
        raise SystemExit(f"No CHANGELOG section for [{normalized}]")
    if tag in released:
        print(f"GitHub Release already exists: {tag}")
        return f"{RELEASES_URL}/tag/{tag}"
    url = create_release(tag, tag, changelog_notes[normalized], latest=True)
    print(f"GitHub Release: {url}")
    return url


def publish_all_missing(changelog_notes: dict[str, str], released: set[str]) -> list[str]:
    pending: list[str] = []
    for tag in git_tags():
        version = tag.lstrip("v")
        if tag in released or version not in changelog_notes:
            continue
        pending.append(tag)

    if not pending:
        print("No pending releases.")
        return []

    pending.sort(key=lambda t: [int(x) for x in t.lstrip("v").split(".")])
    print(f"Creating {len(pending)} GitHub release(s): {', '.join(pending)}")

    urls: list[str] = []
    for index, tag in enumerate(pending):
        version = tag.lstrip("v")
        is_latest = index == len(pending) - 1
        url = create_release(tag, tag, changelog_notes[version], latest=is_latest)
        urls.append(url)
        print(f"  + {tag}{' (latest)' if is_latest else ''}: {url}")
    return urls


def main() -> int:
    parser = argparse.ArgumentParser(description="Publish GitHub Releases from CHANGELOG")
    parser.add_argument(
        "--version",
        "-V",
        help="Publish one release, e.g. 0.14.37 or v0.14.37 (used after every release)",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Backfill all tags that have CHANGELOG entries but no GitHub Release",
    )
    args = parser.parse_args()

    changelog_notes = parse_changelog()
    released = existing_releases()

    if args.version:
        publish_version(args.version, changelog_notes, released)
        return 0
    if args.all:
        publish_all_missing(changelog_notes, released)
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())

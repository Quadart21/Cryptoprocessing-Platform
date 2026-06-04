#!/usr/bin/env python3
"""Create GitHub Releases for git tags that have CHANGELOG entries but no release yet."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CHANGELOG = ROOT / "CHANGELOG.md"


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


def create_release(tag: str, title: str, notes: str, latest: bool = False) -> None:
    cmd = ["gh", "release", "create", tag, "--title", title, "--notes", notes]
    if latest:
        cmd.append("--latest")
    subprocess.run(cmd, cwd=ROOT, check=True)


def main() -> int:
    changelog_notes = parse_changelog()
    released = existing_releases()
    tags = git_tags()

    pending: list[str] = []
    for tag in tags:
        version = tag.lstrip("v")
        if tag in released:
            continue
        if version not in changelog_notes:
            continue
        pending.append(tag)

    if not pending:
        print("No pending releases.")
        return 0

    # Oldest first; mark only the newest semver as latest.
    pending.sort(key=lambda t: [int(x) for x in t.lstrip("v").split(".")])
    print(f"Creating {len(pending)} GitHub release(s): {', '.join(pending)}")

    for index, tag in enumerate(pending):
        version = tag.lstrip("v")
        is_latest = index == len(pending) - 1
        create_release(tag, tag, changelog_notes[version], latest=is_latest)
        print(f"  + {tag}{' (latest)' if is_latest else ''}")

    return 0


if __name__ == "__main__":
    sys.exit(main())

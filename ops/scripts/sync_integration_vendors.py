#!/usr/bin/env python3
"""Copy shared PHP client/verifier into each CMS module vendor tree."""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SHARED = ROOT / "integrations" / "shared" / "php"

TARGETS = [
    ROOT / "integrations" / "wordpress" / "noren-payments" / "vendor" / "noren",
    ROOT / "integrations" / "dle" / "vendor" / "noren",
    ROOT / "integrations" / "tilda" / "bridge" / "vendor" / "noren",
]

FILES = ["NorenApiClient.php", "NorenWebhookVerifier.php"]


def main() -> None:
    for target in TARGETS:
        target.mkdir(parents=True, exist_ok=True)
        for name in FILES:
            src = SHARED / name
            dst = target / name
            shutil.copy2(src, dst)
            print(f"Synced {dst.relative_to(ROOT)}")
    print("Done.")


if __name__ == "__main__":
    main()

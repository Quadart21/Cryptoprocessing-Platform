#!/usr/bin/env python3
"""Deploy latest main to split servers (API / site) after a release.

Requires local (gitignored) helpers:
  ops/scripts/_deploy_new_servers.py
  ops/scripts/_deploy_secrets.txt

Usage:
  python ops/scripts/deploy_release.py              # API + site
  python ops/scripts/deploy_release.py --targets api
  python ops/scripts/deploy_release.py --targets site
  python ops/scripts/deploy_release.py --targets api,site
"""
from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
HELPER = SCRIPT_DIR / "_deploy_new_servers.py"
SECRETS = SCRIPT_DIR / "_deploy_secrets.txt"
APP_DIR = "/opt/cryptoprocessing"


def _load_helper():
    if not HELPER.exists():
        raise SystemExit(
            f"Missing {HELPER.name}. Local split-deploy helper is required "
            f"(gitignored). Expected next to this script."
        )
    if not SECRETS.exists():
        raise SystemExit(f"Missing {SECRETS.name} with server passwords + GITHUB_TOKEN.")
    spec = importlib.util.spec_from_file_location("deploy_helper", HELPER)
    if spec is None or spec.loader is None:
        raise SystemExit(f"Cannot load {HELPER}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _parse_targets(raw: str) -> list[str]:
    targets = [part.strip().lower() for part in raw.split(",") if part.strip()]
    allowed = {"api", "site"}
    unknown = [t for t in targets if t not in allowed]
    if unknown:
        raise SystemExit(f"Unknown targets {unknown}; use api and/or site")
    if not targets:
        raise SystemExit("No deploy targets")
    # stable unique order
    ordered: list[str] = []
    for key in ("api", "site"):
        if key in targets and key not in ordered:
            ordered.append(key)
    return ordered


def deploy_api(m, secrets_data: dict[str, str]) -> None:
    client = m.connect("api")
    try:
        m.ensure_git_and_repo(client, secrets_data)
        m.run(
            client,
            f"cd '{APP_DIR}' && SKIP_GIT_PULL=1 bash ops/ubuntu/update-server-api.sh",
            timeout=3600,
        )
        m.scrub_git_remote(client)
        m.run(
            client,
            "systemctl is-active cryptoprocessing cryptoprocessing-celery-worker "
            "cryptoprocessing-celery-beat; curl -fsS http://127.0.0.1:8000/api/v1/health; echo",
            check=False,
        )
    finally:
        client.close()


def deploy_site(m, secrets_data: dict[str, str]) -> None:
    api_ip = m.HOSTS["api"]["ip"]
    client = m.connect("site")
    try:
        m.ensure_git_and_repo(client, secrets_data)
        m.run(
            client,
            f"cd '{APP_DIR}' && SKIP_GIT_PULL=1 "
            f"API_UPSTREAM={api_ip}:8000 bash ops/ubuntu/update-server-site.sh",
            timeout=3600,
        )
        m.scrub_git_remote(client)
        m.run(
            client,
            "systemctl is-active nginx; curl -fsS -o /dev/null -w '%{http_code}\\n' "
            "http://127.0.0.1/ || true",
            check=False,
        )
    finally:
        client.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Deploy release to split servers")
    parser.add_argument(
        "--targets",
        default="api,site",
        help="Comma-separated: api, site (default: api,site)",
    )
    args = parser.parse_args()
    targets = _parse_targets(args.targets)

    m = _load_helper()
    secrets_data = m.load_secrets(SECRETS)
    m.init_hosts(secrets_data)

    for target in targets:
        print(f"\n===== deploy {target} =====")
        if target == "api":
            deploy_api(m, secrets_data)
        elif target == "site":
            deploy_site(m, secrets_data)
        print(f"===== {target} done =====\n")

    print("Deploy finished:", ", ".join(targets))
    return 0


if __name__ == "__main__":
    sys.exit(main())

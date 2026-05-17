"""Клиент Cloudflare DNS (REST API v4)."""

from __future__ import annotations

import logging
from typing import Any

import requests

logger = logging.getLogger(__name__)


class CloudflareDnsError(RuntimeError):
    pass


class CloudflareDnsService:
    BASE = "https://api.cloudflare.com/client/v4"

    def __init__(self, api_token: str):
        self._token = api_token.strip()

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }

    def get_zone_id_by_name(self, zone_name: str) -> str | None:
        zone = zone_name.strip().lower().rstrip(".")
        resp = requests.get(
            f"{self.BASE}/zones",
            params={"name": zone},
            headers=self._headers(),
            timeout=30,
        )
        data = resp.json()
        if resp.status_code >= 400:
            logger.warning("Cloudflare zones list failed: %s %s", resp.status_code, data)
            raise CloudflareDnsError(data.get("errors") or resp.text)
        if not data.get("success") or not data.get("result"):
            return None
        return str(data["result"][0]["id"])

    def create_a_record(
        self,
        *,
        zone_id: str,
        fqdn: str,
        ipv4: str,
        proxied: bool = True,
        ttl: int = 1,
    ) -> dict[str, Any]:
        payload = {
            "type": "A",
            "name": fqdn,
            "content": ipv4.strip(),
            "ttl": ttl,
            "proxied": proxied,
        }
        resp = requests.post(
            f"{self.BASE}/zones/{zone_id}/dns_records",
            json=payload,
            headers=self._headers(),
            timeout=30,
        )
        data = resp.json()
        if resp.status_code >= 400 or not data.get("success"):
            logger.warning("Cloudflare create record failed: %s %s", resp.status_code, data)
            raise CloudflareDnsError(str(data.get("errors") or data))
        return data["result"]

    def delete_dns_record(self, *, zone_id: str, record_id: str) -> bool:
        resp = requests.delete(
            f"{self.BASE}/zones/{zone_id}/dns_records/{record_id}",
            headers=self._headers(),
            timeout=30,
        )
        data = resp.json()
        if resp.status_code == 404:
            return False
        if resp.status_code >= 400 or not data.get("success"):
            logger.warning("Cloudflare delete record failed: %s %s", resp.status_code, data)
            raise CloudflareDnsError(str(data.get("errors") or data))
        return True

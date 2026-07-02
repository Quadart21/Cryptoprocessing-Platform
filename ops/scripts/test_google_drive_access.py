#!/usr/bin/env python3
"""Probe Google Drive folder access for backup service account JSON."""

from __future__ import annotations

import argparse
import json
import sys
from io import BytesIO
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseUpload

DRIVE_SCOPES = ("https://www.googleapis.com/auth/drive",)


def _run(action, label: str) -> bool:
    try:
        action()
        print(f"OK  {label}")
        return True
    except HttpError as exc:
        try:
            payload = json.loads(exc.content.decode("utf-8"))
            error = payload.get("error", {})
            message = error.get("message") or exc.reason
            reasons = [item.get("reason") for item in error.get("errors", [])]
        except Exception:
            message = exc.reason
            reasons = []
        status = exc.resp.status if exc.resp is not None else "?"
        print(f"ERR {label}: HTTP {status} {message} reasons={reasons}")
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", required=True, help="Path to service account JSON key")
    parser.add_argument("--folder-id", required=True, help="Google Drive folder ID")
    args = parser.parse_args()

    info = json.loads(Path(args.json).read_text(encoding="utf-8"))
    client_email = str(info.get("client_email") or "").strip()
    project_id = str(info.get("project_id") or "").strip()
    folder_id = args.folder_id.strip()

    print(f"project_id={project_id}")
    print(f"client_email={client_email}")
    print(f"folder_id={folder_id}")

    credentials = service_account.Credentials.from_service_account_info(info, scopes=DRIVE_SCOPES)
    service = build("drive", "v3", credentials=credentials, cache_discovery=False)

    if not _run(lambda: service.about().get(fields="user").execute(), "about.get"):
        return 1

    def get_folder() -> None:
        for supports_all_drives in (True, False):
            try:
                service.files().get(
                    fileId=folder_id,
                    fields="id,name,mimeType,trashed",
                    supportsAllDrives=supports_all_drives,
                ).execute()
                return
            except HttpError as exc:
                if exc.resp is not None and exc.resp.status == 404 and supports_all_drives:
                    continue
                raise

    if not _run(get_folder, "files.get(folder)"):
        return 1

    def list_permissions() -> None:
        for supports_all_drives in (True, False):
            try:
                result = (
                    service.permissions()
                    .list(
                        fileId=folder_id,
                        fields="permissions(emailAddress,role,type,deleted)",
                        supportsAllDrives=supports_all_drives,
                    )
                    .execute()
                )
                for permission in result.get("permissions", []):
                    if permission.get("deleted"):
                        continue
                    email = permission.get("emailAddress")
                    if not email:
                        continue
                    marker = " <-- service account" if str(email).lower() == client_email.lower() else ""
                    print(
                        f"    permission {email} role={permission.get('role')} type={permission.get('type')}{marker}"
                    )
                return
            except HttpError as exc:
                if exc.resp is not None and exc.resp.status == 404 and supports_all_drives:
                    continue
                raise

    print("PERMISSIONS")
    if not _run(list_permissions, "permissions.list"):
        return 1

    test_name = ".cryptoprocessing-cli-test.txt"
    created_id: str | None = None

    def create_file() -> None:
        nonlocal created_id
        body = {"name": test_name, "parents": [folder_id]}
        media = MediaIoBaseUpload(BytesIO(b"ok"), mimetype="text/plain", resumable=False)
        for supports_all_drives in (True, False):
            try:
                created = (
                    service.files()
                    .create(
                        body=body,
                        media_body=media,
                        fields="id",
                        supportsAllDrives=supports_all_drives,
                    )
                    .execute()
                )
                created_id = str(created["id"])
                return
            except HttpError as exc:
                if exc.resp is not None and exc.resp.status == 404 and supports_all_drives:
                    continue
                raise

    if not _run(create_file, "files.create(test)"):
        return 1

    if created_id:
        _run(
            lambda: service.files().delete(fileId=created_id, supportsAllDrives=True).execute(),
            "files.delete(test)",
        )

    print("DONE")
    return 0


if __name__ == "__main__":
    sys.exit(main())

from __future__ import annotations

import json
import logging
import re
import time
from io import BytesIO
from typing import Any

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_value, encrypt_value
from app.models.backup_settings import BackupSettings

logger = logging.getLogger(__name__)

DRIVE_SCOPES = ("https://www.googleapis.com/auth/drive",)
_DRIVE_FOLDER_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{10,}$")
_DRIVE_FOLDER_URL_RE = re.compile(
    r"drive\.google\.com/(?:drive/)?(?:u/\d+/)?folders/([a-zA-Z0-9_-]+)",
    re.IGNORECASE,
)


def normalize_google_drive_folder_id(raw: str | None) -> str | None:
    if raw is None:
        return None
    value = raw.strip()
    if not value:
        return None
    url_match = _DRIVE_FOLDER_URL_RE.search(value)
    if url_match:
        return url_match.group(1)
    if value.startswith("http://") or value.startswith("https://"):
        raise ValueError("Не удалось извлечь ID папки из ссылки Google Drive.")
    if not _DRIVE_FOLDER_ID_RE.fullmatch(value):
        raise ValueError("ID папки Google Drive должен содержать только буквы, цифры, _ и -.")
    return value


class GoogleDriveService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_settings(self) -> BackupSettings:
        row = await self.db.scalar(select(BackupSettings).where(BackupSettings.code == "default"))
        if row is None:
            row = BackupSettings(code="default")
            self.db.add(row)
            await self.db.flush()
        return row

    async def describe_credentials_for_admin(self) -> tuple[bool, str | None]:
        settings = await self.get_settings()
        raw = settings.google_service_account_json_encrypted
        if not raw:
            return False, None
        try:
            payload = json.loads(decrypt_value(raw))
        except (ValueError, json.JSONDecodeError):
            return True, None
        email = str(payload.get("client_email") or "").strip()
        return True, email or None

    async def set_service_account_json(self, raw_json: str | None) -> BackupSettings:
        settings = await self.get_settings()
        if raw_json is None:
            return settings
        stripped = raw_json.strip()
        if not stripped:
            settings.google_service_account_json_encrypted = None
        else:
            try:
                payload = json.loads(stripped)
            except json.JSONDecodeError as exc:
                raise ValueError("Service account JSON is invalid.") from exc
            if payload.get("type") != "service_account":
                raise ValueError("Expected Google service account JSON.")
            if not str(payload.get("client_email") or "").strip():
                raise ValueError("Service account JSON must include client_email.")
            settings.google_service_account_json_encrypted = encrypt_value(stripped)
        self.db.add(settings)
        await self.db.flush()
        return settings

    async def get_decrypted_credentials_json(self) -> str | None:
        settings = await self.get_settings()
        raw = settings.google_service_account_json_encrypted
        if not raw:
            return None
        return decrypt_value(raw)

    @staticmethod
    def _build_service(credentials_json: str):
        info = json.loads(credentials_json)
        credentials = service_account.Credentials.from_service_account_info(info, scopes=DRIVE_SCOPES)
        service = build("drive", "v3", credentials=credentials, cache_discovery=False)
        client_email = str(info.get("client_email") or "").strip()
        return service, client_email

    @staticmethod
    def _drive_execute_with_shared_drive_fallback(action):
        last_exc: HttpError | None = None
        for supports_all_drives in (False, True):
            try:
                return action(supports_all_drives)
            except HttpError as exc:
                last_exc = exc
                if exc.resp is not None and exc.resp.status == 404 and not supports_all_drives:
                    continue
                raise
        if last_exc is not None:
            raise last_exc
        raise RuntimeError("Google Drive request failed.")

    def upload_file(self, credentials_json: str, folder_id: str, file_path: str, file_name: str) -> tuple[str, str]:
        service, client_email = self._build_service(credentials_json)
        metadata = {"name": file_name, "parents": [folder_id]}
        media = MediaFileUpload(file_path, resumable=True)

        def _create(supports_all_drives: bool) -> dict[str, Any]:
            return (
                service.files()
                .create(
                    body=metadata,
                    media_body=media,
                    fields="id, webViewLink",
                    supportsAllDrives=supports_all_drives,
                )
                .execute()
            )

        try:
            created = self._drive_execute_with_shared_drive_fallback(_create)
        except HttpError as exc:
            raise ValueError(
                self._http_error_message(exc, client_email=client_email, folder_id=folder_id),
            ) from exc
        return str(created["id"]), str(created.get("webViewLink") or "")

    def test_folder_access(
        self,
        credentials_json: str,
        folder_id: str,
    ) -> tuple[bool, str, str | None, str | None]:
        service, client_email = self._build_service(credentials_json)
        folder_name = self._try_read_folder_name(service, folder_id)

        test_name = f".cryptoprocessing-access-test-{int(time.time())}.txt"
        test_file_id: str | None = None

        def _create(supports_all_drives: bool) -> dict[str, Any]:
            return (
                service.files()
                .create(
                    body={"name": test_name, "parents": [folder_id]},
                    media_body=MediaIoBaseUpload(BytesIO(b"ok"), mimetype="text/plain", resumable=False),
                    fields="id",
                    supportsAllDrives=supports_all_drives,
                )
                .execute()
            )

        try:
            created = self._drive_execute_with_shared_drive_fallback(_create)
            test_file_id = str(created["id"])
        except HttpError as exc:
            message = self._http_error_message(exc, client_email=client_email, folder_id=folder_id)
            return False, message, folder_name, client_email or None

        if test_file_id:
            self._try_delete_file(service, test_file_id)

        if folder_name:
            return True, f"Доступ подтверждён: запись в папку «{folder_name}» работает.", folder_name, client_email or None
        return (
            True,
            "Доступ подтверждён: service account может создавать файлы в указанной папке.",
            None,
            client_email or None,
        )

    def _try_read_folder_name(self, service, folder_id: str) -> str | None:
        def _get(supports_all_drives: bool) -> dict[str, Any]:
            return (
                service.files()
                .get(
                    fileId=folder_id,
                    fields="id, name, mimeType, trashed",
                    supportsAllDrives=supports_all_drives,
                )
                .execute()
            )

        try:
            folder = self._drive_execute_with_shared_drive_fallback(_get)
        except HttpError:
            return None
        if folder.get("trashed"):
            return None
        if folder.get("mimeType") != "application/vnd.google-apps.folder":
            return None
        return str(folder.get("name") or "") or None

    @staticmethod
    def _try_delete_file(service, file_id: str) -> None:
        def _delete(supports_all_drives: bool) -> None:
            service.files().delete(fileId=file_id, supportsAllDrives=supports_all_drives).execute()

        try:
            GoogleDriveService._drive_execute_with_shared_drive_fallback(_delete)
        except HttpError:
            logger.warning("Failed to delete Google Drive access test file %s", file_id)

    @staticmethod
    def _http_error_message(
        exc: HttpError,
        *,
        client_email: str = "",
        folder_id: str = "",
    ) -> str:
        try:
            payload = json.loads(exc.content.decode("utf-8"))
            message = str(payload.get("error", {}).get("message") or exc.reason or "Google Drive error")
        except Exception:
            message = str(exc.reason or "Google Drive error")

        lowered = message.lower()
        if "has not been used in project" in lowered or "drive.googleapis.com" in lowered and "disabled" in lowered:
            project_hint = ""
            if "project " in lowered:
                tail = message.split("project ", 1)[1]
                project_id = tail.split(" ", 1)[0].strip().rstrip(".,")
                if project_id:
                    project_hint = (
                        " Включите API: "
                        f"https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project={project_id}"
                    )
            return (
                "Google Drive API не включён в Google Cloud проекте service account."
                f"{project_hint} После включения подождите 2–5 минут и повторите."
            )
        if exc.resp is not None and exc.resp.status == 404:
            email_hint = f" Текущий service account: {client_email}." if client_email else ""
            folder_hint = f" ID папки: {folder_id}." if folder_id else ""
            return (
                "Google Drive не даёт записать файл в эту папку."
                f"{email_hint}{folder_hint} "
                "Проверьте, что в «Поделиться» указан именно этот email service account с ролью «Редактор». "
                "Если уже расшарено — удалите доступ, подождите минуту, добавьте снова или создайте новую папку."
            )
        return message

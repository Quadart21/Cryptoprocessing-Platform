from __future__ import annotations

import json
import logging
import re

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload
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

    def upload_file(self, credentials_json: str, folder_id: str, file_path: str, file_name: str) -> tuple[str, str]:
        info = json.loads(credentials_json)
        credentials = service_account.Credentials.from_service_account_info(info, scopes=DRIVE_SCOPES)
        service = build("drive", "v3", credentials=credentials, cache_discovery=False)
        metadata = {"name": file_name, "parents": [folder_id]}
        media = MediaFileUpload(file_path, resumable=True)
        created = (
            service.files()
            .create(
                body=metadata,
                media_body=media,
                fields="id, webViewLink",
                supportsAllDrives=True,
            )
            .execute()
        )
        return str(created["id"]), str(created.get("webViewLink") or "")

    def test_folder_access(self, credentials_json: str, folder_id: str) -> tuple[bool, str, str | None]:
        info = json.loads(credentials_json)
        credentials = service_account.Credentials.from_service_account_info(info, scopes=DRIVE_SCOPES)
        service = build("drive", "v3", credentials=credentials, cache_discovery=False)
        try:
            folder = (
                service.files()
                .get(
                    fileId=folder_id,
                    fields="id, name, mimeType, trashed",
                    supportsAllDrives=True,
                )
                .execute()
            )
        except HttpError as exc:
            message = self._http_error_message(exc)
            return False, message, None
        if folder.get("trashed"):
            return False, "Папка Google Drive находится в корзине.", None
        if folder.get("mimeType") != "application/vnd.google-apps.folder":
            return False, "Указанный ID не является папкой Google Drive.", None
        return True, "Доступ к папке подтверждён.", str(folder.get("name") or "")

    @staticmethod
    def _http_error_message(exc: HttpError) -> str:
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
                        f" Включите API: https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project={project_id}"
                    )
            return (
                "Google Drive API не включён в Google Cloud проекте service account."
                f"{project_hint} После включения подождите 2–5 минут и повторите."
            )
        if exc.resp is not None and exc.resp.status == 404:
            return (
                "Папка не найдена или service account не имеет к ней доступа. "
                "Укажите только ID папки (не полную ссылку), расшарьте папку на email service account "
                "из JSON (роль «Редактор») и повторите проверку."
            )
        return message

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
_DRIVE_ROLE_LABELS = {
    "owner": "Владелец",
    "organizer": "Организатор",
    "fileOrganizer": "Организатор файлов",
    "writer": "Редактор",
    "commenter": "Комментатор",
    "reader": "Читатель",
}
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
        # Folders live on the user's Drive, not on the service account's Drive — try
        # shared-drive mode first (supportsAllDrives=True), then fall back.
        last_exc: HttpError | None = None
        for supports_all_drives in (True, False):
            try:
                return action(supports_all_drives)
            except HttpError as exc:
                last_exc = exc
                if exc.resp is not None and exc.resp.status == 404 and supports_all_drives:
                    continue
                raise
        if last_exc is not None:
            raise last_exc
        raise RuntimeError("Google Drive request failed.")

    @staticmethod
    def _verify_drive_api(service, *, client_email: str = "", project_id: str = "") -> str | None:
        try:
            service.about().get(fields="user").execute()
        except HttpError as exc:
            return GoogleDriveService._http_error_message(
                exc,
                client_email=client_email,
                project_id=project_id,
            )
        return None

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
        project_id = str(json.loads(credentials_json).get("project_id") or "").strip()
        api_error = self._verify_drive_api(
            service,
            client_email=client_email,
            project_id=project_id,
        )
        if api_error:
            return False, api_error, None, client_email or None

        folder_name, probe_error = self._probe_folder(
            service,
            folder_id,
            client_email=client_email,
            project_id=project_id,
        )
        if probe_error:
            return False, probe_error, None, client_email or None

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
            role_hint = self._describe_service_account_folder_role(service, folder_id, client_email)
            message = self._http_error_message(
                exc,
                client_email=client_email,
                folder_id=folder_id,
                project_id=project_id,
                folder_role_hint=role_hint,
            )
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

    def _probe_folder(
        self,
        service,
        folder_id: str,
        *,
        client_email: str = "",
        project_id: str = "",
    ) -> tuple[str | None, str | None]:
        def _get(supports_all_drives: bool) -> dict[str, Any]:
            return (
                service.files()
                .get(
                    fileId=folder_id,
                    fields="id, name, mimeType, trashed, shortcutDetails",
                    supportsAllDrives=supports_all_drives,
                )
                .execute()
            )

        try:
            folder = self._drive_execute_with_shared_drive_fallback(_get)
        except HttpError as exc:
            return None, self._http_error_message(
                exc,
                client_email=client_email,
                folder_id=folder_id,
                project_id=project_id,
            )

        if folder.get("trashed"):
            return None, "Папка находится в корзине Google Drive. Восстановите её и повторите проверку."

        mime_type = str(folder.get("mimeType") or "")
        if mime_type == "application/vnd.google-apps.shortcut":
            target_id = str(folder.get("shortcutDetails", {}).get("targetId") or "").strip()
            if target_id:
                return None, (
                    "Указан ярлык Google Drive, а не сама папка. "
                    f"Используйте ID целевой папки: {target_id}."
                )
            return None, "Указан ярлык Google Drive, а не сама папка."

        if mime_type != "application/vnd.google-apps.folder":
            item_name = str(folder.get("name") or "файл")
            return None, f"Указанный ID относится к файлу «{item_name}», а не к папке."

        return str(folder.get("name") or "") or None, None

    def _try_read_folder_name(self, service, folder_id: str) -> str | None:
        folder_name, probe_error = self._probe_folder(service, folder_id)
        if probe_error:
            return None
        return folder_name

    @staticmethod
    def _try_delete_file(service, file_id: str) -> None:
        def _delete(supports_all_drives: bool) -> None:
            service.files().delete(fileId=file_id, supportsAllDrives=supports_all_drives).execute()

        try:
            GoogleDriveService._drive_execute_with_shared_drive_fallback(_delete)
        except HttpError:
            logger.warning("Failed to delete Google Drive access test file %s", file_id)

    @staticmethod
    def _describe_service_account_folder_role(
        service,
        folder_id: str,
        client_email: str,
    ) -> str | None:
        if not client_email:
            return None

        def _list(supports_all_drives: bool) -> dict[str, Any]:
            return (
                service.permissions()
                .list(
                    fileId=folder_id,
                    fields="permissions(emailAddress,role,type,deleted)",
                    supportsAllDrives=supports_all_drives,
                )
                .execute()
            )

        try:
            result = GoogleDriveService._drive_execute_with_shared_drive_fallback(_list)
        except HttpError:
            return None

        email_lower = client_email.lower()
        for permission in result.get("permissions", []):
            if permission.get("deleted"):
                continue
            perm_email = str(permission.get("emailAddress") or "").lower()
            if perm_email == email_lower:
                role = str(permission.get("role") or "")
                return _DRIVE_ROLE_LABELS.get(role, role or "неизвестно")
        return "не найден в списке прав папки"

    @staticmethod
    def _extract_google_error_details(exc: HttpError) -> tuple[str, list[str]]:
        try:
            payload = json.loads(exc.content.decode("utf-8"))
            error = payload.get("error", {})
            message = str(error.get("message") or exc.reason or "Google Drive error")
            reasons = [
                str(item.get("reason") or "")
                for item in error.get("errors", [])
                if item.get("reason")
            ]
            return message, reasons
        except Exception:
            return str(exc.reason or "Google Drive error"), []

    @staticmethod
    def _http_error_message(
        exc: HttpError,
        *,
        client_email: str = "",
        folder_id: str = "",
        project_id: str = "",
        folder_role_hint: str | None = None,
    ) -> str:
        message, reasons = GoogleDriveService._extract_google_error_details(exc)
        lowered = message.lower()
        reason_text = ", ".join(reasons) if reasons else ""
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
        if (
            (exc.resp is not None and exc.resp.status == 404)
            or "file not found" in lowered
            or "not found" in lowered and folder_id.lower() in lowered
        ):
            email_hint = f" Service account: {client_email}." if client_email else ""
            folder_hint = f" ID папки: {folder_id}." if folder_id else ""
            project_hint = f" GCP-проект: {project_id}." if project_id else ""
            return (
                "Google Drive не видит эту папку для service account."
                f"{email_hint}{folder_hint}{project_hint} "
                "Добавьте email service account в «Поделиться» с ролью «Редактор». "
                "Общий доступ по ссылке service account не использует — нужен именно email в списке пользователей. "
                "Если SA уже в списке — удалите обе записи, подождите 1–2 минуты, добавьте одну с ролью «Редактор», "
                "или создайте новую папку и расшарьте только на quadart21@gmail.com и service account."
            )
        if exc.resp is not None and exc.resp.status in {403, 401}:
            email_hint = f" Service account: {client_email}." if client_email else ""
            role_hint = ""
            if folder_role_hint:
                role_hint = f" Роль SA в папке по API: «{folder_role_hint}»."
            quota_hint = ""
            if "storagequotaexceeded" in lowered or "storageQuotaExceeded" in reasons:
                quota_hint = (
                    " У service account нет своего диска — папка должна быть расшарена как «Редактор», "
                    "тогда квота берётся у владельца папки. Проверьте, что на drive.google.com у "
                    "quadart21@gmail.com есть свободное место."
                )
            elif folder_role_hint == "Читатель":
                role_hint = (
                    f"{role_hint} Смените роль на «Редактор» в «Поделиться» и подождите 1–2 минуты."
                )
            elif folder_role_hint == "не найден в списке прав папки":
                role_hint = (
                    f"{role_hint} В Google Drive → «Поделиться» добавьте email SA с ролью «Редактор»."
                )
            detail_hint = f" Код Google: {reason_text}." if reason_text else ""
            return (
                "Недостаточно прав для записи в папку Google Drive."
                f"{email_hint}{role_hint}{quota_hint}{detail_hint} "
                "Нужна роль «Редактор» (writer), не «Читатель». "
                "GCP IAM (Owner) не заменяет шаринг папки на drive.google.com."
            )
        if reason_text:
            return f"{message} ({reason_text})"
        return message

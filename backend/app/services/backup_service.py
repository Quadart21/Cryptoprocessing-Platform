from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import tarfile
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.backup_job import BackupJob
from app.models.backup_settings import BackupSettings
from app.schemas.backup import BackupSettingsResponse
from app.services.google_drive_service import GoogleDriveService, normalize_google_drive_folder_id

logger = logging.getLogger(__name__)

BACKEND_EXCLUDE_DIRS = {
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".git",
    ".mypy_cache",
    ".ruff_cache",
}
FRONTEND_EXCLUDE_DIRS = {"node_modules", ".git", ".vite"}
VALID_SCOPES = {"full", "database", "backend", "frontend"}
SCHEDULE_FREQUENCIES = {"daily", "weekly", "every_6h", "every_12h"}


class BackupService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.drive = GoogleDriveService(db)

    async def get_settings(self) -> BackupSettings:
        return await self.drive.get_settings()

    async def get_settings_view(self) -> BackupSettingsResponse:
        row = await self.get_settings()
        oauth_connected, oauth_email = await self.drive.describe_oauth_for_admin()
        sa_configured, sa_email = await self._describe_service_account_for_admin()
        auth_mode: str | None = None
        credentials_email: str | None = None
        if oauth_connected:
            auth_mode = "oauth"
            credentials_email = oauth_email
        elif sa_configured:
            auth_mode = "service_account"
            credentials_email = sa_email
        return BackupSettingsResponse(
            google_drive_folder_id=row.google_drive_folder_id,
            google_credentials_configured=oauth_connected or sa_configured,
            google_credentials_email=credentials_email,
            google_oauth_configured=self.drive.oauth_configured(),
            google_oauth_connected=oauth_connected,
            google_oauth_user_email=oauth_email,
            google_drive_auth_mode=auth_mode,  # type: ignore[arg-type]
            upload_to_drive_enabled=row.upload_to_drive_enabled,
            schedule_enabled=row.schedule_enabled,
            schedule_frequency=row.schedule_frequency,  # type: ignore[arg-type]
            schedule_hour_utc=row.schedule_hour_utc,
            schedule_weekday=row.schedule_weekday,
            schedule_scopes=self._parse_scopes(row.schedule_scopes_json),
            local_retention_count=row.local_retention_count,
            last_scheduled_run_at=row.last_scheduled_run_at,
        )

    async def _describe_service_account_for_admin(self) -> tuple[bool, str | None]:
        row = await self.get_settings()
        raw = row.google_service_account_json_encrypted
        if not raw:
            return False, None
        from app.core.security import decrypt_value

        try:
            payload = json.loads(decrypt_value(raw))
        except (ValueError, json.JSONDecodeError):
            return True, None
        email = str(payload.get("client_email") or "").strip()
        return True, email or None

    async def update_settings(
        self,
        *,
        google_drive_folder_id: str | None = None,
        google_service_account_json: str | None = None,
        upload_to_drive_enabled: bool | None = None,
        schedule_enabled: bool | None = None,
        schedule_frequency: str | None = None,
        schedule_hour_utc: int | None = None,
        schedule_weekday: int | None = None,
        schedule_scopes: list[str] | None = None,
        local_retention_count: int | None = None,
        clear_google_credentials: bool = False,
    ) -> BackupSettingsResponse:
        row = await self.get_settings()
        if google_drive_folder_id is not None:
            if (google_drive_folder_id or "").strip() == "":
                row.google_drive_folder_id = None
            else:
                row.google_drive_folder_id = normalize_google_drive_folder_id(google_drive_folder_id)
        if google_service_account_json is not None or clear_google_credentials:
            if clear_google_credentials or (google_service_account_json or "").strip() == "":
                row.google_service_account_json_encrypted = None
            elif google_service_account_json is not None:
                await self.drive.set_service_account_json(google_service_account_json)
                row = await self.get_settings()
        if upload_to_drive_enabled is not None:
            row.upload_to_drive_enabled = upload_to_drive_enabled
        if schedule_enabled is not None:
            row.schedule_enabled = schedule_enabled
        if schedule_frequency is not None:
            if schedule_frequency not in SCHEDULE_FREQUENCIES:
                raise ValueError("Unsupported schedule frequency.")
            row.schedule_frequency = schedule_frequency
        if schedule_hour_utc is not None:
            row.schedule_hour_utc = schedule_hour_utc
        if schedule_weekday is not None:
            row.schedule_weekday = schedule_weekday
        if schedule_scopes is not None:
            normalized = self._normalize_scopes(schedule_scopes)
            row.schedule_scopes_json = json.dumps(normalized)
        if local_retention_count is not None:
            row.local_retention_count = local_retention_count
        self.db.add(row)
        await self.db.flush()
        return await self.get_settings_view()

    async def list_jobs(self, *, limit: int = 50) -> list[BackupJob]:
        stmt = select(BackupJob).order_by(BackupJob.created_at.desc()).limit(limit)
        return list((await self.db.scalars(stmt)).all())

    async def get_job(self, job_id: str) -> BackupJob | None:
        return await self.db.get(BackupJob, job_id)

    async def create_job(
        self,
        *,
        scope: str,
        trigger: str = "manual",
        initiated_by_user_id: str | None = None,
    ) -> BackupJob:
        normalized_scope = self._normalize_scope(scope)
        job = BackupJob(
            scope=normalized_scope,
            trigger=trigger,
            status="pending",
            initiated_by_user_id=initiated_by_user_id,
        )
        self.db.add(job)
        await self.db.flush()
        return job

    async def run_job(self, job_id: str) -> BackupJob:
        job = await self.get_job(job_id)
        if job is None:
            raise ValueError("Backup job not found.")
        if job.status not in {"pending", "failed"}:
            return job

        job.status = "running"
        job.started_at = datetime.now(timezone.utc)
        job.error_message = None
        self.db.add(job)
        await self.db.commit()

        settings_row = await self.get_settings()
        work_root = settings.resolved_backup_work_dir
        work_root.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        archive_name = f"{job.scope}_{timestamp}.tar.gz"
        archive_path = work_root / archive_name

        try:
            with tempfile.TemporaryDirectory(prefix="cp-backup-") as temp_dir:
                staging = Path(temp_dir)
                self._build_archive(staging, archive_path, job.scope)
            size = archive_path.stat().st_size
            job.file_name = archive_name
            job.file_size_bytes = size
            job.local_path = str(archive_path)

            if settings_row.upload_to_drive_enabled:
                folder_id = (settings_row.google_drive_folder_id or "").strip()
                oauth_connected, _oauth_email = await self.drive.describe_oauth_for_admin()
                credentials_json = await self.drive.get_decrypted_credentials_json()
                if not folder_id:
                    raise ValueError("Google Drive folder ID is not configured.")
                if not oauth_connected and not credentials_json:
                    raise ValueError(
                        "Google Drive is not configured: connect OAuth account or upload service account JSON."
                    )
                try:
                    file_id, web_url = await self.drive.upload_file_resolved(
                        folder_id,
                        str(archive_path),
                        archive_name,
                    )
                except Exception as exc:
                    job.status = "failed"
                    job.error_message = f"Archive created locally, Google Drive upload failed: {exc}"
                    job.completed_at = datetime.now(timezone.utc)
                    self.db.add(job)
                    await self.db.commit()
                    await self._apply_local_retention(settings_row.local_retention_count)
                    return job
                job.google_drive_file_id = file_id
                job.google_drive_url = web_url or None

            job.status = "completed"
            job.completed_at = datetime.now(timezone.utc)
            self.db.add(job)
            await self.db.commit()
            await self._apply_local_retention(settings_row.local_retention_count)
            return job
        except Exception as exc:
            logger.exception("Backup job %s failed", job_id)
            job.status = "failed"
            job.error_message = str(exc)
            job.completed_at = datetime.now(timezone.utc)
            if archive_path.exists() and not job.local_path:
                try:
                    archive_path.unlink()
                except OSError:
                    pass
            if not job.local_path:
                job.file_name = archive_name
            self.db.add(job)
            await self.db.commit()
            return job

    async def test_drive_connection(
        self,
        *,
        google_drive_folder_id: str | None = None,
    ) -> tuple[bool, str, str | None, str | None]:
        row = await self.get_settings()
        folder_id = (google_drive_folder_id if google_drive_folder_id is not None else row.google_drive_folder_id or "").strip()
        if google_drive_folder_id is not None and folder_id:
            folder_id = normalize_google_drive_folder_id(folder_id) or ""
        if not folder_id:
            return False, "Укажите ID папки Google Drive.", None, None
        oauth_connected, _oauth_email = await self.drive.describe_oauth_for_admin()
        credentials_json = await self.drive.get_decrypted_credentials_json()
        if not oauth_connected and not credentials_json:
            return False, "Подключите Google аккаунт (OAuth) или загрузите JSON service account.", None, None
        return await self.drive.test_folder_access_resolved(folder_id)

    async def run_due_scheduled_backups(self) -> int:
        row = await self.get_settings()
        now = datetime.now(timezone.utc)
        if not self._is_schedule_due(row, now):
            return 0

        scopes = self._parse_scopes(row.schedule_scopes_json)
        if not scopes:
            scopes = ["full"]

        created = 0
        for scope in scopes:
            job = await self.create_job(scope=scope, trigger="scheduled")
            await self.db.commit()
            await self.run_job(job.id)
            created += 1

        row.last_scheduled_run_at = now
        self.db.add(row)
        await self.db.commit()
        return created

    def _build_archive(self, staging: Path, archive_path: Path, scope: str) -> None:
        if scope in {"full", "database"}:
            self._dump_database(staging / "database.dump")
        if scope in {"full", "backend"}:
            self._copy_tree(
                settings.resolved_backup_backend_dir,
                staging / "backend",
                BACKEND_EXCLUDE_DIRS,
            )
            brand_dir = settings.resolved_brand_uploads_dir
            if brand_dir.exists():
                self._copy_tree(brand_dir, staging / "brand_uploads", set())
        if scope in {"full", "frontend"}:
            self._copy_tree(
                settings.resolved_backup_frontend_dir,
                staging / "frontend",
                FRONTEND_EXCLUDE_DIRS,
            )

        with tarfile.open(archive_path, "w:gz") as tar:
            for item in staging.iterdir():
                tar.add(item, arcname=item.name)

    def _dump_database(self, output_path: Path) -> None:
        env = os.environ.copy()
        env["PGPASSWORD"] = settings.postgres_password
        # Tenant tables use FORCE ROW LEVEL SECURITY; pg_dump must bypass policies via
        # the same superadmin session flag the app uses during schema sync.
        env["PGOPTIONS"] = "-c app.is_superadmin=on"
        cmd = [
            settings.pg_dump_bin,
            "-h",
            settings.postgres_host,
            "-p",
            str(settings.postgres_port),
            "-U",
            settings.postgres_user,
            "-d",
            settings.postgres_db,
            "-F",
            "c",
            "-f",
            str(output_path),
        ]
        result = subprocess.run(cmd, env=env, capture_output=True, text=True, check=False)
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "pg_dump failed").strip()
            raise RuntimeError(f"Database dump failed: {detail}")

    @staticmethod
    def _copy_tree(source: Path, destination: Path, exclude_dir_names: set[str]) -> None:
        if not source.exists():
            raise FileNotFoundError(f"Backup source not found: {source}")
        destination.mkdir(parents=True, exist_ok=True)

        def _ignore(_dir: str, names: list[str]) -> set[str]:
            ignored: set[str] = set()
            for name in names:
                if name in exclude_dir_names:
                    ignored.add(name)
            return ignored

        for item in source.iterdir():
            target = destination / item.name
            if item.is_dir():
                shutil.copytree(item, target, ignore=_ignore, dirs_exist_ok=True)
            else:
                shutil.copy2(item, target)

    async def _apply_local_retention(self, keep_count: int) -> None:
        jobs = await self.list_jobs(limit=max(keep_count * 4, 20))
        completed = [job for job in jobs if job.status == "completed" and job.local_path]
        for job in completed[keep_count:]:
            path = Path(job.local_path or "")
            if path.exists():
                try:
                    path.unlink()
                except OSError:
                    logger.warning("Failed to delete old backup file %s", path)
            job.local_path = None
            self.db.add(job)
        await self.db.commit()

    @staticmethod
    def _normalize_scope(scope: str) -> str:
        normalized = scope.strip().lower()
        if normalized not in VALID_SCOPES:
            raise ValueError("Unsupported backup scope.")
        return normalized

    @staticmethod
    def _normalize_scopes(scopes: list[str]) -> list[str]:
        normalized: list[str] = []
        for scope in scopes:
            item = BackupService._normalize_scope(scope)
            if item not in normalized:
                normalized.append(item)
        if not normalized:
            raise ValueError("Select at least one backup scope.")
        return normalized

    @staticmethod
    def _parse_scopes(raw: str) -> list[str]:
        try:
            parsed = json.loads(raw or "[]")
        except json.JSONDecodeError:
            return ["full"]
        if not isinstance(parsed, list):
            return ["full"]
        result: list[str] = []
        for item in parsed:
            if isinstance(item, str) and item in VALID_SCOPES and item not in result:
                result.append(item)
        return result or ["full"]

    @staticmethod
    def _is_schedule_due(row: BackupSettings, now: datetime) -> bool:
        if not row.schedule_enabled:
            return False
        last = row.last_scheduled_run_at
        frequency = row.schedule_frequency

        if frequency == "every_6h":
            if last and now - last < timedelta(hours=6):
                return False
            return True
        if frequency == "every_12h":
            if last and now - last < timedelta(hours=12):
                return False
            return True
        if frequency == "weekly":
            if now.weekday() != row.schedule_weekday:
                return False
            if now.hour != row.schedule_hour_utc or now.minute >= 15:
                return False
            if last and last.date() == now.date():
                return False
            return True

        # daily
        if now.hour != row.schedule_hour_utc or now.minute >= 15:
            return False
        if last and last.date() == now.date():
            return False
        return True

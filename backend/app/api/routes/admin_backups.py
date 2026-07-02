from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_superadmin
from app.models.user import User
from app.schemas.backup import (
    BackupDriveTestRequest,
    BackupDriveTestResponse,
    BackupGoogleOAuthStartResponse,
    BackupJobCreateRequest,
    BackupJobResponse,
    BackupSettingsResponse,
    BackupSettingsUpdateRequest,
)
from app.services.backup_service import BackupService
from app.services.google_drive_service import GoogleDriveService

router = APIRouter()


def _job_response(job) -> BackupJobResponse:
    return BackupJobResponse(
        id=job.id,
        scope=job.scope,
        trigger=job.trigger,
        status=job.status,
        file_name=job.file_name,
        file_size_bytes=job.file_size_bytes,
        google_drive_file_id=job.google_drive_file_id,
        google_drive_url=job.google_drive_url,
        error_message=job.error_message,
        started_at=job.started_at,
        completed_at=job.completed_at,
        created_at=job.created_at,
    )


@router.get("/settings", response_model=BackupSettingsResponse)
async def get_backup_settings(
    _: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> BackupSettingsResponse:
    return await BackupService(db).get_settings_view()


@router.put("/settings", response_model=BackupSettingsResponse)
async def update_backup_settings(
    body: BackupSettingsUpdateRequest,
    _: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> BackupSettingsResponse:
    svc = BackupService(db)
    try:
        response = await svc.update_settings(
            google_drive_folder_id=body.google_drive_folder_id,
            google_service_account_json=body.google_service_account_json,
            upload_to_drive_enabled=body.upload_to_drive_enabled,
            schedule_enabled=body.schedule_enabled,
            schedule_frequency=body.schedule_frequency,
            schedule_hour_utc=body.schedule_hour_utc,
            schedule_weekday=body.schedule_weekday,
            schedule_scopes=body.schedule_scopes,
            local_retention_count=body.local_retention_count,
            clear_google_credentials=body.google_service_account_json == "",
        )
        await db.commit()
        return response
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/settings/test-drive", response_model=BackupDriveTestResponse)
async def test_backup_drive_settings(
    body: BackupDriveTestRequest | None = None,
    _: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> BackupDriveTestResponse:
    folder_override = body.google_drive_folder_id if body is not None else None
    ok, message, folder_name, service_account_email = await BackupService(db).test_drive_connection(
        google_drive_folder_id=folder_override,
    )
    return BackupDriveTestResponse(
        ok=ok,
        message=message,
        folder_name=folder_name,
        service_account_email=service_account_email,
    )


@router.get("/settings/google-oauth/start", response_model=BackupGoogleOAuthStartResponse)
async def start_google_oauth_for_backups(
    _: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> BackupGoogleOAuthStartResponse:
    drive = GoogleDriveService(db)
    if not drive.oauth_configured():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="На сервере не заданы GOOGLE_OAUTH_CLIENT_ID и GOOGLE_OAUTH_CLIENT_SECRET.",
        )
    state = drive.create_oauth_state_token()
    return BackupGoogleOAuthStartResponse(authorization_url=drive.build_oauth_authorization_url(state))


@router.get("/settings/google-oauth/callback")
async def google_oauth_callback_for_backups(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> HTMLResponse:
    if error:
        return HTMLResponse(
            _oauth_callback_html(success=False, message=f"Google OAuth отклонён: {error}"),
            status_code=400,
        )
    if not code or not state:
        return HTMLResponse(
            _oauth_callback_html(success=False, message="Не хватает параметров code/state."),
            status_code=400,
        )
    drive = GoogleDriveService(db)
    if not drive.verify_oauth_state_token(state):
        return HTMLResponse(
            _oauth_callback_html(success=False, message="Недействительный OAuth state."),
            status_code=400,
        )
    try:
        refresh_token, email = drive.exchange_oauth_code(code)
        await drive.save_oauth_refresh_token(refresh_token, email)
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        return HTMLResponse(_oauth_callback_html(success=False, message=str(exc)), status_code=400)
    return HTMLResponse(
        _oauth_callback_html(
            success=True,
            message=f"Google Drive подключён: {email}. Можно закрыть окно и нажать «Проверить доступ».",
        )
    )


@router.post("/settings/google-oauth/disconnect", response_model=BackupSettingsResponse)
async def disconnect_google_oauth_for_backups(
    _: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> BackupSettingsResponse:
    drive = GoogleDriveService(db)
    await drive.clear_oauth_credentials()
    await db.commit()
    return await BackupService(db).get_settings_view()


def _oauth_callback_html(*, success: bool, message: str) -> str:
    title = "Google Drive подключён" if success else "Ошибка Google Drive"
    escaped = (
        message.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
    return f"""<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><title>{title}</title></head>
<body style="font-family: sans-serif; padding: 2rem;">
  <h2>{title}</h2>
  <p>{escaped}</p>
  <script>
    if (window.opener) {{
      window.opener.postMessage({{"type":"google-drive-oauth","ok":{str(success).lower()}}}, "*");
    }}
  </script>
</body>
</html>"""


@router.get("/jobs", response_model=list[BackupJobResponse])
async def list_backup_jobs(
    limit: int = Query(default=50, le=200),
    _: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> list[BackupJobResponse]:
    jobs = await BackupService(db).list_jobs(limit=limit)
    return [_job_response(job) for job in jobs]


@router.post("/jobs", response_model=BackupJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_backup_job(
    body: BackupJobCreateRequest,
    admin_user: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> BackupJobResponse:
    svc = BackupService(db)
    try:
        job = await svc.create_job(
            scope=body.scope,
            trigger="manual",
            initiated_by_user_id=admin_user.id,
        )
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    from app.tasks.backups import run_backup_job

    run_backup_job.delay(job.id)
    return _job_response(job)

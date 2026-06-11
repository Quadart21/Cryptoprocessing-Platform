from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_superadmin
from app.models.user import User
from app.schemas.backup import (
    BackupDriveTestResponse,
    BackupJobCreateRequest,
    BackupJobResponse,
    BackupSettingsResponse,
    BackupSettingsUpdateRequest,
)
from app.services.backup_service import BackupService

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
    _: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> BackupDriveTestResponse:
    ok, message, folder_name, service_account_email = await BackupService(db).test_drive_connection()
    return BackupDriveTestResponse(
        ok=ok,
        message=message,
        folder_name=folder_name,
        service_account_email=service_account_email,
    )


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

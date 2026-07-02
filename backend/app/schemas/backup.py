from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

BackupScope = Literal["full", "database", "backend", "frontend"]
BackupTrigger = Literal["manual", "scheduled"]
BackupStatus = Literal["pending", "running", "completed", "failed"]
BackupScheduleFrequency = Literal["daily", "weekly", "every_6h", "every_12h"]
BackupDriveAuthMode = Literal["oauth", "service_account"]


class BackupSettingsResponse(BaseModel):
    google_drive_folder_id: str | None = None
    google_credentials_configured: bool = False
    google_credentials_email: str | None = None
    google_oauth_configured: bool = False
    google_oauth_connected: bool = False
    google_oauth_user_email: str | None = None
    google_drive_auth_mode: BackupDriveAuthMode | None = None
    upload_to_drive_enabled: bool = True
    schedule_enabled: bool = False
    schedule_frequency: BackupScheduleFrequency = "daily"
    schedule_hour_utc: int = Field(default=3, ge=0, le=23)
    schedule_weekday: int = Field(default=0, ge=0, le=6)
    schedule_scopes: list[BackupScope] = Field(default_factory=lambda: ["full"])
    local_retention_count: int = Field(default=5, ge=1, le=100)
    last_scheduled_run_at: datetime | None = None


class BackupSettingsUpdateRequest(BaseModel):
    google_drive_folder_id: str | None = None
    google_service_account_json: str | None = None
    upload_to_drive_enabled: bool | None = None
    schedule_enabled: bool | None = None
    schedule_frequency: BackupScheduleFrequency | None = None
    schedule_hour_utc: int | None = Field(default=None, ge=0, le=23)
    schedule_weekday: int | None = Field(default=None, ge=0, le=6)
    schedule_scopes: list[BackupScope] | None = None
    local_retention_count: int | None = Field(default=None, ge=1, le=100)


class BackupJobCreateRequest(BaseModel):
    scope: BackupScope


class BackupJobResponse(BaseModel):
    id: str
    scope: BackupScope
    trigger: BackupTrigger
    status: BackupStatus
    file_name: str | None = None
    file_size_bytes: int | None = None
    google_drive_file_id: str | None = None
    google_drive_url: str | None = None
    error_message: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime


class BackupDriveTestResponse(BaseModel):
    ok: bool
    message: str
    folder_name: str | None = None
    service_account_email: str | None = None


class BackupDriveTestRequest(BaseModel):
    google_drive_folder_id: str | None = None


class BackupGoogleOAuthStartResponse(BaseModel):
    authorization_url: str

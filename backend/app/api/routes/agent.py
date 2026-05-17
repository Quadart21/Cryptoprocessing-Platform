"""Точки для деплоя sandbox-агента на VPS (Bearer после enroll)."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_sandbox_agent
from app.models.merchant_sandbox import MerchantSandbox
from app.services.sandbox_service import SandboxService

router = APIRouter()


class AgentHeartbeatResponse(BaseModel):
    ok: bool = True


@router.post("/heartbeat", response_model=AgentHeartbeatResponse)
async def sandbox_agent_heartbeat(
    sandbox: MerchantSandbox = Depends(require_sandbox_agent),
    db: AsyncSession = Depends(get_db),
) -> AgentHeartbeatResponse:
    await SandboxService(db).record_agent_heartbeat(sandbox.id)
    return AgentHeartbeatResponse()

from fastapi import APIRouter

from app.api.routes.admin import router as admin_router
from app.api.routes.agent import router as agent_router
from app.api.routes.events import router as events_router
from app.api.routes.client import router as client_router
from app.api.routes.health import router as health_router
from app.api.routes.partner import router as partner_router
from app.api.routes.public import router as public_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(public_router, prefix="/public", tags=["public"])
api_router.include_router(client_router, prefix="/client", tags=["client"])
api_router.include_router(partner_router, prefix="/partner", tags=["partner"])
api_router.include_router(agent_router, prefix="/agent", tags=["agent"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])
api_router.include_router(events_router, prefix="/admin", tags=["events"])

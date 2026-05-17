from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.statistics_exclusion import StatisticsExclusion


class StatisticsExclusionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def excluded_tenant_ids(self) -> set[str]:
        rows = (await self.db.scalars(select(StatisticsExclusion.tenant_id))).all()
        return set(rows)

    async def is_excluded(self, tenant_id: str) -> bool:
        row = await self.db.get(StatisticsExclusion, tenant_id)
        return row is not None
